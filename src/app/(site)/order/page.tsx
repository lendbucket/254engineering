import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { PublishedPrice } from "@/components/services/PublishedPrice";
import { sellableLineOffers } from "@/lib/line-gate";
import { inSentence } from "@/lib/ordering";
import { displayPhone, telHref } from "@/config/contact";
import { PhoneNumber } from "@/components/ui/PhoneNumber";

/**
 * ===========================================================================
 * THE CHOOSER. "What do you need?" and then one press.
 * Operator ruling, 2026-10-03, instruction 2.
 * ===========================================================================
 *
 * "Start a job and the header Contact the Firm button: lead to a short chooser.
 * Lines open for online ordering show price and an Order button; other lines
 * show Request a quote to /contact with the service preselected."
 *
 * WHAT IT REPLACES. Both of those led to /contact, which is a message form. A
 * reader who knows they want a roof certification had to write a paragraph about
 * it and wait, while the firm was open and could have taken the order.
 *
 * ===========================================================================
 * IT NAMES NO SERVICE LINE. NOT ONE.
 * ===========================================================================
 *
 * Every row is derived from `allLineOffers()`, which walks the service content
 * and asks the gate about each. That is the operator's instruction in his own
 * words: "driven by offeredServiceLines so new lines appear automatically when
 * they open". The day he lists a second line and Aman approves its protocol,
 * this page grows a second Order row and nobody edits it.
 *
 * It also means this page cannot be wrong in the one way that matters. A hand
 * written list is a list that says a line is orderable on the day it stops
 * being, and the reader finds out at a checkout that refuses.
 *
 * ===========================================================================
 * V10 DISCIPLINE ON A NEW SURFACE, WHICH IS NOT THE SAME AS RESTYLING THE SITE.
 * ===========================================================================
 *
 * The operator's "V10 rules: no color, no boxes, no dashes, no promised dates"
 * is read as binding on what is BUILT here rather than as an instruction to
 * convert the public site, which is v5 and has cards everywhere. So this page is
 * headings with rules, ruled rows, and words carrying every state. Nothing on it
 * is a tinted box and no row says when anything will be ready.
 */

/*
 * MEASURED AGAINST seo-audit's OWN BOUNDS, NOT COUNTED BY EYE.
 *
 * The first version was 49 characters against a floor of 50, and its description
 * was 138 against a floor of 140. Both would have failed, and the board passed
 * seo-audit anyway because this route was missing from the sitemap, which is
 * where that audit gets its subject. Two defects, each hiding the other.
 *
 * Title 56 of 50 to 60. Description 143 of 140 to 160.
 *
 * "usually after one call" came out on his ruling of 2026-10-03, with the same
 * reasoning as the intro sentence below: it is a soft promise about how fast the
 * firm answers. Removing it left 131, nine under the floor, so the replacement
 * was measured rather than guessed and "Start here." is a call to action rather
 * than padding.
 */
export const metadata: Metadata = buildMetadata({
  /* The brand is "254 Engineering" on public copy (standing rule); every row now shows its published price (ruling 5). */
  title: "Order engineering work online in Texas | 254 Engineering",
  description:
    "Choose what you need. Lines open online take the order now, and every other line starts with a quote at its published price. Start here and pick one.",
  path: "/order",
});

/* The half of the price story /process tells, said the same way here (gap 8, 2026-10-10). */
const PUBLISHED_IS_THE_QUOTE =
  "Where a line has a published price, that is the price you are quoted, with the coastal line where it applies.";

/*
 * DYNAMIC, AND EACH ORDERABLE ROW ASKED AT ITS MONEY DOOR. Robert's ruling of
 * 2026-10-24: an unsigned line is not offered here. Configuration alone would
 * show an unsigned or untrained line with a price and an Order button whose
 * next page refuses, so the rows come from sellableLineOffers, which turns any
 * line its door refuses into the quote row. That is a database read, so the page
 * is rendered per request rather than once at build.
 */
export const dynamic = "force-dynamic";

export default async function OrderChooserPage() {
  const offers = await sellableLineOffers();
  const open = offers.filter((o) => o.orderable);
  const phone = displayPhone();
  const tel = telHref();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Order", path: "/order" },
        ])}
      />

      <section>
        <Container>
          <div className="mx-auto max-w-[760px] py-14 sm:py-20">
            <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.4px] text-slate sm:text-[32px]">
              What do you need?
            </h1>

            {/*
              THE META LINE SAYS WHAT IS TRUE RIGHT NOW, derived both ways so it
              cannot drift from the rows underneath it. "Some lines" would be
              vague where a count is available, and a count typed by hand is the
              two homes defect on a public page.
            */}
            <p className="mt-3 text-[15px] leading-[1.7] text-slate-muted">
              {/*
                THE SINGULAR AND THE PLURAL ARE WRITTEN OUT SEPARATELY, because
                the first version interpolated a subject into one sentence and
                produced "One line is open for ordering online and take the order
                now". Found by reading the capture rather than by any check: it
                parses, it renders, and nothing in this repository audits
                agreement between a verb and a count that only becomes plural on
                the day a second line opens.
              */}
              {/*
                NO TIMEFRAME, NO COUNT OF CALLS, NO PROMISED DATE. Operator
                ruling, 2026-10-03: "usually after one short conversation" and
                "usually after one call" both came out. Each was a soft promise
                about how fast the firm answers, which is a claim about an
                engineer's capacity, and the standing rule is that turnaround
                statements stay qualitative while the gate governs what this firm
                may say about sealed work. "Quoted by the firm" is the honest
                shape: it says who does it and not when.

                THE OPEN LINE IS NAMED AND THE NAME IS DERIVED, which was his
                second instruction. It comes off the catalogue entry through
                `deliverable`, so the day a second line opens this sentence
                changes by itself.

                AND IT USES AN ARTICLE RATHER THAN A PLURAL, deliberately.
                Pluralising by adding "s" was tested against all eleven catalogue
                names and is wrong on three: "WPI-8E windstorm evaluation,
                completed constructions", "Structural letter for permits", and
                "Beam and header sizings". A pluralisation rule good enough for
                every name a future line might carry is a small piece of English
                grammar nobody should be writing into a marketing page, and
                getting it wrong is visible to every reader.
              */}
              {/*
                ONE PRICE STORY, operator ruling 2026-10-10 (gap 8). This said
                every other line "is quoted by the firm" and "we will send you a
                price", while /process says each line's price is published before
                you call. Both are now one sentence: a line not open online starts
                with a request for a quote, and where the line has a published
                price, that published price is the quote.
              */}
              {open.length === 0
                ? `Every line below starts with a request for a quote. ${PUBLISHED_IS_THE_QUOTE}`
                : open.length === 1 && open[0].deliverable
                  ? `A ${inSentence(open[0].deliverable)} can be ordered online now. Everything else starts with a request for a quote. ${PUBLISHED_IS_THE_QUOTE}`
                  : `${open.length} lines can be ordered online now. Everything else starts with a request for a quote. ${PUBLISHED_IS_THE_QUOTE}`}
            </p>

            <ul className="mt-10 border-t border-[var(--color-limestone-line)]">
              {offers.map((offer) => (
                <li
                  key={offer.slug}
                  className="border-b border-[var(--color-limestone-line)] py-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <h2 className="text-[17px] leading-[1.3] font-semibold text-slate">
                      <Link href={`/services/${offer.slug}`} className="hover:underline active:opacity-70">
                        {offer.name}
                      </Link>
                    </h2>
                  </div>

                  {/*
                    EVERY ROW STATES ITS PUBLISHED PRICE NOW, through the shared
                    component (ruling 5 of 2026-10-18). This used to show a figure
                    only beside an order button, on the operator's third
                    instruction that nothing may imply a line can be ordered when
                    it cannot, and /process meanwhile listed every figure. The
                    component keeps the instruction by saying, on any fixed price
                    a reader cannot order, that it is the price quoted until the
                    line opens online. The coastal line still travels with the
                    figure as its own clause.
                  */}
                  <p className="mt-2 text-[15px] leading-[1.6] text-slate-muted">
                    <PublishedPrice slug={offer.slug} orderable={offer.orderable} />
                  </p>

                  {/*
                    ===================================================
                    THE SUBTITLES ARE GONE. Operator ruling, 2026-10-03.
                    ===================================================

                    "Each line's subtitle repeats its title." It did:
                    "Foundation certification" sat under "Foundation Inspections
                    and Certifications", and six of the eight were the same shape.
                    It was the catalogue's deliverable name, which is the right
                    string in a basket and the wrong one under a heading that
                    already says it.

                    HIS RULE WAS: REPLACE IT WITH AN EXISTING FIELD VERBATIM, OR
                    REMOVE IT. `services.ts` does carry a who-it's-for field,
                    `whoOrders`, and seven of the eight first entries would have
                    read well here. The roof one is 215 characters across two
                    sentences, ending in a clause about remaining life figures on
                    lender checklists. Using it verbatim would put a paragraph in
                    a chooser row; using part of it would not be verbatim.

                    So the rule lands on remove, and removing it is what makes all
                    eight consistent, which was his fourth point. Residential and
                    Light Commercial Design had no subtitle at all because it is
                    hourly and has no priced catalogue entry, and that asymmetry
                    goes with the rest.

                    The row still carries the service name, the price, the coastal
                    qualifier and the action. Nothing a reader needs to choose
                    with has been taken away, and no sentence was invented to fill
                    the space.
                  */}

                  <div className="mt-4">
                    <Link
                      href={offer.href}
                      className={
                        offer.orderable
                          ? "inline-block rounded-[2px] bg-slate px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-slate-deep"
                          : "inline-block rounded-[2px] border border-[var(--color-limestone-edge)] px-6 py-3 text-[15px] font-semibold text-slate transition-colors hover:border-slate"
                      }
                    >
                      {offer.orderLabel}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {/*
              THE TELEPHONE LAST, AND ONLY WHEN THERE IS ONE. The same rule
              OfferCta states: the button does not exist until the number does,
              because a call option is the easiest thing on the site to fake.
            */}
            {tel && phone ? (
              <p className="mt-10 text-[15px] leading-[1.7] text-slate-muted">
                If you would rather talk it through, call{" "}
                <a href={tel} className="font-semibold text-slate underline underline-offset-4">
                  <PhoneNumber />
                </a>
                .
              </p>
            ) : null}
          </div>
        </Container>
      </section>
    </>
  );
}
