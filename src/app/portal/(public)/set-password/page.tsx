import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { RestrictedMode } from "@/components/portal/design";
import { inspectToken, MIN_PASSWORD_LENGTH } from "@/lib/ops-auth";
import { ROLE_LABEL } from "@/lib/ops-authz";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

/**
 * The screen behind a one time link.
 *
 * The token is inspected but not spent here, so a person can open the link,
 * close the tab, and come back. It is spent by the POST that actually sets the
 * password, which is the only moment it has been used for anything.
 *
 * A dead link says which kind of dead it is: expired, already used, or never
 * valid. "Invalid link" alone sends people to an administrator who cannot tell
 * either, and the three have different answers.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await inspectToken(token) : ({ ok: false, reason: "invalid" } as const);

  return (
    <main className="portal-surface grid min-h-dvh place-items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[420px]">
        {/*
          THE LIGHT LOCKUP, BECAUSE THIS SURFACE IS LIGHT.
          .portal-surface is var(--canvas) #f4f5f7. The reverse lockup is white
          artwork; it sat here for a phase at 1.02:1, so the first thing a new
          Professional Engineer saw was a blank space with a gold slash in it.
          scripts/asset-audit.mjs measures this pairing now rather than trusting
          whoever edits this line next.
        */}
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
                {result.profile.display_name}, your account is set up as{" "}
                {ROLE_LABEL[result.profile.role]}. Your sign in address is{" "}
                <span className="font-semibold break-all text-[var(--navy)]">{result.profile.email}</span>.
              </p>
              {/*
                THE GATE, SAID ON THE FIRST SCREEN A NEW ENGINEER EVER SEES.
                Sign in has carried this since it was ported and this screen
                carried neither it nor the footer below, so somebody joining the
                firm set their password having been told nothing about the
                registration being pending. The gate is enforced in code either
                way, which is why this was a gap rather than a breach, and it is
                the one place where saying it matters most.

                Rendered unconditionally: the component reads the gate itself
                and returns null once it lifts.
              */}
              <div className="mt-5">
                <RestrictedMode />
              </div>

              <SetPasswordForm token={token!} minLength={MIN_PASSWORD_LENGTH} />
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
                  ? "Links last three days. An administrator can send a new one."
                  : result.reason === "used"
                    ? "Your password is already set. Sign in with it, or ask an administrator for a reset."
                    : "Check that the whole link was copied. If it still does not work, ask an administrator for a new one."}
              </p>
              <Link
                href="/portal/login"
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-[3px] border border-[var(--border)] px-4 text-[15px] font-bold text-[var(--navy)] hover:bg-[var(--canvas)]"
              >
                Go to sign in
              </Link>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[12px] leading-[1.6] text-[var(--secondary)] sm:mt-5">
          Firm registration pending with the Texas Board of Professional Engineers and Land
          Surveyors. No engineer of record is yet in responsible charge.
        </p>
      </div>
    </main>
  );
}
