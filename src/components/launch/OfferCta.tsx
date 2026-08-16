import { ButtonLink, Eyebrow } from "@/components/ui/primitives";
import { Container } from "@/components/ui/Container";
import { isPrelaunch } from "@/lib/launch";

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
              {prelaunch ? (
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
