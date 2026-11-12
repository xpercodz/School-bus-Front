/**
 * HOVER HINTS — the one-line answer to "what is that?".
 *
 * A control opts in with `data-hint="<id>"`; the engine
 * (`components/HoverHint.tsx`) reads this registry and resolves the copy in the
 * current language. Keeping the ids here, not in the components, means the
 * dictionary stays the single source of text and a typo in an attribute is
 * ignored rather than rendered as a raw key.
 */
import type { MessageKey } from "@/lib/i18n/types";

export const HINT_IDS = [
  "scope",
  "summary",
  "unaccounted",
  "routes",
  "dispatch",
  "export",
  "guidebook",
  "date",
] as const;

export type HintId = (typeof HINT_IDS)[number];

export const HINT_KEYS: Record<HintId, { title: MessageKey; body: MessageKey }> = {
  scope: { title: "hint.scope.title", body: "hint.scope.body" },
  summary: { title: "hint.summary.title", body: "hint.summary.body" },
  unaccounted: { title: "hint.unaccounted.title", body: "hint.unaccounted.body" },
  routes: { title: "hint.routes.title", body: "hint.routes.body" },
  dispatch: { title: "hint.dispatch.title", body: "hint.dispatch.body" },
  export: { title: "hint.export.title", body: "hint.export.body" },
  guidebook: { title: "hint.guidebook.title", body: "hint.guidebook.body" },
  date: { title: "hint.date.title", body: "hint.date.body" },
};

export function isHintId(value: string | null): value is HintId {
  return value !== null && (HINT_IDS as readonly string[]).includes(value);
}
