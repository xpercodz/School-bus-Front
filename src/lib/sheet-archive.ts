/**
 * The archive decision — which children the sheet no longer names.
 *
 * A pure function, and deliberately import-free: `node --test` loads this file
 * directly (Node strips the types, no build step), so the one decision that
 * removes a child from the roster is provable without a browser or a database.
 * Matching happens before this is called; all it needs is who is active and who
 * the sheet named.
 */

// ── types ────────────────────────────────────────────────────────────────────

export interface ArchiveCandidate {
  id: string;
  name: string;
  grade: string;
}

// ── the decision ─────────────────────────────────────────────────────────────

/**
 * Everyone on the roll the sheet did not name.
 *
 * `matchedIds` is `null` when the sheet could not be read as a roster at all
 * (no name column, no name rows). That is not an empty school, so it archives
 * nobody — an unreadable file must never empty the roll.
 *
 * Preserves the input order, so the preview reads in roster order.
 */
export function buildArchiveSet(
  active: readonly ArchiveCandidate[],
  matchedIds: ReadonlySet<string> | null,
): ArchiveCandidate[] {
  if (matchedIds === null) return [];
  return active.filter((student) => !matchedIds.has(student.id));
}
