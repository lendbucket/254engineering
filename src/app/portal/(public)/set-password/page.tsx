import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
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
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-slate via-slate-deep to-slate-abyss px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark onDark height={44} priority />
        </div>

        <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white p-6 sm:p-7">
          {result.ok ? (
            <>
              <h1 className="font-display text-[22px] leading-[1.2] font-bold text-slate">
                Choose your password
              </h1>
              <p className="mt-2 text-[14px] leading-[1.6] text-slate-muted">
                {result.profile.display_name}, your account is set up as{" "}
                {ROLE_LABEL[result.profile.role]}. Your sign in address is{" "}
                <span className="font-semibold break-all text-slate">{result.profile.email}</span>.
              </p>
              <SetPasswordForm token={token!} minLength={MIN_PASSWORD_LENGTH} />
            </>
          ) : (
            <>
              <h1 className="font-display text-[22px] leading-[1.2] font-bold text-slate">
                {result.reason === "expired"
                  ? "That link has expired"
                  : result.reason === "used"
                    ? "That link has already been used"
                    : "That link is not valid"}
              </h1>
              <p className="mt-3 text-[14px] leading-[1.6] text-slate-muted">
                {result.reason === "expired"
                  ? "Links last three days. An administrator can send a new one."
                  : result.reason === "used"
                    ? "Your password is already set. Sign in with it, or ask an administrator for a reset."
                    : "Check that the whole link was copied. If it still does not work, ask an administrator for a new one."}
              </p>
              <Link
                href="/portal/login"
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-[3px] border border-limestone-line px-4 text-[15px] font-bold text-slate hover:bg-limestone"
              >
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
