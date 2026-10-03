import { ButtonLink, Eyebrow } from "@/components/ui/primitives";
import { Container } from "@/components/ui/Container";
import { isOpen, isPrelaunch, notYetAcceptingEngagements, registrationStatement, serviceLineIsOffered } from "@/lib/launch";
import { displayPhone, telHref } from "@/config/contact";
import { lineOffer, orderableLineOffers } from "@/lib/ordering";
import { PhoneNumber } from "@/components/ui/PhoneNumber";

/** The price line for a named, orderable service line. */
function OfferPrice({ slug }: { slug: string }) {
  const offer = lineOffer(slug);
  if (!offer.price) return null;
  return (
    <p className="mt-4 text-[15px] leading-[1.7] text-slate-fg-muted">
      <span className="font-semibold text-slate-fg">{offer.price}</span>
      {offer.coastal ? `, ${offer.coastal}` : ""}.
    </p>
  );
}

/**
 * The call to action, in all three launch modes.
 *
 * Every page that would otherwise say "order this" renders this component
 * instead, so one file decides what the whole site asks a reader to do. In
 * trading it offers an enquiry and the telephone. It offers an ORDER only on a
 * line whose protocol the engineer has approved.
 *
 * The prelaunch copy is written to be true rather than coy. "Opening soon" on
 * its own invites the reader to assume the firm is trading and merely busy;
 * naming the registration is both the honest version and, for the audience this
 * site is built for, the more credible one. Procurement officers and lenders
 * know exactly what firm registration is and what it means that it is pending.
 *
 * THE PHONE AFFORDANCE APPEARS ONLY WHEN THERE IS A PHONE
 * -------------------------------------------------------
 * A call option is the highest intent path on any page that has one, and it is
 * the first thing a contractor standing on a roof will reach for. It is also the
 * easiest thing on the site to fake, so it is rendered from the same config as
 * everything else in src/config/contact.ts and is simply absent while FIRM_PHONE
 * is unset, which is the current state. Nothing here degrades to a dead link or
 * a placeholder number: the button does not exist until the number does.
 */
export function OfferCta({
  /** The service being asked about, if the CTA sits on a service page. */
  service,
  /** The slug, when this sits on a service page and the line can be ordered. */
  serviceSlug,
  headline,
  body,
}: {
  service?: string;
  serviceSlug?: string;
  headline?: string;
  body?: string;
}) {
  /*
   * ==========================================================================
   * THREE STATES, AND THE MIDDLE ONE IS WHERE THE FIRM ACTUALLY IS.
   * Operator ruling, 2026-09-17 and 2026-09-18.
   * ==========================================================================
   *
   * THE DEFECT THIS FIXES, WHICH THE BOARD FOUND FIRST. When the gate left
   * prelaunch, this component fell through to its live branch and offered
   * "Order this" on every service page, linking to /order/start/<slug>. No line
   * has an approved protocol, so every one of those links led to a page that
   * refuses. cta-audit reported the pages as having no conversion path at all,
   * because its pattern does not recognise an order href, and the deeper truth
   * was worse than the report: they had one, and it went nowhere.
   *
   * WHAT TRADING OFFERS. The firm takes enquiries and quotes work. So the verb
   * is "Start a job", the operator's own word, and it goes to the contact
   * surface rather than the order flow. The telephone sits beside it because
   * half of these buyers would rather talk, and one of them is standing on a
   * roof.
   *
   * WHAT IT DOES NOT OFFER. A waitlist. The operator has ruled it off the site
   * entirely: somebody with a closing date does not join a waitlist, and
   * offering one to a registered firm's customer is an apology for a state the
   * firm is no longer in.
   *
   * THE ORDER BUTTON RETURNS PER LINE, NOT PER SITE. `serviceLineIsOffered`
   * answers for one slug, so the day the engineer approves the roof protocol
   * that page offers an order and the other eight go on offering an enquiry.
   */
  const prelaunch = isPrelaunch();
  const phone = displayPhone();
  const tel = telHref();
  const lineIsOrderable = Boolean(serviceSlug && isOpen() && serviceLineIsOffered(serviceSlug));

  /*
   * ==========================================================================
   * WITH NO SERVICE NAMED, THIS NOW LEADS TO THE CHOOSER RATHER THAN A FORM.
   * Operator ruling, 2026-10-03, instructions 2 and 5.
   * ==========================================================================
   *
   * This component closes /process, /about, the coverage pages and more, and on
   * every one of them without a `serviceSlug` it said "Start a job" and went to
   * /contact. So the firm's own "how it works" page walked a reader through five
   * steps and then asked them to write a message.
   *
   * Instruction 5 is that /process ends in an Order button. Rather than special
   * casing that one page, the generic branch now goes to /order, which asks what
   * they need and gives every open line a price and an Order button. That is the
   * same destination instruction 2 gives the header button, so the two most
   * common ways into "I want to buy something" agree.
   *
   * AND WHERE A SINGLE LINE IS ORDERABLE IT SKIPS THE CHOOSER ENTIRELY. A
   * chooser with one Order row and seven quote rows is a page between the reader
   * and the thing they came for. `headlineOffer()` answers with that line when
   * there is exactly one, so the button orders it by name.
   *
   * PRELAUNCH IS UNTOUCHED AND GOES ON USING /contact. With the gate shut there
   * is nothing to choose between, and the chooser's own sentence about lines
   * being open would be the wrong thing to show somebody the firm cannot serve
   * yet.
   */
  const open = orderableLineOffers();
  const soleOffer = open.length === 1 ? open[0] : null;
  const enquiryHref = prelaunch ? "/contact" : "/order";
  const genericOrder = !serviceSlug && !prelaunch && open.length > 0;

  /*
   * THE ARGUMENT THAT USED TO SIT HERE IS SUPERSEDED, AND IT IS WORTH SAYING
   * WHY RATHER THAN DELETING IT. It said the order page renders its own refusal
   * with the reason, so linking to it unconditionally is honest and a missing
   * button looks broken. That was right when the refusal was temporary and
   * site wide. It is wrong now: under trading the refusal would be permanent
   * per line, and sending every reader to a page that turns them away is not
   * honesty, it is a dead end with an explanation attached. The enquiry is a
   * real path, so it is the one offered.
   */
  const orderHref = serviceSlug ? `/order/start/${serviceSlug}` : enquiryHref;

  return (
    <section className="bg-slate text-slate-fg">
      <Container>
        <div className="py-16 sm:py-20">
          <div className="max-w-2xl">
            <Eyebrow onDark>{prelaunch ? "Opening soon" : "Start a job"}</Eyebrow>
            <h2 className="mt-3 text-[1.8rem] leading-[1.2] font-semibold text-slate-fg sm:text-[2.2rem]">
              {headline ??
                (prelaunch
                  ? "Tell us what you need and we will contact you when the firm opens"
                  : "Tell us what the letter is for and we will tell you yes or no")}
            </h2>
            <p className="mt-5 text-[1.02rem] leading-[1.7] text-slate-fg-muted">
              {body ??
                (prelaunch
                  ? [notYetAcceptingEngagements(), registrationStatement()].filter(Boolean).join(" ")
                  : "Send the address, what the document is for, and the date it has to be in hand. Some jobs this firm cannot take, and you will hear that in the first conversation rather than after you have paid and waited.")}
            </p>
            {/*
              MOBILE FIRST, AND THAT IS NOT A LAYOUT PREFERENCE HERE. Stacked
              full width at 390 and side by side from 640, because the reader
              this block is written for is often holding a phone on a roof. The
              telephone is a first class button rather than a link in prose for
              the same reason.
            */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href={
                  lineIsOrderable
                    ? orderHref
                    : genericOrder && soleOffer
                      ? soleOffer.href
                      : enquiryHref
                }
                tone="onDark"
              >
                {lineIsOrderable
                  ? "Order this"
                  : genericOrder && soleOffer
                    ? soleOffer.orderLabel
                    : "Start a job"}
              </ButtonLink>
              {tel && phone ? (
                <ButtonLink href={tel} tone="onDarkOutline">
                  Call <PhoneNumber />
                </ButtonLink>
              ) : null}
            </div>
            {/*
              The price under the button, the same treatment the hero and the
              service pages use, so a reader meets the figure in one shape
              wherever the firm offers them something.
            */}
            {lineIsOrderable && serviceSlug ? <OfferPrice slug={serviceSlug} /> : null}
            {genericOrder && soleOffer?.price ? (
              <p className="mt-4 text-[15px] leading-[1.7] text-slate-fg-muted">
                <span className="font-semibold text-slate-fg">{soleOffer.price}</span>
                {soleOffer.coastal ? `, ${soleOffer.coastal}` : ""}.
              </p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
