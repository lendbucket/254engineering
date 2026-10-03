/**
 * ===========================================================================
 * WHAT A READER CAN ORDER RIGHT NOW, AND WHAT IT COSTS. ONE HOME.
 * Operator ruling, 2026-10-03.
 * ===========================================================================
 *
 * His finding: "The public site never leads anyone to the order flow. Start a
 * job goes to /contact, and the only link to /order/start/roof-inspections is
 * Order this at the bottom of the roof service page."
 *
 * That was true. The firm has been open for ordering with one line, and the site
 * asked every reader to send an enquiry instead.
 *
 * WHY THIS IS A MODULE AND NOT A PROP PASSED AROUND. Six surfaces now ask the
 * same question: the hero, the chooser, the service cards on the home page, the
 * cards on /services, the roof page, and /process. Six copies of "is this line
 * orderable and what does it cost" is the two homes defect with five extra
 * homes, and the thing it would get wrong is a PRICE on a public page.
 *
 * ===========================================================================
 * ORDERABLE IS THREE FACTS AND ALL THREE ARE REQUIRED.
 * ===========================================================================
 *
 *   1. The operator LISTED the line in `offeredServiceLines`.
 *   2. The engineer APPROVED a protocol for it.
 *   3. The gate is OPEN, which is the firm's own switch plus the money path.
 *
 * `launch-conditions.ts` states the first two as a deliberate pair: "adding a
 * line is two acts... a slug added here with no approved protocol shuts the gate
 * and names itself, and a protocol approved for a line nobody listed changes
 * nothing at all." It also warns, in its own words, that deriving offered from
 * the protocol alone "is the obvious shortcut and it is the one thing this must
 * not do".
 *
 * `serviceLineIsOffered` was doing exactly that shortcut: it read the approved
 * protocol and never looked at the list. Today the two sets are identical, both
 * holding roof-inspections alone, so nothing was wrong on screen. What was wrong
 * is that a protocol approved for a line the operator had NOT listed would have
 * put that line on sale, which is the hazard that file is written to prevent.
 * Fixed there, and this module reads the fixed predicate.
 *
 * ===========================================================================
 * NOTHING HERE TYPES A PRICE.
 * ===========================================================================
 *
 * The figure comes from the catalogue entry, which fills itself from the price
 * book, which is the single home CLAUDE.md records as the sixth and worst of the
 * two-homes defects: the site published $549 while a card was charged $600, in a
 * file whose own header claimed the two could not drift. A price written into a
 * hero button would be the seventh.
 */

import { CATALOG, type CatalogEntry } from "@data/catalog";
import { services } from "@/content/services";
import { isOpen, serviceLineIsOffered } from "@/lib/launch";
import { isKnown } from "@/lib/ops-money";
/*
 * THE MARKETING FORMATTER, NOT THE ACCOUNTING ONE, AND THE CAPTURE CAUGHT IT.
 *
 * `ops-money`'s `money()` always prints two decimal places, because a ledger
 * line, a statement and a refund must. `prices.ts` exports its own, which drops
 * them for a whole number of dollars.
 *
 * The first version of this file imported the accounting one and the home page
 * hero rendered "$549.00, plus $75.00 in first tier coastal counties". The
 * operator's instruction says "$549, plus $75". It was found by looking at the
 * screenshot, which is the only way it could have been: both functions are
 * correct, both return a true figure, and no check in this repository asks which
 * dialect of money a marketing page is written in.
 */
import { money } from "@/config/prices";

export type LineOffer = {
  slug: string;
  /** The service name as the content file gives it. */
  name: string;
  /** Listed, approved, and the gate open. All three. */
  orderable: boolean;
  /** Where the primary button goes: the order flow, or the quote form. */
  href: string;
  /** What the primary button says on a card: short, and the same on every line. */
  cta: string;
  /**
   * What a button says when it has room for a sentence, as on the hero and the
   * chooser: "Order a roof certification letter".
   *
   * IT NAMES THE DELIVERABLE AND NOT THE SERVICE LINE, which is the difference
   * between what a reader buys and how the firm files it. The line is called
   * "Roof Inspections and Certifications", and "Order a roof inspections and
   * certifications" is not a sentence. The catalogue entry is called "Roof
   * certification letter", which is the thing that arrives.
   */
  orderLabel: string;
  /**
   * The headline price, already formatted, or null when the line has no
   * published fixed price. Null is not zero and is never rendered as one.
   */
  price: string | null;
  /**
   * The coastal line, named separately because the operator ruled it is "shown
   * to the customer as its own named line, never folded into a larger total".
   */
  coastal: string | null;
  /**
   * The deliverable a buyer of this line receives: "Roof certification letter".
   *
   * REMOVED AND THEN PUT BACK WITHIN THE HOUR, 2026-10-03, and both halves were
   * right. It was deleted when the chooser subtitles came off, because it then
   * had no reader and a value computed on every call and read by nothing is the
   * shape that survives for years looking load bearing.
   *
   * It is back because the operator ruled that the chooser's intro must NAME the
   * open line and derive that name from the gate rather than hardcode it. That
   * is a real reader, so the field earns its place again.
   *
   * The lesson is not "do not delete". It is that a declaration is kept by a
   * caller and nothing else, and when the caller goes the field should go with
   * it, even if something wants it back a commit later. The alternative is a
   * type where nobody can tell which fields are live.
   */
  deliverable: string | null;
};

/** The catalogue entry a price is quoted from: the cheapest orderable one. */
function headlineEntry(slug: string): CatalogEntry | null {
  const forLine = CATALOG.filter((e) => e.serviceSlug === slug && isKnown(e.priceCents));
  if (forLine.length === 0) return null;
  return forLine.reduce((lowest, e) => (e.priceCents! < lowest.priceCents! ? e : lowest));
}

/**
 * What this one line offers a reader today.
 *
 * TOTAL BY CONSTRUCTION. Every service line gets an answer, and a line that
 * cannot be ordered gets the quote path rather than nothing, because a card with
 * no action on it is a card a reader cannot act on and the operator's third
 * instruction is that no card may imply a line can be ordered when it cannot.
 */
export function lineOffer(slug: string): LineOffer {
  const service = services.find((s) => s.slug === slug);
  const name = service?.name ?? slug;
  const entry = headlineEntry(slug);
  const orderable = isOpen() && serviceLineIsOffered(slug);

  return {
    slug,
    name,
    orderable,
    href: orderable ? `/order/start/${slug}` : `/contact?service=${encodeURIComponent(slug)}`,
    cta: orderable ? "Order online" : "Request a quote",
    orderLabel: orderable
      ? entry
        ? `Order a ${entry.name.toLowerCase()}`
        : `Order ${name.toLowerCase()}`
      : "Request a quote",
    /*
     * THE PRICE IS SHOWN ONLY WHERE IT CAN BE ACTED ON. A figure beside a line
     * a reader cannot buy is an invitation to try, and the operator's rule is
     * that nothing may imply a line is orderable when it is not. The service
     * pages publish their own prices separately and that is a different claim:
     * there the number answers "what does this cost", here it answers "what will
     * you be charged if you press this".
     */
    price: orderable && entry && isKnown(entry.priceCents) ? money(entry.priceCents) : null,
    coastal:
      orderable && entry && isKnown(entry.coastalSurchargeCents)
        ? `plus ${money(entry.coastalSurchargeCents)} in first tier coastal counties`
        : null,
    /*
     * Not gated on `orderable`, unlike the price and the coastal line. Those two
     * are things a reader can act on and must not appear beside a line nobody can
     * buy. This is simply what the deliverable is called, which is true whether
     * the line is open or shut, and the chooser's intro needs it for the line
     * that IS open.
     */
    deliverable: entry?.name ?? null,
  };
}

/** Every service line, in the order the content file declares them. */
export function allLineOffers(): LineOffer[] {
  return services.map((s) => lineOffer(s.slug));
}

/**
 * The lines a reader can order right now.
 *
 * DERIVED, NEVER LISTED, which is the operator's instruction in his own words:
 * "driven by offeredServiceLines so new lines appear automatically when they
 * open". Nothing anywhere names a slug.
 */
export function orderableLineOffers(): LineOffer[] {
  return allLineOffers().filter((o) => o.orderable);
}

/**
 * The one line to put on a hero button, or null when none is orderable.
 *
 * The cheapest orderable line, so the headline figure is the lowest true price
 * rather than whichever line happens to sort first. With one line open this is
 * that line; the tie break only starts to matter on the day a second opens, and
 * it should not be the day somebody discovers there was no rule.
 */
export function headlineOffer(): LineOffer | null {
  const open = orderableLineOffers();
  if (open.length === 0) return null;
  const priced = open.filter((o) => o.price !== null);
  const pool = priced.length > 0 ? priced : open;
  return pool.reduce((lowest, o) => {
    const a = headlineEntry(o.slug)?.priceCents ?? Number.MAX_SAFE_INTEGER;
    const b = headlineEntry(lowest.slug)?.priceCents ?? Number.MAX_SAFE_INTEGER;
    return a < b ? o : lowest;
  });
}
