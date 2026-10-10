import Link from "next/link";
import {
  isPrelaunch,
  notYetAcceptingEngagements,
  peInResponsibleCharge,
  registrationStatement,
} from "@/lib/launch";

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
 *
 * The treatment is v5's gold edged aside, the same object as the coverage note
 * on the homepage and the callouts on the region pages. It used to be a fully
 * outlined box, which was the only outlined box left on the site once the design
 * port landed and read as a component from a different system.
 *
 * REWRITTEN 2026-10-10, operator ruling. It said "Opening soon", typed "No
 * engineer of record is yet in responsible charge" whatever the register held,
 * and sent the reader to /waitlist, which is now a permanent redirect to
 * /contact. Each sentence is derived instead: the engineer line appears only
 * when the register holds no active engineer, and the link is an enquiry, which
 * the firm takes in every state.
 */
export function PrelaunchNotice({ service }: { service?: string }) {
  if (!isPrelaunch()) return null;

  const contactHref = service ? `/contact?service=${encodeURIComponent(service)}` : "/contact";
  const sentences = [
    notYetAcceptingEngagements(),
    registrationStatement(),
    peInResponsibleCharge() ? null : "No engineer of record is in responsible charge.",
  ].filter(Boolean);

  return (
    <aside className="border-l-4 border-brass bg-white/[0.07] px-5 py-[18px]">
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-light uppercase">
        Enquiries only
      </p>
      <p className="mt-2 text-[15px] leading-[1.65] text-slate-fg-muted">
        {sentences.join(" ")}{" "}
        <Link
          href={contactHref}
          className="font-medium text-slate-fg underline decoration-brass underline-offset-4 transition-colors hover:text-brass-light"
        >
          Send an enquiry
        </Link>{" "}
        and the firm will answer directly.
      </p>
    </aside>
  );
}
