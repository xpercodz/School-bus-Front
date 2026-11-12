import {
  Timestamp,
  doc,
  serverTimestamp,
  setDoc,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import { auth } from "@/lib/firebase";
import type { MessageKey } from "@/lib/i18n/types";

/**
 * The activity log — one immutable entry per behaviour a director can be asked
 * to answer for.
 *
 * Two writers exist and they do not carry the same weight:
 *
 *   - the API writes with the Admin SDK (bypasses rules) — verified token, its
 *     own clock, its own view of what changed. **Evidence.**
 *   - the browser writes with `source: "client"`, in the same batch as the
 *     change itself. The rules pin `actorUid` to the caller and `at` to the
 *     server's clock, and forbid update/delete, so the entry cannot be
 *     misattributed or rewritten — but its `changes` are what the writer said
 *     they were. **A claim.**
 *
 * Nothing here may record what the reader must not hold: codes, hashes, tokens,
 * whole documents, or a child's name. Students are referenced by id only.
 *
 * See `docs/superpowers/specs/2026-11-11-audit-log-design.md`.
 */

/** How long an entry survives. One number, stated in the UI, enforced by TTL. */
export const AUDIT_RETENTION_DAYS = 365;

/** Bumped only when the stored shape changes in a way the reader must branch on. */
export const AUDIT_SCHEMA_VERSION = 1;

/**
 * The closed vocabulary. `object.action`, never a sentence: the sentence is
 * built from the dictionary in both languages, so an English string never
 * enters the log.
 */
export type AuditEvent =
  | "auth.sign_in"
  | "auth.sign_in_failed"
  | "auth.code_sign_in"
  | "driver.created"
  | "driver.code_regenerated"
  | "operator.created"
  | "operator.screens_changed"
  | "operator.password_changed"
  | "operator.removed"
  | "owner.changed"
  | "student.bus_changed"
  | "student.updated"
  | "bus.driver_changed"
  | "attendance.changed"
  | "run.completed"
  | "run.dispatched"
  | "students.imported"
  | "school.assignment_mode_changed"
  | "activity.exported";

/**
 * The four groups the screen filters by. `access` is the rare, high-signal half;
 * `roll` is the volume half — a busy school day writes hundreds of attendance
 * transitions and one account change.
 */
export type AuditFamily = "access" | "student" | "roll" | "settings";

export const EVENT_FAMILY: Record<AuditEvent, AuditFamily> = {
  "auth.sign_in": "access",
  "auth.sign_in_failed": "access",
  "auth.code_sign_in": "access",
  "driver.created": "access",
  "driver.code_regenerated": "access",
  "operator.created": "access",
  "operator.screens_changed": "access",
  "operator.password_changed": "access",
  "operator.removed": "access",
  "owner.changed": "access",
  "student.bus_changed": "student",
  "student.updated": "student",
  "bus.driver_changed": "student",
  "attendance.changed": "roll",
  "run.completed": "roll",
  "run.dispatched": "roll",
  "students.imported": "roll",
  "school.assignment_mode_changed": "settings",
  "activity.exported": "settings",
};

/** Every event of one family — what the count queries and the filter use. */
export function eventsInFamily(family: AuditFamily): AuditEvent[] {
  return (Object.keys(EVENT_FAMILY) as AuditEvent[]).filter((e) => EVENT_FAMILY[e] === family);
}

/**
 * The sentence template, one per event. Typed as `MessageKey` so a missing key
 * is a compile error rather than a raw event name on screen.
 */
export const EVENT_LABEL_KEY: Record<AuditEvent, MessageKey> = {
  "auth.sign_in": "activity.event.signIn",
  "auth.sign_in_failed": "activity.event.signInFailed",
  "auth.code_sign_in": "activity.event.codeSignIn",
  "driver.created": "activity.event.driverCreated",
  "driver.code_regenerated": "activity.event.codeRotated",
  "operator.created": "activity.event.operatorCreated",
  "operator.screens_changed": "activity.event.screensChanged",
  "operator.password_changed": "activity.event.passwordReset",
  "operator.removed": "activity.event.operatorRemoved",
  "owner.changed": "activity.event.ownerChanged",
  "student.bus_changed": "activity.event.busChanged",
  "student.updated": "activity.event.studentUpdated",
  "bus.driver_changed": "activity.event.driverChanged",
  "attendance.changed": "activity.event.attendanceChanged",
  "run.completed": "activity.event.runCompleted",
  "run.dispatched": "activity.event.runDispatched",
  "students.imported": "activity.event.imported",
  "school.assignment_mode_changed": "activity.event.assignmentModeChanged",
  "activity.exported": "activity.event.exported",
};

/** True when a stored `event` is one this build knows how to say in words. */
export function isKnownEvent(value: unknown): value is AuditEvent {
  return typeof value === "string" && value in EVENT_FAMILY;
}

export type AuditRole = "director" | "operator" | "staff" | "system";
export type AuditSource = "api" | "client" | "system";

export interface AuditChange {
  from: string | number | null;
  to: string | number | null;
}

/**
 * Bounded extras. A closed set of scalar keys, because an open map on the log is
 * the dumping ground the research note warns against.
 */
export interface AuditMeta {
  count?: number;
  runId?: string;
  date?: string;
  busId?: string;
  reason?: string;
}

/**
 * One stored entry. `schemaVersion` is absent on the handful of documents the
 * API wrote before this shape existed; the reader treats those as v0.
 */
export interface AuditEntry {
  schemaVersion: number;
  event: AuditEvent;
  outcome: "success" | "failure";
  reason: string | null;

  /** The server's clock — the only one a client cannot set. */
  at: Timestamp;
  /** The device's clock, on client entries only. Untrusted; shown as such. */
  occurredAt: Timestamp | null;

  actorUid: string;
  actorRole: AuditRole | null;
  /** Snapshot, so a removed account still reads as a person. */
  actorName: string;

  targetType: "student" | "bus" | "run" | "account" | "school" | "export" | null;
  /** Opaque id. A student is never stored by name. */
  targetId: string | null;
  /** Only ever set for an account target — never for a child. */
  targetName: string | null;

  changes: Record<string, AuditChange>;
  correlationId: string | null;
  meta: AuditMeta | null;
  source: AuditSource;
  expiresAt: Timestamp;
}

/** What a writer supplies; the rest is filled in by `newAuditEntry`. */
export interface AuditInput {
  event: AuditEvent;
  outcome?: "success" | "failure";
  reason?: string | null;
  targetType?: AuditEntry["targetType"];
  targetId?: string | null;
  targetName?: string | null;
  changes?: Record<string, AuditChange>;
  correlationId?: string | null;
  meta?: AuditMeta | null;
  /** Defaults to `client` — only the API passes anything else. */
  source?: AuditSource;
  /** Defaults to now; a queued tap passes the moment the driver pressed. */
  occurredAt?: Date | null;
}

/** Events a driver may append. The API allowlist mirrors this exactly. */
export const STAFF_EVENTS: readonly AuditEvent[] = ["attendance.changed", "run.completed"];

// Built from a string so the ranges are readable and lint sees no literal
// control character: C0 controls and DEL, then the bidi embeddings/overrides and
// isolates that can reverse how a row renders.
const CONTROL_AND_BIDI = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}` +
    `\\u202a-\\u202e\\u2066-\\u2069]`,
  "g",
);

/**
 * Nothing user-controlled reaches the log raw.
 *
 * The bidi controls are the reason this exists rather than a tidy-up: in an
 * Arabic/English UI, U+202E inside a free string reverses the rest of the line,
 * so a fabricated name can make a row read as its opposite.
 */
export function sanitizeText(value: string | null | undefined, max = 120): string {
  if (!value) return "";
  return value.replace(CONTROL_AND_BIDI, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const MAX_CHANGES = 8;

function clampChanges(changes: Record<string, AuditChange> | undefined): Record<string, AuditChange> {
  const out: Record<string, AuditChange> = {};
  let n = 0;
  for (const [field, change] of Object.entries(changes ?? {})) {
    if (n >= MAX_CHANGES) break;
    out[sanitizeText(field, 40)] = {
      from: typeof change.from === "string" ? sanitizeText(change.from, 80) : change.from,
      to: typeof change.to === "string" ? sanitizeText(change.to, 80) : change.to,
    };
    n += 1;
  }
  return out;
}

/** The display name of the signed-in user, as the Auth record holds it. */
function currentActorName(): string {
  return sanitizeText(auth?.currentUser?.displayName, 80);
}

/**
 * Build an entry and its id. The id is a random UUID chosen by the writer so a
 * queued batch that is retried rewrites the same document instead of appending a
 * duplicate — and so the rules cannot be probed for a guessable sequence.
 */
export function newAuditEntry(input: AuditInput): { id: string; data: AuditEntry } {
  const now = Date.now();
  const uid = auth?.currentUser?.uid ?? "";
  const data: AuditEntry = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    event: input.event,
    outcome: input.outcome ?? "success",
    reason: input.reason ? sanitizeText(input.reason, 200) : null,
    at: serverTimestamp() as unknown as Timestamp,
    occurredAt: input.occurredAt ? Timestamp.fromDate(input.occurredAt) : null,
    actorUid: uid,
    // A browser never learns its own role without a read, and the reader
    // resolves it live from `users/{uid}` anyway. The API fills this in.
    actorRole: null,
    actorName: currentActorName(),
    targetType: input.targetType ?? null,
    targetId: input.targetId ? sanitizeText(input.targetId, 128) : null,
    targetName: input.targetName ? sanitizeText(input.targetName, 80) : null,
    changes: clampChanges(input.changes),
    correlationId: input.correlationId ? sanitizeText(input.correlationId, 64) : null,
    meta: input.meta ?? null,
    source: input.source ?? "client",
    expiresAt: Timestamp.fromMillis(now + AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };
  return { id: crypto.randomUUID(), data };
}

/** The document reference an entry belongs at. */
export function auditRef(
  firestore: Firestore,
  schoolId: string,
  entryId: string,
): DocumentReference {
  return doc(firestore, "schools", schoolId, "audit", entryId);
}

/**
 * Append the entry to the SAME batch as the change it describes, so the log and
 * the record commit together or not at all.
 */
export function queueAudit(
  batch: WriteBatch,
  firestore: Firestore,
  schoolId: string,
  input: AuditInput,
): string {
  const { id, data } = newAuditEntry(input);
  batch.set(auditRef(firestore, schoolId, id), data);
  return id;
}

/**
 * An entry with no accompanying write (an export). Fire-and-forget by design:
 * failing to record an export must not fail the export.
 */
export async function logAudit(
  firestore: Firestore,
  schoolId: string,
  input: AuditInput,
): Promise<void> {
  const { id, data } = newAuditEntry(input);
  await setDoc(auditRef(firestore, schoolId, id), data);
}
