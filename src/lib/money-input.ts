/**
 * WHAT A PERSON TYPED AS MONEY OR A RATE, AS A NUMBER, OR NOTHING.
 *
 * Section 6 of Robert's audit of 2026-10-24, M-partner-blank: Number("") is 0,
 * so an empty field became $0.00 of flat fee, or 0%, and was stored as a
 * partner's terms. A blank is no amount at all, and so is anything that is not
 * a number; every caller refuses null with its own sentence. "$1,200" and
 * "2.5%" read as people write them.
 */
function blankIsNothing(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/[$,\s%]/g, "");
  return s === "" ? null : s;
}

/** Dollars as typed, to integer cents; null for a blank or anything not a number. */
export function typedDollarsToCents(raw: unknown): number | null {
  const s = blankIsNothing(raw);
  if (s === null) return null;
  const value = Number(s);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** A percentage as typed, to integer basis points; null for a blank or anything not a number. */
export function typedPercentToBps(raw: unknown): number | null {
  const s = blankIsNothing(raw);
  if (s === null) return null;
  const value = Number(s);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}
