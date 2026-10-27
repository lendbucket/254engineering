import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { headlineOffer, inSentence } from "@/lib/ordering";
import { ORDERABLE_STEPS } from "@/content/ordering-steps";

/**
 * HOW ORDERING WORKS, THE SHORT FORM, UNDER THE HEADLINE OFFER. Ruling 7 of
 * 2026-10-18 and Q8 of 2026-10-19.
 *
 * The step names of the headline line in one row, each linking to that step
 * on the line's own service page, never to the long post, so the order door
 * stays on the capability page (ruling 1). One line beside it for every other
 * service. Nothing renders when no line is orderable or the orderable line has
 * no written steps: the quote and waitlist paths are on each service page.
 */
export function HomeOrderingSteps() {
  const offer = headlineOffer();
  const steps = offer ? ORDERABLE_STEPS[offer.slug] : undefined;
  if (!offer || !steps || steps.length === 0) return null;

  return (
    <section aria-labelledby="home-ordering" className="border-b border-limestone-line bg-white">
      <Container>
        <div className="py-10 sm:py-12">
          <h2 id="home-ordering" className="font-display text-[1.25rem] leading-[1.3] font-semibold text-slate">
            How ordering works
          </h2>
          <p className="mt-2 text-[0.98rem] leading-[1.6] text-slate-muted">
            {offer.deliverable ? `A ${inSentence(offer.deliverable)}, ordered online:` : `${offer.name}, ordered online:`}
          </p>
          <ol className="mt-5 flex flex-wrap gap-x-2 gap-y-3">
            {steps.map((step, i) => (
              <li key={step.id} className="text-[14px] leading-[1.5]">
                <Link
                  href={`/services/${offer.slug}#step-${step.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line px-3 font-semibold text-slate hover:border-slate"
                >
                  {i + 1}. {step.name}
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[0.98rem] leading-[1.6] text-slate-muted">
            Every other service is quoted:{" "}
            <Link href="/order" className="font-semibold text-slate underline underline-offset-4">
              tell the firm what you need
            </Link>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
