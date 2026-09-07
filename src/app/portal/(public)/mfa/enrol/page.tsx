import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { OPS_COOKIE, readOpsSession, readPendingSession } from "@/lib/ops-session";
import { mfaConfigured, mfaRequirementFor, mfaStatus } from "@/lib/ops-mfa";
import { Wordmark } from "@/components/brand/Wordmark";
import { SystemAlert } from "@/components/portal/design";
import { EnrolForm } from "./EnrolForm";

/**
 * Enrolment during sign in, for somebody whose role requires a factor they do
 * not yet have.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE ACCOUNT SCREEN
 * --------------------------------------------------
 * An operator turning on the requirement for a role must not lock out everybody
 * holding it. Those people sign in with a password, get a PENDING session, and
 * land here: they can enrol and nothing else. Without this the requirement
 * would only be safe to switch on for accounts that had already volunteered,
 * which is to say it would not be a requirement.
 *
 * The other half, enrolling voluntarily when nothing compels it, belongs on the
 * profile screen with a full session and is a separate piece of work.
 *
 * A pending session reaching here is the second and last caller of
 * readPendingSession. mfa-audit counts them.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up a second factor",
  robots: { index: false, follow: false },
};

export default async function MfaEnrolPage() {
  const jar = await cookies();
  const raw = jar.get(OPS_COOKIE)?.value;

  const full = readOpsSession(raw);
  const pending = readPendingSession(raw);

  /*
   * Neither kind of session means there is nothing to enrol against. A full one
   * is allowed through, because somebody may reach this from a link after
   * signing in normally, and turning them away would be a dead end for the
   * only people who can act on it.
   */
  if (!full && !pending) redirect("/portal/login");

  const role = (full ?? pending)!.role;

  const ready = mfaConfigured();
  let required = false;
  try {
    required = (await mfaRequirementFor(role)) === "required";
  } catch {
    /* The copy differs by one paragraph. A failed read should not empty the
     * screen, so it falls back to the softer wording rather than to nothing. */
    required = false;
  }

  return (
    <main className="portal-surface grid min-h-dvh place-items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-4 flex justify-center sm:mb-6">
          <Wordmark height={44} priority />
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 sm:p-7">
          <h1 className="font-display text-[17px] leading-[1.25] font-bold text-[var(--navy)]">
            Set up a second factor
          </h1>

          {ready ? null : (
            <div className="mt-4">
              <SystemAlert condition="Not configured." tone="failed">
                {mfaStatus()} Enrolment cannot be completed on this deployment until that is fixed.
              </SystemAlert>
            </div>
          )}

          {ready ? <EnrolForm required={required} /> : null}
        </div>

        <p className="mt-4 text-center text-[13px] text-[var(--secondary)]">
          <a href="/api/portal/session" className="underline">
            Sign out
          </a>
        </p>
      </div>
    </main>
  );
}
