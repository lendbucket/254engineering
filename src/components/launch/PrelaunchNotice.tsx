import Link from "next/link";
import { isPrelaunch } from "@/lib/launch";

/**
 * The service page disclosure.
 *
 * Renders nothing at all in live mode, which is why it can be dropped into every
 * service and region page unconditionally. In prelaunch it sits directly under
 * the H1, above the description of the service, so that a reader cannot form the
 * impression that the work is being offered and only then find the correction.
 *
 * Set as a note rather than as a warning banner on purpose. A red alert bar
 * reads as an outage; this is a firm stating where it is in its own formation,
 * which is ordinary and is best set in the register of a footnote on a document.
 */
export function PrelaunchNotice({ service }: { service?: string }) {
  if (!isPrelaunch()) return null;

  const waitlistHref = service ? `/waitlist?service=${encodeURIComponent(service)}` : "/waitlist";

  return (
    <aside className="rounded-[3px] border border-brass/45 bg-limestone-raised px-5 py-4 sm:px-6 sm:py-5">
      <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
        Opening soon
      </p>
      <p className="mt-2.5 text-[0.96rem] leading-[1.65] text-slate-muted">
        254 Engineering Services is not yet accepting engineering work. Firm registration with the
        Texas Board of Professional Engineers and Land Surveyors is pending, no engineer of record is
        yet in responsible charge, and this page describes a service the firm is being built to
        deliver.{" "}
        <Link
          href={waitlistHref}
          className="font-medium text-slate underline decoration-brass/60 underline-offset-4 transition-colors hover:decoration-brass"
        >
          Join the waitlist
        </Link>{" "}
        and you will hear directly when it is active.
      </p>
    </aside>
  );
}
