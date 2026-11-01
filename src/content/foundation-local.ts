import { serviceBySlug, type Faq } from "./services";
import { FIRST_TIER_COASTAL } from "./windstorm";
import { CATALOG } from "@data/catalog";
import { money, priceSentence } from "@/config/prices";
import { contact, hoursLine, postalAddressLine } from "@/config/contact";
import { isKnown } from "@/lib/ops-money";

/**
 * THE FOUNDATION QUESTION, ANSWERED WHERE IT IS ASKED. Robert's GEO ruling of
 * 2026-10-31, item 5: /services/foundation-inspections and /san-antonio answer
 * "structural engineer foundation inspection San Antonio" with an answer of
 * about fifty words carrying the price and turnaround from the catalog, what
 * the visit covers and what the letter contains, the office's address and
 * hours, and an FAQ marked up as FAQPage. /corpus-christi gets the same
 * pattern without an address (CLAUDE.md section 2, the ruling of 2026-10-29).
 *
 * NOTHING HERE IS A SECOND HOME. The price is the price book's sentence, the
 * coastal difference is the catalog's, the turnaround is the catalog's own
 * sentence, the address and hours are contact.ts's derivers, the visit is the
 * service page's own paragraph, and whether a county pays the coastal
 * difference is read from FIRST_TIER_COASTAL. What the letter contains is not
 * read here at all: each page reads the service's deliverable through
 * deliverableAsSigned, so a voided FC-001 signature takes it off these pages
 * exactly as it does the service page (scope-quote.ts, ALSO_QUOTED_ON).
 *
 * WHAT IS PLACE SPECIFIC, so neither page is the other with the name swapped:
 * San Antonio states the office, its hours, and that Bexar County pays no
 * coastal difference; Corpus Christi states the total with the difference,
 * because Nueces County is first tier, that the office is elsewhere, and how
 * the ground under the city changes the reading.
 */

const FOUNDATION = "foundation-inspections";

const ENTRY = CATALOG.find((e) => e.serviceSlug === FOUNDATION);
if (!ENTRY || !isKnown(ENTRY.priceCents)) {
  throw new Error("foundation-local: the catalog has no priced foundation deliverable to quote");
}
const PRICE_CENTS: number = ENTRY.priceCents;
const SURCHARGE_CENTS: number | null = isKnown(ENTRY.coastalSurchargeCents) ? ENTRY.coastalSurchargeCents : null;

const PRICE = priceSentence(FOUNDATION) ?? money(PRICE_CENTS);

/** The catalog's own turnaround sentence, carried verbatim. */
export const FOUNDATION_TURNAROUND: string = ENTRY.turnaround;

function paysCoastal(county: string): boolean {
  return (FIRST_TIER_COASTAL as readonly string[]).includes(county);
}

/** The visit, as the service page itself describes it. */
export function foundationVisit(): string {
  const service = serviceBySlug(FOUNDATION);
  const paragraph = service?.what.find((p) => p.startsWith("The inspection records"));
  if (!paragraph) throw new Error("foundation-local: the service page no longer describes the visit");
  return paragraph;
}

const HOW =
  "A technician measures floor elevations and documents the structure, drainage, and site; the engineer reviews all of it before an opinion is written.";

/**
 * The answer, about fifty words. The service page and /san-antonio share it,
 * because the service page is answering the San Antonio question too.
 */
export function foundationAnswer(): string {
  const coastal = SURCHARGE_CENTS !== null ? `, plus ${money(SURCHARGE_CENTS)} in first tier coastal counties` : "";
  return `254 Engineering's foundation inspection in ${contact.city} is ${PRICE}${coastal}. ${HOW} ${FOUNDATION_TURNAROUND}`;
}

/** The Corpus Christi answer: the total a Nueces County property pays. */
export function foundationAnswerCorpusChristi(): string {
  const coastal =
    SURCHARGE_CENTS !== null && paysCoastal("Nueces")
      ? ` is ${money(PRICE_CENTS + SURCHARGE_CENTS)}: the ${PRICE} price plus ${money(SURCHARGE_CENTS)}, because Nueces County is a first tier coastal county`
      : ` is ${PRICE}`;
  return `254 Engineering's foundation inspection in Corpus Christi${coastal}. ${HOW} ${FOUNDATION_TURNAROUND}`;
}

/**
 * The answer a service page leads with, or null. Only the foundation line has
 * one (item 5), and the page asks by slug so it names none itself.
 */
export function serviceAnswer(serviceSlug: string): { answer: string; office: string | null } | null {
  return serviceSlug === FOUNDATION ? { answer: foundationAnswer(), office: officeLine() } : null;
}

/** The office line under the answer, or null while no street is recorded. */
export function officeLine(): string | null {
  const address = postalAddressLine();
  return address ? `Office: ${address}. Hours: ${hoursLine()}.` : null;
}

export function sanAntonioFoundationFaqs(): Faq[] {
  const address = postalAddressLine();
  const bexar =
    SURCHARGE_CENTS !== null && !paysCoastal("Bexar")
      ? ` Bexar County is not one of the fourteen first tier coastal counties, so the ${money(SURCHARGE_CENTS)} coastal difference does not apply to a property in the city.`
      : "";
  return [
    {
      q: "How much is a foundation inspection in San Antonio?",
      a: `${PRICE}.${bexar}`,
    },
    ...(address
      ? [
          {
            q: "Where is the office, and when is it open?",
            a: `The office is at ${address}. Its hours are ${hoursLine()}.`,
          },
        ]
      : []),
    {
      q: "When does the engineer review the record?",
      a: `${FOUNDATION_TURNAROUND} The technician's visit gathers the evidence and reaches no conclusion; the opinion is the engineer's, written after the review.`,
    },
  ];
}

export function corpusChristiFoundationFaqs(): Faq[] {
  const total =
    SURCHARGE_CENTS !== null && paysCoastal("Nueces")
      ? `${money(PRICE_CENTS + SURCHARGE_CENTS)}: the ${PRICE} price plus ${money(SURCHARGE_CENTS)}, because Nueces County is one of the fourteen first tier coastal counties.`
      : `${PRICE}.`;
  return [
    {
      q: "How much is a foundation inspection in Corpus Christi?",
      a: total,
    },
    {
      q: "Is there an office in Corpus Christi?",
      a: `No. The firm's office is in ${contact.city}, and its street address and hours are on the contact page.`,
    },
    {
      q: "Does the ground under Corpus Christi change the reading?",
      a: "The visit is the same; the reading is not. On the bluff and in the older inland neighborhoods, Victoria and Orelia clays move seasonally enough to matter to a slab. Toward the bays, sandy deposits and a shallow water table make bearing the question instead. The engineer reads the measurements against the ground they sit on.",
    },
  ];
}
