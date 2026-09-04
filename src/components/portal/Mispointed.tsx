import type { Mispointing } from "@/lib/db-guard";

/**
 * What a mispointed deployment shows instead of the portal.
 *
 * WHY A SCREEN AND NOT JUST THE THROWN ERROR
 * ------------------------------------------
 * The throw in supabase.ts is the thing that actually protects the data, and it
 * would be enough on its own. It produces a stack trace, and a stack trace is a
 * message to whoever wrote the code rather than to whoever is standing in front
 * of it wondering why the portal is broken.
 *
 * This is the same fact, addressed to the person. It says what is wrong, what it
 * prevented, and the exact setting that fixes it, because the operator reading
 * it is the only one who can change a Vercel environment variable.
 *
 * ONE SCREEN, TWO FAULTS
 * ----------------------
 * It began as the preview-pointed-at-production screen. When the mirror fault
 * happened, production pointed at development, the honest thing was to widen
 * this rather than write a second screen: two screens is two places for the
 * wording to rot, and the reader's question is the same either way. The words
 * come from db-guard so the thrown error and this screen cannot disagree about
 * what went wrong.
 */
export function MispointedDeployment({ fault }: { fault: Mispointing }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate px-5 py-12">
      <div className="w-full max-w-[62ch] rounded-[4px] border border-[var(--red)] bg-white px-6 py-7">
        <p className="portal-kicker text-[var(--red)]">
          Stopped before anything was read or written
        </p>
        <h1 className="mt-2 font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
          {fault.headline}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-[var(--secondary)]">{fault.explanation}</p>

        <p className="mt-5 portal-kicker text-[var(--gold-deep)]">
          How to fix it
        </p>
        <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">{fault.fix}</p>

        <p className="mt-5 border-t border-[var(--border)] pt-4 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          If you genuinely intend this, set
          <span className="font-mono"> {fault.hatch}=1 </span>
          on this deployment. {fault.hatchNote}
        </p>
      </div>
    </main>
  );
}
