"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The order reference, and nothing else.
 *
 * A GET WITH THE REFERENCE IN THE URL, deliberately: an operator on the
 * telephone with a partner wants to send somebody else the same view, and a
 * screen whose state lives only in a form cannot be shared or reloaded.
 *
 * There is nothing sensitive in the reference. It is the string the customer
 * was given, and the screen behind it already requires partners.manage.
 *
 * AND IT USED TO DO NOTHING AT ALL FOR THREE DIFFERENT ENTRIES.
 * ==============================================================
 * Operator ruling, 2026-10-01: "an empty, oversized or invalid entry must show
 * a plain message saying what is wrong, never do nothing."
 *
 * Found by the break it sweep, which submitted this form as an admin with
 * nothing at all, with six thousand characters, and with markup in the field.
 * All three reported the same thing: it sent no request, did not move, and
 * showed no message. An operator on the telephone with a partner pressed the
 * button and the screen sat there.
 *
 * The empty case is the one that was certainly broken and is worth naming,
 * because the old code looks correct: an empty value pushed
 * `/portal/partners/disputes`, which is the route you are already on, so the
 * navigation was a no op. The guard read as handling the empty case and it was
 * the cause of it.
 *
 * WHY THE PREFIX ARRIVES AS A PROP RATHER THAN AN IMPORT. `SITE_KEY` lives in
 * `src/lib/supabase.ts`, which is server only, and importing it here would
 * typecheck cleanly and fail the BUILD, because that constraint belongs to the
 * bundler rather than to the type system. CLAUDE.md records that exact failure.
 * The server page reads the constant and passes it down, so the prefix still
 * has one home and no second copy is typed into a client component.
 *
 * WHAT IS DELIBERATELY NOT VALIDATED. The full reference shape. There are six
 * minting sites and four shapes between them, `254-O2026-ABCDEF`,
 * `254-B2026-ABCDEF`, `254-2026-0001` and a DEMO variant, with no shared
 * validator. A tight pattern here would be a fifth account of that fact and
 * would reject a valid reference, which is worse than the defect being fixed.
 * The prefix is the one property every minting site shares, so that is what is
 * checked, and anything past it is answered by the lookup itself.
 */
export function LookupForm({ reference, prefix }: { reference: string; prefix: string }) {
  const router = useRouter();
  const [value, setValue] = useState(reference);
  const [problem, setProblem] = useState<string | null>(null);

  /*
   * Longer than any reference this platform mints. The longest shape is the
   * DEMO variant at twenty one characters, so forty is generous and is a
   * ceiling rather than a format rule.
   */
  const LONGEST = 40;

  function problemWith(entry: string): string | null {
    if (entry.length === 0) return "Enter an order reference.";
    if (entry.length > LONGEST) {
      return `That is ${entry.length} characters, which is longer than any order reference. Check it and try again.`;
    }
    if (!entry.startsWith(`${prefix}-`)) {
      return `An order reference starts with ${prefix}, like ${prefix}-O2026-ABCDEF.`;
    }
    return null;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = value.trim();

    const found = problemWith(next);
    if (found) {
      setProblem(found);
      return;
    }

    setProblem(null);
    router.push(`/portal/partners/disputes?reference=${encodeURIComponent(next)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="reference" className="block text-[13.5px] font-semibold text-[var(--ink)]">
            Order reference
          </label>
          <input
            id="reference"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              /*
               * The message goes the moment they start fixing it. A stale
               * sentence sitting under a field somebody has already corrected
               * is its own small lie about the state of the form.
               */
              if (problem) setProblem(null);
            }}
            placeholder={`${prefix}-...`}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "reference-problem" : undefined}
            className="mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 font-mono text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]"
          />
        </div>
        <button
          type="submit"
          className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)]"
        >
          Look it up
        </button>
      </div>

      {/*
        CARRIED IN WEIGHT RATHER THAN IN COLOUR, which is the operator's firm
        wide ruling of 2026-09-30: V10 supersedes the portal standard's colour
        as status, and colour alone is not a way to say something is wrong.

        aria-live, so somebody using a screen reader is told rather than left
        pressing a button that appears to do nothing, which is the exact
        experience this whole change exists to remove.
      */}
      {problem ? (
        <p
          id="reference-problem"
          aria-live="polite"
          className="text-[14px] leading-[1.5] font-semibold text-[var(--ink)]"
        >
          {problem}
        </p>
      ) : null}
    </form>
  );
}
