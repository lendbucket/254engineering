import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { RestrictedMode } from "@/components/portal/design";
import { inspectPartnerToken, MIN_PARTNER_PASSWORD_LENGTH } from "@/lib/partner-auth";
import { PartnerSetPasswordForm } from "./PartnerSetPasswordForm";

export const dynamic = "force-dynamic";

/**
 * The screen behind a partner's one time link.
 *
 * The token is inspected and not spent here, so somebody can open the link,
 * close the tab and come back. It is spent by the POST that sets the password,
 * which is the only moment it has been used for anything.
 *
 * A dead link says which kind of dead it is. "Invalid link" alone sends people
 * to somebody at the firm who cannot tell either, and the three cases have
 * three different answers.
 *
 * THE RESTRICTED MODE NOTICE AND THE COMPLIANCE FOOTER ARE BOTH HERE
 * ------------------------------------------------------------------
 * Phase 11 Section 1 found the staff version of this screen carrying neither,
 * so somebody joining the firm set their password having been told nothing
 * about the registration being pending. A partner about to start selling on the
 * firm's behalf is, if anything, the person who most needs to read it before
 * they begin.
 */
export default async function PartnerSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await inspectPartnerToken(token)
    : ({ ok: false, reason: "invalid" } as const);

  return (
    <main className="portal-surface grid min-h-dvh place-items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[420px]">
        {/* The light lockup, because .portal-surface is the light canvas. */}
        <div className="mb-4 flex justify-center sm:mb-6">
          <Wordmark height={44} priority />
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-5 sm:p-7">
          {result.ok ? (
            <>
              <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
                Choose your password
              </h1>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                {result.displayName}, this signs you in for{" "}
                <span className="font-semibold text-[var(--navy)]">{result.organisation}</span>. Your
                sign in address is{" "}
                <span className="font-semibold break-all text-[var(--navy)]">{result.email}</span>.
              </p>

              <div className="mt-5">
                <RestrictedMode
                  also={
                    <>
                      You can be credited for referrals now. Nothing can be sealed
                      until an engineer of record is in responsible charge, so what you refer today
                      may take longer to become payable than it will later.
                    </>
                  }
                />
              </div>

              <PartnerSetPasswordForm token={token!} minLength={MIN_PARTNER_PASSWORD_LENGTH} />
            </>
          ) : (
            <>
              <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
                {result.reason === "expired"
                  ? "That link has expired"
                  : result.reason === "used"
                    ? "That link has already been used"
                    : "That link is not valid"}
              </h1>
              <p className="mt-3 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                {result.reason === "expired"
                  ? "Links last three days. The firm can send a new one."
                  : result.reason === "used"
                    ? "Your password is already set. Sign in with it, or ask the firm for a new link."
                    : "Check that the whole link was copied. If it still does not work, ask the firm for a new one."}
              </p>
              <Link
                href="/partner/login"
                className="mt-6 inline-flex min-h-[var(--tap-target)] w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] px-4 text-[15px] font-bold text-[var(--navy)] active:bg-[var(--canvas)]"
              >
                Go to sign in
              </Link>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[12px] leading-[1.6] text-[var(--secondary)] sm:mt-5">
          254 Engineering Services is the firm of record for work referred through this
          programme, and is the firm that will perform and seal it. Firm registration pending with the Texas Board of Professional Engineers and
          Land Surveyors, and no engineer of record is yet in responsible charge.
        </p>
      </div>
    </main>
  );
}
