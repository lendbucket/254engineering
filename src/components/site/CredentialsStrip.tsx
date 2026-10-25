import { Container } from "@/components/ui/Container";
import { business } from "@/config/business";
import { peInResponsibleCharge, registrationStatement, tbpelsFirmNumber } from "@/lib/launch";

/**
 * The credentials strip.
 *
 * Every line here is either verifiable today or states plainly that it is not
 * yet in place. That is not caution for its own sake: the readers this strip
 * exists for, contracting officers and underwriters, check these, and a
 * credential that does not check out costs more than the three it sits beside
 * are worth.
 *
 * The TBPELS line is the compliance gate rendering a credential instead of a
 * disclosure once the registration is active. See src/lib/launch.ts.
 */
export function CredentialsStrip() {
  const firmNumber = tbpelsFirmNumber();
  const pe = peInResponsibleCharge();

  const items: { label: string; value: string }[] = [
    {
      label: "Firm registration",
      value: firmNumber
        ? `TBPELS Firm No. ${firmNumber}`
        : (registrationStatement() ?? "No firm registration is on record"),
    },
    /*
     * The second gate, on its own line, and ONLY when it is met. Its other
     * branch denied that an engineer of record was in place and came out on
     * the operator's ruling of 2026-10-21 under the 2026-09-17 rule: no
     * sentence says no engineer is in responsible charge. A lapsed register
     * now drops the line rather than printing that.
     */
    ...(pe
      ? [{ label: "Engineer of record", value: "A licensed Texas Professional Engineer is in responsible charge" }]
      : []),
    /*
     * THREE OF THE FIVE CAME OUT ON 2026-09-17, AND THE REASONS DIFFER.
     *
     * "Federal contracting" asserted a SAM.gov registration the firm has never
     * held, and its false branch said "registration in progress", which asserts
     * one has been started. Both are untrue, so the line is gone rather than
     * switched.
     *
     * "Small business status" said an SDVOSB certification was pending. The
     * firm has not applied. The careful sentence on /government that followed
     * it, saying the firm does not represent itself as an SDVOSB for set aside
     * purposes, went with it: nobody writes a disclaimer about a status they
     * have no relationship with, so the pair still reads as a claim.
     *
     * "Ownership: Veteran owned" is TRUE and came out anyway. This strip is
     * labelled as credentials in its own accessible name, and a true fact about
     * the owner sitting in a credential list is read as a credential. It is now
     * prose on /about, where it says the same thing and claims nothing.
     */
  ];

  return (
    <section aria-label={`${business.name} credentials`} className="border-b border-limestone-line">
      <Container>
        <div className="py-12 sm:py-14">
          <ul className="grid gap-8 sm:grid-cols-2 lg:gap-8">
            {items.map((item) => (
              <li key={item.label}>
                <span aria-hidden="true" className="block h-px w-8 bg-brass" />
                <p className="mt-4 font-sans text-[0.7rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
                  {item.label}
                </p>
                <p className="mt-2 text-[0.95rem] leading-[1.6] text-slate">{item.value}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
