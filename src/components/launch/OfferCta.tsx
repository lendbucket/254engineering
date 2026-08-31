import { ButtonLink, Eyebrow } from "@/components/ui/primitives";
import { Container } from "@/components/ui/Container";
import { isPrelaunch } from "@/lib/launch";
import { displayPhone, telHref } from "@/config/contact";

/**
 * The call to action, in both launch modes.
 *
 * Every page that would otherwise say "order this" renders this component
 * instead. In prelaunch it offers the waitlist and says plainly why. In live
 * mode it offers the service.
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
  headline,
  body,
}: {
  service?: string;
  headline?: string;
  body?: string;
}) {
  const prelaunch = isPrelaunch();
  const phone = displayPhone();
  const tel = telHref();
  const waitlistHref = service ? `/waitlist?service=${encodeURIComponent(service)}` : "/waitlist";

  return (
    <section className="bg-slate text-slate-fg">
      <Container>
        <div className="py-16 sm:py-20">
          <div className="max-w-2xl">
            <Eyebrow onDark>{prelaunch ? "Opening soon" : "Start a project"}</Eyebrow>
            <h2 className="mt-3 text-[1.8rem] leading-[1.2] font-semibold text-slate-fg sm:text-[2.2rem]">
              {headline ??
                (prelaunch
                  ? "Join the waitlist and we will contact you when the firm opens"
                  : "Tell us what you need and we will scope it")}
            </h2>
            <p className="mt-5 text-[1.02rem] leading-[1.7] text-slate-fg-muted">
              {body ??
                (prelaunch
                  ? "254 Engineering Services is not yet accepting engineering work. Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending. Join the waitlist and you will hear from us directly when it is active, before any general announcement."
                  : "Send the address, the scope, and the date it has to be in hand. You will get a straight answer on whether it is work this firm should take and what it involves.")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={prelaunch ? waitlistHref : "/contact"} tone="onDark">
                {prelaunch ? "Join the waitlist" : "Contact the firm"}
              </ButtonLink>
              {tel && phone ? (
                <ButtonLink href={tel} tone="onDarkOutline">
                  Call {phone}
                </ButtonLink>
              ) : prelaunch ? (
                <ButtonLink href="/about" tone="onDarkOutline">
                  How the firm works
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
