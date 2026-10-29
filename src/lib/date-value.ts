/**
 * Bridge between the app's date key and the Arc date picker.
 *
 * Everything stored and queried uses the local "YYYY-MM-DD" key (`date` fields,
 * run ids, `todayDateStr`). The Arc components take a `Date`. These two helpers
 * convert at the edge and nowhere else: built from parts, never from
 * `new Date(string)`, so a date never shifts a day across a timezone.
 */

/** "YYYY-MM-DD" → that day at local midnight. Invalid input falls back to today. */
export function toDateValue(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

/** A Date at local midnight → the app's "YYYY-MM-DD" key. */
export function fromDateValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
