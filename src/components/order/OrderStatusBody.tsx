import type { CustomerView } from "@/lib/ops-customer";
import { FIRM_TIME_ZONE } from "@/lib/firm-calendar";

const LABEL = "v10-label";

/**
 * WHAT A CUSTOMER SEES OF ONE ORDER, from the refund notice to the terms they
 * were told before they paid. Moved here from /order/[reference] on
 * 2026-10-10 (decision 6) so the account's own order page renders the same
 * body and the two cannot drift into two accounts of one order.
 *
 * `letterHref` is how a sealed letter is fetched, and it is the only thing that
 * differs: the token page links through the token, the account page through
 * the signed in account. Null shows no link.
 */
export function OrderStatusBody({
  view,
  letterHref,
}: {
  view: CustomerView;
  letterHref: ((documentId: string) => string) | null;
}) {
  return (
    <>
      {view.refunded ? (
        <div className="mt-7 border-l-2 border-[var(--color-slate)] pl-4">
          <p className="text-[15px] font-semibold text-[var(--color-ink)]">
            {view.refunded.amount} has been refunded
          </p>
          <p className="mt-1.5 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
            {view.refunded.because}. {view.refunded.retained} was retained, which is the
            inspection that was carried out and was disclosed before you paid. You receive what
            the engineer found and why they could not seal it.
          </p>
        </div>
      ) : null}

      <section className="mt-12">
        <h2 className={LABEL}>Where it is</h2>
        <p className="mt-3 text-[17px] leading-[1.55] font-semibold text-[var(--color-ink)]">
          {view.statusLine}
        </p>
      </section>

      {/*
        THE SEALED LETTER, WHEN THERE IS ONE. Sealing piece two, 2026-10-07.
        The link carries the same token that opened this page, and the route
        behind it serves the letter only if it is sealed, on this order's own
        file, with a live seal, and still hashes to what was sealed.
      */}
      {view.letters.length > 0 && letterHref ? (
        <section className="mt-12">
          <h2 className={LABEL}>Your sealed letter</h2>
          <ul className="mt-3 space-y-2">
            {view.letters.map((letter) => (
              <li key={letter.id}>
                <a
                  href={letterHref(letter.id)}
                  className="inline-flex min-h-[44px] items-center text-[17px] font-semibold text-[var(--color-ink)] underline underline-offset-4"
                >
                  Download {letter.title} (PDF)
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        THE DOT RAIL, AND IT SHOWS ONLY WHAT HAPPENED.

        V10C-tracker draws four stages with the unreached ones greyed, which
        reads as a promise that those stages are coming. `view.timeline` is
        the record of events that have OCCURRED: the platform does not model a
        customer facing plan of future stages, and drawing one from a typed
        list here would be a second account of the order's lifecycle with
        nothing able to notice when the two disagree.

        So every dot is filled, because every entry is something that
        happened. What is still to come is the sentence above, which comes
        from the same view as the rest.
      */}
      {view.timeline.length > 0 ? (
        <section className="mt-12">
          <h2 className={LABEL}>What has happened</h2>
          <ol className="mt-5">
            {view.timeline.map((entry, i) => (
              <li key={entry.at} className="flex gap-4">
                {/*
                  V10's timeline, 2026-10-08: a 14px navy circle for a step
                  that happened and a 2px connector. Drawn as a mark and a
                  rule, not as filled boxes, so the page has no tinted ground.
                  Every entry here has happened, so every circle is filled.
                */}
                <div className="flex w-[14px] shrink-0 flex-col items-center" aria-hidden>
                  <svg className="mt-1 shrink-0" width="14" height="14" viewBox="0 0 14 14">
                    <circle cx="7" cy="7" r="7" fill="var(--color-slate)" />
                  </svg>
                  {i < view.timeline.length - 1 ? (
                    <span className="flex-1 border-l-2 border-[var(--color-slate)]" />
                  ) : null}
                </div>
                <div className={i < view.timeline.length - 1 ? "pb-6" : ""}>
                  <p className="text-[15px] leading-[1.5] font-semibold text-[var(--color-ink)]">
                    {entry.summary}
                  </p>
                  <p className="mt-1 text-[14px] text-[var(--color-ink-quiet)]">
                    {/* Central, labelled, operator ruling of 2026-10-08. It was the
                        server's own zone, which on the deployment is UTC. */}
                    {new Date(entry.at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: FIRM_TIME_ZONE,
                    })}{" "}
                    CT
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className={LABEL}>What you paid</h2>
        <dl className="mt-4 border-t border-[var(--color-limestone-line)]">
          {view.lines.map((line) => (
            <div
              key={line.label}
              className="flex items-baseline justify-between gap-4 border-b border-[var(--color-limestone-line)] py-3"
            >
              <dt className="text-[15px] text-[var(--color-ink-quiet)]">{line.label}</dt>
              <dd className="text-[15px] tabular-nums text-[var(--color-ink)]">{line.amount}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-[15px] font-semibold text-[var(--color-ink)]">Total</dt>
            <dd className="text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
              {view.total}
            </dd>
          </div>
        </dl>
      </section>

      {view.receives.length > 0 ? (
        <section className="mt-12">
          <h2 className={LABEL}>What you receive</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {view.receives.map((line) => (
              <li key={line} className="text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        A limit of what the firm provides, on its own line and never inside
        the list above. Operator ruling of 2026-10-08.
      */}
      {view.notes.length > 0 ? (
        <section className="mt-12">
          <h2 className={LABEL}>Notes</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {view.notes.map((line) => (
              <li key={line} className="text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.refundDisclosure ? (
        <section className="mt-12 border-t border-[var(--color-limestone-line)] pt-9">
          <h2 className={LABEL}>What you were told before you paid</h2>
          {/*
            * The stored text, verbatim, not a re-render of today's rule. If the
            * firm changes its terms next month, this order still shows the terms
            * this customer agreed to.
            */}
          <div className="mt-4 flex flex-col gap-3">
            {view.refundDisclosure.split("\n\n").map((para) => (
              <p key={para} className="text-[15px] leading-[1.7] text-[var(--color-ink-quiet)]">
                {para}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
