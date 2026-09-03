/**
 * Money, and the difference between a figure that is zero and one that is not
 * there.
 *
 * THE WHOLE MODULE EXISTS FOR ONE DISTINCTION
 * -------------------------------------------
 * A file whose client price has not been set yet and a file priced at nothing
 * are different facts, and every naive money implementation renders them
 * identically as $0.00. Then somebody sums a column, gets a margin, and acts on
 * a number that is mostly absence.
 *
 * That is not a hypothetical for this firm. Most files on this platform today
 * carry a client price and no engineer production figure, because production
 * rates were only added for one service line. A dashboard that treated the
 * missing ones as zero would report a margin far higher than the truth, and it
 * would look completely plausible.
 *
 * So a money value is `number | null` everywhere, arithmetic on it returns null
 * when any input is null, and every total reports how much of itself is known.
 * A total that cannot say what it covers is a number nobody should act on.
 */

/** Cents, or nothing. Never a zero standing in for nothing. */
export type Cents = number | null;

/** Is there a figure here at all? */
export function isKnown(value: Cents): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/**
 * Format for display.
 *
 * An absent figure reads "not set" rather than "$0.00", everywhere, including
 * inside a total. The phrase is deliberately not a dash or an empty cell:
 * both of those look like a rendering fault, and somebody will eventually
 * decide the dash means zero.
 */
export function money(value: Cents): string {
  if (!isKnown(value)) return "not set";
  return `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The same, for a CSV cell, where an absent figure must not become 0. */
export function moneyCell(value: Cents): string {
  return isKnown(value) ? (value / 100).toFixed(2) : "";
}

/**
 * Add, propagating absence.
 *
 * If any part is unknown the sum is unknown. That is stricter than summing what
 * is present, and it is the right strictness for a margin: a margin computed
 * from two of its three inputs is not a smaller margin, it is a wrong one.
 */
export function add(...values: Cents[]): Cents {
  let total = 0;
  for (const value of values) {
    if (!isKnown(value)) return null;
    total += value;
  }
  return total;
}

export function subtract(from: Cents, ...values: Cents[]): Cents {
  if (!isKnown(from)) return null;
  let total = from;
  for (const value of values) {
    if (!isKnown(value)) return null;
    total -= value;
  }
  return total;
}

// --------------------------------------------------------------- per file

export type FileMoney = {
  clientPriceCents: Cents;
  techCostCents: Cents;
  engineerCostCents: Cents;
};

export type Margin = {
  revenue: Cents;
  cost: Cents;
  margin: Cents;
  /** Percentage of revenue, when both are known and revenue is not zero. */
  marginPercent: number | null;
  /** Which inputs are missing, so a screen can say why rather than showing nothing. */
  missing: ("client price" | "technician cost" | "engineer production")[];
};

/**
 * Margin on one file.
 *
 * A COST OF ZERO IS A REAL COST AND IS NOT MISSING
 * ------------------------------------------------
 * A desk review with no site visit genuinely has no technician cost. That file's
 * margin is knowable and this returns it. What it refuses to do is treat an
 * unset field as though somebody had decided it was nothing.
 */
export function marginOf(file: FileMoney): Margin {
  const missing: Margin["missing"] = [];
  if (!isKnown(file.clientPriceCents)) missing.push("client price");
  if (!isKnown(file.techCostCents)) missing.push("technician cost");
  if (!isKnown(file.engineerCostCents)) missing.push("engineer production");

  const revenue = file.clientPriceCents;
  const cost = add(file.techCostCents, file.engineerCostCents);
  const margin = subtract(revenue, cost);

  return {
    revenue,
    cost,
    margin,
    marginPercent:
      isKnown(margin) && isKnown(revenue) && revenue !== 0
        ? Math.round((margin / revenue) * 1000) / 10
        : null,
    missing,
  };
}

// -------------------------------------------------------------- per period

export type PeriodTotals = {
  period: string;
  files: number;
  /** Files where every input was present. Only these are in the totals. */
  complete: number;
  revenue: Cents;
  cost: Cents;
  margin: Cents;
  marginPercent: number | null;
  /**
   * A sentence a screen can print instead of a bare number.
   *
   * A total covering four of nine files is a true statement about four files and
   * a misleading one about the month, and the only way to stop somebody reading
   * it as the month is to say so beside it.
   */
  coverage: string;
};

/**
 * Roll up a period.
 *
 * FILES WITH MISSING FIGURES ARE EXCLUDED, NOT ZEROED
 * ---------------------------------------------------
 * The alternative, adding what is present, produces a revenue total that is real
 * and a cost total that is partial, and therefore a margin that is too high by
 * exactly the amount nobody has entered yet. That error always points the same
 * way, which is the dangerous kind.
 */
export function periodTotals(period: string, files: FileMoney[]): PeriodTotals {
  const complete = files.filter((f) => marginOf(f).missing.length === 0);

  const revenue = complete.length ? add(...complete.map((f) => f.clientPriceCents)) : null;
  const cost = complete.length
    ? add(...complete.map((f) => add(f.techCostCents, f.engineerCostCents)))
    : null;
  const margin = subtract(revenue, cost);

  return {
    period,
    files: files.length,
    complete: complete.length,
    revenue,
    cost,
    margin,
    marginPercent:
      isKnown(margin) && isKnown(revenue) && revenue !== 0
        ? Math.round((margin / revenue) * 1000) / 10
        : null,
    coverage: coverageSentence(complete.length, files.length),
  };
}

export function coverageSentence(complete: number, total: number): string {
  if (total === 0) return "No files in this period.";
  if (complete === 0) {
    return `None of the ${total} file${total === 1 ? "" : "s"} in this period has every figure entered, so there is no total to show.`;
  }
  if (complete === total) {
    return `Every one of the ${total} file${total === 1 ? "" : "s"} has all three figures, so this total is the whole period.`;
  }
  return `Covers ${complete} of ${total} files. The other ${total - complete} ${
    total - complete === 1 ? "is" : "are"
  } missing a figure and ${total - complete === 1 ? "is" : "are"} left out rather than counted as nothing.`;
}
