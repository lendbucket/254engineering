/**
 * THE /start PRICE FINDER, AS DATA AND ARITHMETIC. Robert's add-on of
 * 2026-11-15 (the Google Ads landing page), items 2, 5, 6 and 15.
 *
 * NOTHING HERE TYPES A PRICE. Every figure is read from the price book
 * (priceFor) and the line's headline catalogue entry (its coastal charge), the
 * same two places /order reads, so the finder cannot quote a price checkout
 * would not charge. scripts/proofs/the-start-finder-quotes-what-checkout-charges.mjs
 * compares the finder's figures against pinned literals, never against these
 * derivers, because a check that reads its expectation from the thing it
 * checks cannot disagree with it.
 *
 * THE LETTER KEYS ARE THE AD URL'S. /start?letter=roof (also foundation, wpi8,
 * solar, permit, mh, repair, design) opens the finder at the county step with
 * that letter chosen and swaps the headline to the letter's own (item 6).
 */
import { priceFor } from "@/config/prices";
import { headlineEntry } from "@/lib/ordering";
import { isKnown } from "@/lib/ops-money";

export const LETTER_KEYS = ["roof", "foundation", "wpi8", "solar", "permit", "mh", "repair", "design"] as const;
export type LetterKey = (typeof LETTER_KEYS)[number];

export type Letter = {
  key: LetterKey;
  /** The service line, as the catalogue and /services/<slug> name it. */
  slug: string;
  /** What the finder calls it. */
  name: string;
  /** The order button's words. */
  cta: string;
  /**
   * The headline /start?letter=<key> shows (item 6). Plain words, each saying
   * what the letter is for, written for a person who searched for it.
   */
  headline: string;
};

export const LETTERS: Readonly<Record<LetterKey, Letter>> = {
  roof: {
    key: "roof",
    slug: "roof-inspections",
    name: "Roof certification letter",
    cta: "Order the roof letter",
    headline: "A roof certification letter for your insurance company.",
  },
  foundation: {
    key: "foundation",
    slug: "foundation-inspections",
    name: "Foundation certification",
    cta: "Order the foundation letter",
    headline: "A foundation certification for a sale, a lender or an inspection report.",
  },
  wpi8: {
    key: "wpi8",
    slug: "windstorm-wpi-8",
    name: "WPI-8E windstorm evaluation",
    cta: "Order the WPI-8E",
    headline: "A WPI-8E windstorm evaluation for TWIA coverage on the coast.",
  },
  solar: {
    key: "solar",
    slug: "solar-structural-letters",
    name: "Solar structural letter",
    cta: "Order the solar letter",
    headline: "A solar structural letter for your permit.",
  },
  permit: {
    key: "permit",
    slug: "structural-letters",
    name: "Structural letter for a permit",
    cta: "Order the permit letter",
    headline: "A structural letter that answers a plan reviewer's comment.",
  },
  mh: {
    key: "mh",
    slug: "manufactured-home-foundation-certifications",
    name: "Manufactured home foundation certification",
    cta: "Order the certification",
    headline: "A manufactured home foundation certification for your lender.",
  },
  repair: {
    key: "repair",
    slug: "repair-specifications",
    name: "Repair specification",
    cta: "Order the repair specification",
    headline: "One repair specification every contractor can price from.",
  },
  design: {
    key: "design",
    slug: "residential-light-commercial-design",
    name: "Residential and light commercial design",
    cta: "Describe the project",
    headline: "Engineered drawings for an addition, a remodel or light commercial work.",
  },
};

export function letterOf(raw: string | null | undefined): Letter | null {
  return raw && (LETTER_KEYS as readonly string[]).includes(raw) ? LETTERS[raw as LetterKey] : null;
}

export function letterBySlug(slug: string | null | undefined): Letter | null {
  return LETTER_KEYS.map((k) => LETTERS[k]).find((l) => l.slug === slug) ?? null;
}

/** "Who is asking for the letter?", the finder's first step, each pointing at the letter that answers it. */
export const REASONS: ReadonlyArray<{ id: string; label: string; hint: string; to: LetterKey }> = [
  { id: "insurer", label: "My insurance company", hint: "Wants the roof looked at", to: "roof" },
  { id: "sale", label: "A home sale", hint: "Inspector flagged the foundation", to: "foundation" },
  { id: "twia", label: "TWIA", hint: "Windstorm certificate", to: "wpi8" },
  { id: "solar", label: "A solar permit", hint: "Roof framing letter", to: "solar" },
  { id: "permit", label: "The city", hint: "Permit comment", to: "permit" },
  { id: "lender", label: "My lender", hint: "Manufactured home", to: "mh" },
  { id: "repair", label: "Contractors bidding", hint: "Need one repair scope", to: "repair" },
  { id: "design", label: "A new build", hint: "Engineered drawings", to: "design" },
];

export type Coastal = "yes" | "no" | "unsure";

export type Quote =
  | { kind: "fixed"; baseCents: number; coastalCents: number | null; totalCents: number; unsureCents: number | null }
  | { kind: "hourly"; rateCents: number; minimumCents: number }
  | { kind: "none" };

/**
 * The price for a letter and a county answer, from the price book and the
 * catalogue. "unsure" quotes the inland figure and names the coastal one
 * beside it, because the finder cannot know which applies.
 */
export function quoteFor(letter: Letter, coastal: Coastal | null): Quote {
  const price = priceFor(letter.slug);
  if (!price) return { kind: "none" };
  if (price.kind === "hourly") return { kind: "hourly", rateCents: price.rateCents, minimumCents: price.minimumCents };
  const entry = headlineEntry(letter.slug);
  const base = entry && isKnown(entry.priceCents) ? entry.priceCents : null;
  if (base === null) return { kind: "none" };
  const coastalCents = entry && isKnown(entry.coastalSurchargeCents) ? entry.coastalSurchargeCents : null;
  return {
    kind: "fixed",
    baseCents: base,
    coastalCents,
    totalCents: base + (coastal === "yes" && coastalCents !== null ? coastalCents : 0),
    unsureCents: coastal === "unsure" && coastalCents !== null ? base + coastalCents : null,
  };
}

/* ---------------------------------------------------------------- the clock */

/** The office answers 8 AM to 8 PM Central, every day (Robert's answer of 2026-11-15, 12:29). */
export const OFFICE_OPENS_HOUR = 8;
export const OFFICE_CLOSES_HOUR = 20;
const ZONE = "America/Chicago";

/** The wall clock in Chicago at an instant: year, month, day, hour and the UTC offset in minutes. */
function chicagoWall(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZoneName: "longOffset",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const offset = /GMT([+-])(\d{2}):(\d{2})/.exec(parts.timeZoneName ?? "");
  const offsetMinutes = offset ? (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) : 0;
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), hour: Number(parts.hour), offsetMinutes };
}

export function officeIsOpen(at: Date): boolean {
  const { hour } = chicagoWall(at);
  return hour >= OFFICE_OPENS_HOUR && hour < OFFICE_CLOSES_HOUR;
}

/**
 * When a callback requested at `at` falls due (item 15): at once while the
 * office is open, otherwise at the next 8 AM Central. Computed on Chicago's own
 * calendar, with the offset read for the day it lands on, so the switch to and
 * from daylight time lands on 8 AM rather than 7 or 9.
 */
export function callbackDueAt(at: Date): Date {
  if (officeIsOpen(at)) return at;
  const wall = chicagoWall(at);
  const dayOffset = wall.hour >= OFFICE_CLOSES_HOUR ? 1 : 0;
  /* Noon UTC on the target calendar day is safely inside that Chicago day, so its offset is that day's offset. */
  const probe = new Date(Date.UTC(wall.y, wall.m - 1, wall.d + dayOffset, 12));
  const target = chicagoWall(probe);
  return new Date(Date.UTC(target.y, target.m - 1, target.d, OFFICE_OPENS_HOUR) - target.offsetMinutes * 60_000);
}

/* -------------------------------------------------------- the price emails */

/**
 * "Email me the price": the price at once, a reminder two days later, a final
 * note on day five (item 14 and Robert's answer 1 of 13:11). Each stops the
 * moment that person orders. The delays are counted from the request.
 */
export const PRICE_EMAIL_DAYS = [0, 2, 5] as const;

export function priceEmailDueAt(requestedAt: Date, step: 1 | 2 | 3): Date {
  return new Date(requestedAt.getTime() + PRICE_EMAIL_DAYS[step - 1] * 24 * 60 * 60 * 1000);
}
