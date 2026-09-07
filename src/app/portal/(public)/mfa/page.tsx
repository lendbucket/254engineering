import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { OPS_COOKIE, readOpsSession, readPendingSession } from "@/lib/ops-session";
import { breakGlassConfigured } from "@/lib/ops-mfa-breakglass";
import { mfaConfigured, mfaStatus } from "@/lib/ops-mfa";
import { homeFor } from "@/lib/ops-authz";
import { Wordmark } from "@/components/brand/Wordmark";
import { SystemAlert } from "@/components/portal/design";
import { MfaChallengeForm } from "./MfaChallengeForm";

/**
 * The second factor challenge.
 *
 * ONE OF EXACTLY TWO PLACES THAT MAY SEE A PENDING SESSION
 * --------------------------------------------------------
 * This screen and the enrolment beside it. Everything else in the portal calls
 * readOpsSession, which returns null for a pending cookie, so the whole product
 * refuses a half authenticated session without knowing that MFA exists.
 *
 * mfa-audit counts the callers of readPendingSession, because a third one is
 * how that stops being true.
 *
 * WHY IT LIVES IN (public) RATHER THAN (app)
 * ------------------------------------------
 * The portal shell reads currentActor, which reads readOpsSession, which
 * refuses a pending session. A challenge screen inside the shell would be a
 * screen that cannot render for the only people who need it.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Second factor",
  robots: { index: false, follow: false },
};

export default async function MfaChallengePage() {
  const jar = await cookies();
  const raw = jar.get(OPS_COOKIE)?.value;

  /*
   * Already through: nothing to challenge. Sending somebody with a full session
   * back to a code prompt would be the platform doubting a factor it accepted.
   */
  const full = readOpsSession(raw);
  if (full) redirect(homeFor(full.role));

  const pending = readPendingSession(raw);
  if (!pending) redirect("/portal/login");

  /*
   * A missing encryption key means no code can be verified. Saying so is the
   * difference between an outage somebody can fix and a person concluding their
   * phone is broken, and it is the same shape the sign in screen already uses
   * for an unconfigured session secret.
   */
  const ready = mfaConfigured();
  const breakGlass = breakGlassConfigured();

  return (
    <main className="portal-surface grid min-h-dvh place-items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-4 flex justify-center sm:mb-6">
          <Wordmark height={44} priority />
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 sm:p-7">
          <h1 className="font-display text-[17px] leading-[1.25] font-bold text-[var(--navy)]">
            One more step
          </h1>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
            Your password was accepted. Enter the code from your authenticator app to finish
            signing in.
          </p>

          {ready ? null : (
            <div className="mt-4">
              <SystemAlert condition="Not configured." tone="failed">
                {mfaStatus()} Nobody can complete a second factor on this deployment until that is
                fixed, and a correct code will still be refused.
              </SystemAlert>
            </div>
          )}

          {ready ? <MfaChallengeForm breakGlassOffered={Boolean(breakGlass)} /> : null}
        </div>

        <p className="mt-4 text-center text-[13px] text-[var(--secondary)]">
          <a href="/api/portal/session" className="underline">
            Not you? Sign out
          </a>
        </p>
      </div>
    </main>
  );
}
