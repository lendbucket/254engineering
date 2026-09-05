import { deliverablesFor } from "@data/catalog";
import { fieldsFor } from "@data/intake-fields";

/**
 * WHAT AN ORDER ASKS FOR, ON THE SERVICE PAGE.
 *
 * Phase 10 Section 1.5 Section D. A page that lists what to gather converts
 * better and produces cleaner orders, and it costs nothing to write. What it
 * costs, if written by hand, is accuracy: a list that says one thing while the
 * form asks another is worse than no list, because somebody arrives prepared
 * for the wrong questions.
 *
 * So it is DERIVED from the same definition the form renders. It cannot drift,
 * because there is nothing to drift from: add a field and this list grows.
 *
 * THE WORDING IS GATE SAFE
 * ------------------------
 * "What an order asks for" describes the platform, not the firm's present
 * ability to perform. It says nothing about services being offered or performed
 * today, which is what voice-audit checks for while registration is pending,
 * and it stays true word for word after launch.
 */
export function WhatAnOrderAsks({ serviceSlug }: { serviceSlug: string }) {
  const deliverables = deliverablesFor(serviceSlug);
  if (deliverables.length === 0) return null;

  /*
   * Only the things a CUSTOMER can answer, and only the ones an order needs
   * before it can be placed. Listing what the firm gathers later would be
   * telling somebody to prepare for a question nobody will ask them, and
   * listing the sealing stage fields would make a short list long enough to
   * stop being read.
   */
  const asked = new Map<string, string>();
  for (const entry of deliverables) {
    for (const field of fieldsFor(entry.serviceSlug, entry.tier)) {
      if (field.audience !== "customer") continue;
      if (field.stage !== "order") continue;
      if (!field.required) continue;
      asked.set(field.id, field.label);
    }
  }

  if (asked.size === 0) return null;

  return (
    <section className="mt-12 rounded-[4px] border border-[var(--border)] bg-white p-6 sm:p-7">
      <h2 className="font-display text-[1.35rem] leading-[1.25] font-bold text-slate">
        What an order asks for
      </h2>
      <p className="mt-2.5 max-w-[62ch] text-[0.95rem] leading-[1.7] text-slate-fg-muted">
        Worth having to hand. Nothing here is unusual, and an order that arrives with
        it moves without anybody having to telephone back.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {[...asked.values()].map((label) => (
          <li key={label} className="flex gap-2.5 text-[0.95rem] leading-[1.6] text-slate">
            <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-gold" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
