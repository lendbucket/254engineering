import { regionOfCounty } from "@/content/regions";

/**
 * THE SALES CRM'S VOCABULARY AND ITS RULES. Robert's sales CRM ruling of
 * 2026-11-02, item R1, migration 0112.
 *
 * Client safe and free of the database, so the screens, the server and the
 * proofs read one list. Every list here matches a check constraint in 0112,
 * and the proof compares them.
 *
 * ONE CRM: a company is an eng_prospects row and an activity is an
 * eng_contact_log row, both extended by 0112. Nothing here starts a second
 * store.
 */

/* ------------------------------------------------------------------ verticals */

export const CRM_VERTICALS = [
  "roofer",
  "solar",
  "manufactured_home_dealer",
  "foundation_repair",
  "real_estate",
  "lender",
  "insurance_agent",
  "other",
] as const;
export type CrmVertical = (typeof CRM_VERTICALS)[number];

export const VERTICAL_LABEL: Record<CrmVertical, string> = {
  roofer: "Roofer",
  solar: "Solar",
  manufactured_home_dealer: "Manufactured home dealer",
  foundation_repair: "Foundation repair",
  real_estate: "Real estate",
  lender: "Lender",
  insurance_agent: "Insurance agent",
  other: "Other",
};

/**
 * THE KIND IS THE VERTICAL. Robert's CRM answer 8 (2026-11-02), 0123:
 * eng_prospects_type_known holds the eight verticals, and 0123 set every row's
 * kind to its vertical. Before it, 0079's check allowed only roofer, agent,
 * title and contractor, and every write set the nearest of those; 0123 is what
 * lets the kind say what the vertical says.
 */
export function prospectTypeForVertical(v: CrmVertical): CrmVertical {
  return v;
}

/**
 * The vertical a kind names. After 0123 a kind IS a vertical. The old four are
 * still read the way 0112's backfill read them, for a row read before the
 * sitting or a value typed by hand: agent is real_estate, and title and
 * contractor are other.
 */
export function verticalForProspectType(t: string): CrmVertical {
  if ((CRM_VERTICALS as readonly string[]).includes(t)) return t as CrmVertical;
  if (t === "agent") return "real_estate";
  return "other";
}

/**
 * The words a person types for each vertical, in a spreadsheet or a source's
 * own field. One home for both readers: the CRM imports (crm-import-parse) and
 * the prospects screen's CSV (prospect-import). Title companies and
 * contractors are not among the eight, so they read as other, as 0123 mapped
 * them.
 */
const VERTICAL_WORDS: Record<CrmVertical, RegExp> = {
  roofer: /^(roofer|roofers|roofing|roofing company|roofing contractor)$/,
  solar: /^(solar|solar installer|solar company|solar contractor)$/,
  manufactured_home_dealer: /^(manufactured home dealer|manufactured home|mobile home dealer|mh dealer|manufactured housing)$/,
  foundation_repair: /^(foundation repair|foundation|foundation contractor)$/,
  real_estate: /^(real estate|realtor|realtors|agent|agents|broker|brokerage|real estate agent)$/,
  lender: /^(lender|lenders|mortgage|mortgage lender|loan officer|bank)$/,
  insurance_agent: /^(insurance|insurance agent|insurance agency|agency)$/,
  /* The prospects screen's old words for title and contractor kept, so a spreadsheet it read before still reads. */
  other: /^(other|title|title company|title companies|title agent|escrow|contractor|contractors|general contractor|gc|builder|remodeler)$/,
};

export function verticalFrom(value: string | null | undefined): CrmVertical | null {
  const v = (value ?? "").trim().toLowerCase().replace(/_/g, " ");
  if (!v) return null;
  for (const k of CRM_VERTICALS) if (k.replace(/_/g, " ") === v || VERTICAL_WORDS[k].test(v)) return k;
  return null;
}

/* --------------------------------------------------------------------- stages */

export const CRM_STAGES = [
  "new",
  "attempted",
  "connected",
  "interested",
  "account_opened",
  "ordering",
  "dormant",
  "do_not_contact",
] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const STAGE_LABEL: Record<CrmStage, string> = {
  new: "New",
  attempted: "Attempted",
  connected: "Connected",
  interested: "Interested",
  account_opened: "Account opened",
  ordering: "Ordering",
  dormant: "Dormant",
  do_not_contact: "Do not contact",
};

/** The two stages a converted prospect is in, and the only two. eng_prospects_stage_matches_conversion. */
export const CUSTOMER_STAGES: readonly CrmStage[] = ["account_opened", "ordering"];

export type ProspectStatus = "open" | "converted" | "not_interested";

/**
 * Whether a stage move is allowed, and the status that goes with it, or the
 * sentence that refuses it. 0112's checks enforce the same at the database;
 * this says it in words before anything is written.
 *
 * - Do not contact is for good: nothing moves a prospect out of it.
 * - The two customer stages are reached by converting (account_opened) and by
 *   the first order (ordering), never by a stage move from the board.
 * - Dormant is open after a sequence that ran out, not interested after a
 *   refusal; `refusal` says which.
 */
export function stageMove(
  from: CrmStage,
  to: CrmStage,
  opts: { refusal?: boolean; byConversion?: boolean; byOrder?: boolean } = {},
): { ok: true; status: ProspectStatus } | { ok: false; error: string } {
  if (!(CRM_STAGES as readonly string[]).includes(to)) return { ok: false, error: "That is not a stage on the sales list." };
  if (from === "do_not_contact") return { ok: false, error: "This company asked not to be contacted. That is kept for good." };
  if (to === "account_opened" && !opts.byConversion) return { ok: false, error: "A company reaches Account opened by converting it into an account." };
  if (to === "ordering" && !opts.byOrder && from !== "account_opened" && from !== "ordering") {
    return { ok: false, error: "A company reaches Ordering with its first order on an account." };
  }
  if ((from === "account_opened" || from === "ordering") && !CUSTOMER_STAGES.includes(to)) {
    return { ok: false, error: "This company is already a customer. Change the account instead." };
  }
  if (to === from) return { ok: false, error: "The company is already at that stage." };
  if (CUSTOMER_STAGES.includes(to)) return { ok: true, status: "converted" };
  if (to === "do_not_contact") return { ok: true, status: "not_interested" };
  if (to === "dormant" && opts.refusal) return { ok: true, status: "not_interested" };
  return { ok: true, status: "open" };
}

/* -------------------------------------------------------------------- sources */

export const CRM_SOURCES = [
  "permits_san_antonio",
  "permits_corpus_christi",
  "permits_houston",
  "permits_dallas",
  "permits_austin",
  "permits_fort_worth",
  "tdlr_electrical",
  /* TDLR's residential solar registrations, Robert's answer to 6588393366 (2026-11-02): vertical solar. */
  "tdlr_solar_retailers",
  "tdlr_solar_salespeople",
  "tdhca_mh",
  "trec",
  "csv",
  "manual",
] as const;
export type CrmSource = (typeof CRM_SOURCES)[number];

export const SOURCE_LABEL: Record<CrmSource, string> = {
  permits_san_antonio: "San Antonio building permits",
  permits_corpus_christi: "Corpus Christi building permits",
  permits_houston: "Houston building permits",
  permits_dallas: "Dallas building permits",
  permits_austin: "Austin building permits",
  permits_fort_worth: "Fort Worth building permits",
  tdlr_electrical: "TDLR electrical contractors",
  tdlr_solar_retailers: "TDLR residential solar retailers",
  tdlr_solar_salespeople: "TDLR residential solar salespeople",
  tdhca_mh: "TDHCA manufactured housing licensees",
  trec: "TREC brokers and sales agents",
  csv: "A spreadsheet",
  manual: "Typed in",
};

/* ----------------------------------------------------------------- activities */

export const ACTIVITY_KINDS = ["call", "email", "note", "stage_change", "assignment", "import", "sequence"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const CRM_OUTCOMES = [
  "no_answer",
  "voicemail",
  "callback",
  "interested",
  "not_interested",
  "wrong_number",
  "do_not_call",
  "connected",
] as const;
export type CrmOutcome = (typeof CRM_OUTCOMES)[number];

/* -------------------------------------------------------------- normalization */

/*
 * THE TWO KEYS ARE THE DATABASE'S. name_normalized and phone_normalized are
 * generated columns over eng_crm_normalize_name and eng_crm_normalize_phone
 * (0112), so the unique key and its value cannot disagree. These mirrors exist
 * to look a company up BEFORE a write; the proof runs both on the same inputs.
 */
const ENTITY_SUFFIX = /\b(l l c|llc|inc|incorporated|co|corp|corporation|company|ltd|limited|pllc|lp|llp|dba)\b/g;

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(ENTITY_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/[^0-9]/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length === 10) return d;
  return null;
}

/** The street words a permit file and a spreadsheet spell differently. */
const STREET_WORDS: Record<string, string> = {
  street: "st", avenue: "ave", road: "rd", drive: "dr", boulevard: "blvd", lane: "ln",
  court: "ct", place: "pl", parkway: "pkwy", highway: "hwy", circle: "cir", trail: "trl",
  suite: "ste", apartment: "apt", north: "n", south: "s", east: "e", west: "w",
};

/** An address reduced to what two spellings of one place share, for the import's dedupe (R2). */
export function normalizeAddress(address: string | null | undefined): string {
  return (address ?? "")
    .toLowerCase()
    .replace(/#/g, " ste ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => STREET_WORDS[w] ?? w)
    .join(" ");
}

/* ------------------------------------------------------------------ territory */

/**
 * THE TERRITORY IS THE COUNTY; THE REGION IS DERIVED. The county is stored on
 * the company and the region is read from the region map in
 * src/content/regions.ts, never stored, so a redrawn region moves every
 * company with it. An unknown county is refused rather than stored.
 */
export function territoryFor(county: string | null | undefined): { county: string; regionSlug: string; regionName: string } | null {
  const name = (county ?? "").trim().replace(/\s+county$/i, "");
  if (!name) return null;
  const match = Object.keys(regionOfCounty).find((c) => c.toLowerCase() === name.toLowerCase());
  if (!match) return null;
  const region = regionOfCounty[match];
  return { county: match, regionSlug: region.slug, regionName: region.name };
}

export function countyProblem(county: string | null | undefined): string | null {
  if (!county || !county.trim()) return null;
  return territoryFor(county) ? null : `${county.trim()} is not one of the 254 Texas counties.`;
}

/* ---------------------------------------------------------------------- score */

export function scoreProblem(score: unknown): string | null {
  return Number.isInteger(score) && (score as number) >= 0 && (score as number) <= 100 ? null : "A score is a whole number from 0 to 100.";
}
