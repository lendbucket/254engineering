/**
 * THE FRANCHISE FEES. Robert Reyna's ruling of 2026-11-10 (overnight orders of
 * 2026-11-10 into 2026-11-11, the 254 franchise fees, standing list FR3):
 *
 *   "$39,500 initial fee, $29,500 for the first three territories, 7% royalty
 *    on territory revenue, 2% brand fund, $400 a month technology fee, 20%
 *    veteran discount. The per job engineering capacity fee waits on the
 *    TBPELS letter (FR1) and is stored as not decided. All of it lives in one
 *    config file with my name and today's date on it, so the attorney can move
 *    any figure."
 *
 * THIS FILE IS THAT ONE HOME. Nothing else in the repository may type these
 * figures. The FDD inputs packet (docs/franchise/fdd-inputs-for-counsel.md)
 * quotes the ruling in prose and points here. The royalty and fee statement
 * (platform item X3) reads this file and nothing else.
 *
 * STAFF AND ADMIN ONLY. No figure here is shown on a public page, and nothing
 * here is an offer: FR13 stands, no franchise promises before the FDD issues.
 *
 * MOVING A FIGURE IS TWO EDITS, ON PURPOSE. The proof
 * scripts/proofs/the-franchise-fees-are-roberts-ruling.mjs pins every figure
 * below as a literal. Change one here and the proof goes red naming it, and
 * the change is finished by updating the literal there, with the new ruling's
 * author and date written in both places.
 *
 * Amounts are whole cents and rates are basis points (700 is 7%), so no figure
 * is ever a floating point number.
 */

export const FRANCHISE_FEES_RULED_BY = "Robert Reyna";
export const FRANCHISE_FEES_RULED_ON = "2026-11-10";

export type FeeRuling =
  | {
      state: "set";
      /** Whole cents, for a fixed amount. Null for a rate. */
      cents: number | null;
      /** Basis points, for a rate. Null for a fixed amount. */
      basisPoints: number | null;
      /** How often a fixed amount is due, or what a rate is charged on, as the ruling words it. */
      per: string;
      /** What the ruling leaves open about this figure, for the attorney. Null when it leaves nothing open. */
      open: string | null;
      by: string;
      on: string;
    }
  | {
      /**
       * A fee the ruling names and deliberately does not set. Not "pending" and
       * not zero: zero is a decision that the fee is nothing, and nobody has
       * decided that.
       */
      state: "not-decided";
      /** What the decision waits on. */
      waitsOn: string;
      by: string;
      on: string;
    };

const BY = FRANCHISE_FEES_RULED_BY;
const ON = FRANCHISE_FEES_RULED_ON;

export const FRANCHISE_FEES = {
  initialFee: {
    state: "set",
    cents: 3_950_000,
    basisPoints: null,
    per: "territory, once",
    open: null,
    by: BY,
    on: ON,
  },
  initialFeeFirstThreeTerritories: {
    state: "set",
    cents: 2_950_000,
    basisPoints: null,
    per: "territory, once, for the first three territories",
    open: "Whether the first three means the first three territories sold system wide, or a franchisee's first three.",
    by: BY,
    on: ON,
  },
  royalty: {
    state: "set",
    cents: null,
    basisPoints: 700,
    per: "territory revenue",
    open: "How territory revenue is measured: which orders, before or after refunds, and over what period.",
    by: BY,
    on: ON,
  },
  brandFund: {
    state: "set",
    cents: null,
    basisPoints: 200,
    per: "not stated in the ruling",
    open: "What the 2% is charged on. The ruling does not say; the royalty's base, territory revenue, is the obvious reading and is not assumed here.",
    by: BY,
    on: ON,
  },
  technologyFee: {
    state: "set",
    cents: 40_000,
    basisPoints: null,
    per: "month",
    open: null,
    by: BY,
    on: ON,
  },
  veteranDiscount: {
    state: "set",
    cents: null,
    basisPoints: 2_000,
    per: "not stated in the ruling",
    open: "Which fees the 20% comes off: the initial fee only, or others too.",
    by: BY,
    on: ON,
  },
  engineeringCapacityFee: {
    state: "not-decided",
    waitsOn:
      "The TBPELS opinion letter (FR1): whether 254 may pay a franchisee a per order commission given 22 TAC 137.63(c)(4), and how the engineer supervises franchisee technicians (22 TAC 137.51).",
    by: BY,
    on: ON,
  },
} as const satisfies Record<string, FeeRuling>;

export type FranchiseFee = keyof typeof FRANCHISE_FEES;

/** A fee as a sentence for a staff screen or a statement: "$39,500.00 per territory, once", "7% of territory revenue". */
export function feeSentence(fee: FranchiseFee): string {
  const f: FeeRuling = FRANCHISE_FEES[fee];
  if (f.state === "not-decided") return "Not decided";
  if (f.cents !== null) {
    const dollars = (f.cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    return `${dollars} per ${f.per}`;
  }
  const percent = (f.basisPoints ?? 0) / 100;
  return f.per === "not stated in the ruling" ? `${percent}%, base not stated` : `${percent}% of ${f.per}`;
}
