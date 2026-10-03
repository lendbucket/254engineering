import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { allLineOffers, orderableLineOffers } from "@/lib/ordering";
import { displayPhone, telHref } from "@/config/contact";

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

export const metadata: Metadata = buildMetadata({
  title: "Order engineering work | 254 Engineering Services",
  description:
    "Choose what you need. Lines open for online ordering show the price and take the order now. Everything else goes to a quote from the firm.",
  path: "/order",
});

export default function OrderChooserPage() {
  const offers = allLineOffers();
  const open = orderableLineOffers();
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
              {open.length === 0
                ? "Every line below is quoted by the firm. Tell us what the document is for and you will get a yes or no, and a price, from a person."
                : open.length === 1
                  ? "One line is open for ordering online and takes the order now. Everything else is quoted by the firm, usually after one short conversation."
                  : `${open.length} lines are open for ordering online and take the order now. Everything else is quoted by the firm, usually after one short conversation.`}
            </p>

            <ul className="mt-10 border-t border-[var(--color-limestone-line)]">
              {offers.map((offer) => (
                <li
                  key={offer.slug}
                  className="border-b border-[var(--color-limestone-line)] py-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <h2 className="text-[17px] leading-[1.3] font-semibold text-slate">
                      <Link href={`/services/${offer.slug}`} className="hover:text-brass-ink">
                        {offer.name}
                      </Link>
                    </h2>
                    {/*
                      THE PRICE SITS WITH THE ACTION AND ONLY WHERE THERE IS ONE.
                      A figure beside a line a reader cannot buy invites them to
                      try, which is the operator's third instruction: never imply
                      a line can be ordered when it cannot.
                    */}
                    {offer.price ? (
                      <p className="text-[17px] font-semibold text-slate">{offer.price}</p>
                    ) : null}
                  </div>

                  {offer.deliverable ? (
                    <p className="mt-1.5 text-[14px] leading-[1.6] text-slate-muted">
                      {offer.deliverable}
                      {offer.coastal ? `, ${offer.coastal}` : ""}
                    </p>
                  ) : null}

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
                  {phone}
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
