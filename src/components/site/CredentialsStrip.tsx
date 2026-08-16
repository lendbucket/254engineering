import { Container } from "@/components/ui/Container";
import { business, samRegistration } from "@/config/business";
import { tbpelsFirmNumber } from "@/lib/launch";

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

  const items: { label: string; value: string }[] = [
    {
      label: "Firm registration",
      value: firmNumber
        ? `TBPELS Firm No. ${firmNumber}`
        : "Pending with the Texas Board of Professional Engineers and Land Surveyors",
    },
    {
      label: "Ownership",
      value: "Veteran owned",
    },
    {
      label: "Federal contracting",
      value: samRegistration.registered
        ? "Registered in SAM.gov for federal and state contracting"
        : "SAM.gov registration in progress",
    },
    {
      label: "Small business status",
      value: "Service Disabled Veteran Owned Small Business certification pending",
    },
  ];

  return (
    <section aria-label={`${business.name} credentials`} className="border-b border-limestone-line">
      <Container>
        <div className="py-12 sm:py-14">
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
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
