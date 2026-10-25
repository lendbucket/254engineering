import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { lineOffer } from "@/lib/ordering";
import { orderingStepsFor } from "@/content/ordering-steps";

/**
 * The section on a service page. Numbered, one sentence or two per step, and
 * each step carries an anchor so the homepage row can point at it.
 */
export function HowOrderingWorks({ slug }: { slug: string }) {
  const { state, steps } = orderingStepsFor(slug);
  if (steps.length === 0) return null;
  const offer = lineOffer(slug);

  return (
    <section id="how-ordering-works" className="border-b border-limestone-line">
      <Container>
        <div className="py-14 sm:py-18">
          <h2 className="font-display text-[1.6rem] leading-[1.2] font-semibold text-slate sm:text-[1.9rem]">
            How ordering works
          </h2>
          <p className="mt-3 max-w-[62ch] text-[1rem] leading-[1.7] text-slate-muted">
            {state === "orderable"
              ? "From the order to the sealed letter, as the platform and the engineer's signed protocol carry it out."
              : state === "waitlist"
                ? "The firm is not yet taking orders. This is what joining the waitlist does."
                : "This service is quoted. This is what happens when you ask."}
          </p>
          <ol className="mt-9 grid max-w-[70ch] gap-7">
            {steps.map((step, i) => (
              <li key={step.id} id={`step-${step.id}`} className="grid grid-cols-[2.2rem_1fr] gap-x-3">
                <span className="font-display text-[1.15rem] leading-[1.4] font-semibold text-brass-ink">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[1.02rem] leading-[1.4] font-semibold text-slate">{step.name}</h3>
                  <p className="mt-1.5 text-[0.98rem] leading-[1.7] text-slate-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-9">
            <Link
              href={offer.href}
              className="text-[15px] font-semibold text-slate underline underline-offset-4 hover:text-brass-ink"
            >
              {offer.orderLabel}
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
