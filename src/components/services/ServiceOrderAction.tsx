import Link from "next/link";
import { lineOffer } from "@/lib/ordering";

/**
 * The order, or the quote, at the TOP of a service page.
 *
 * Operator ruling, 2026-10-03, instruction 4: "Roof service page: an Order
 * button with the price near the top, not only at the bottom."
 *
 * WHY IT IS A COMPONENT AND NOT MARKUP IN THE PAGE. The page is one template
 * rendering eight service lines, so markup there is markup on all eight, and the
 * answer differs per line. This asks `lineOffer` the same question every other
 * surface asks, which is the whole point of that module existing.
 *
 * WHY IT RENDERS SOMETHING FOR EVERY LINE RATHER THAN ONLY THE ORDERABLE ONE.
 * A page with a button on it and seven without reads as seven broken pages. The
 * quote path is a real path and it is the one the firm actually wants for a line
 * it has not opened, so it gets the same prominence and different words.
 *
 * NO PROMISED DATE, which is both the operator's V10 instruction and the
 * standing compliance rule: turnaround statements stay qualitative while the
 * gate governs what this firm may say about sealed work.
 */
export function ServiceOrderAction({ slug }: { slug: string }) {
  const offer = lineOffer(slug);

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link
          href={offer.href}
          className={
            offer.orderable
              ? "inline-block rounded-[3px] bg-brass px-7 py-3.5 text-[16px] font-bold text-slate-ink transition-colors hover:bg-brass-light"
              : "inline-block rounded-[3px] border-[1.5px] border-white/50 px-7 py-3.5 text-[16px] font-semibold text-slate-fg transition-colors hover:border-brass hover:text-brass-light"
          }
        >
          {offer.orderLabel}
        </Link>
        {/*
          The price beside the button rather than inside it, for the reason the
          hero states: a figure on a button face competes with the verb and wraps
          badly at 390. The coastal surcharge keeps its own clause, never folded
          into the first number.
        */}
        {offer.price ? (
          <p className="text-[15px] leading-[1.6] text-slate-fg-muted">
            <span className="font-semibold text-slate-fg">{offer.price}</span>
            {offer.coastal ? `, ${offer.coastal}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
