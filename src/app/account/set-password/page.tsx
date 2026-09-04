import { Wordmark } from "@/components/brand/Wordmark";
import { inspectCustomerToken, MIN_CUSTOMER_PASSWORD_LENGTH } from "@/lib/customer-auth";
import { AccountSetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

/**
 * Behind a one time link, for a customer.
 *
 * A separate page and a separate token table from the staff equivalent. A link
 * that could be spent against either surface would be a way to cross the very
 * boundary these tables exist to build.
 *
 * The token is inspected, not spent, so opening the link and closing the tab
 * does not burn it. It is spent by the POST that sets the password.
 */
export default async function AccountSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await inspectCustomerToken(token) : ({ ok: false, reason: "invalid" } as const);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark height={44} priority />
        </div>
        <div className="rounded-[4px] border border-[var(--border)] border-t-brass bg-white p-6 sm:p-7">
          {result.ok ? (
            <>
              <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
                Choose your password
              </h1>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                {result.displayName}, your sign in address is{" "}
                <span className="font-semibold break-all text-[var(--navy)]">{result.email}</span>.
              </p>
              <AccountSetPasswordForm token={token!} minLength={MIN_CUSTOMER_PASSWORD_LENGTH} />
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
                    ? "If that was not you, tell the firm."
                    : "Check the link came through whole. The firm can send a new one."}
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
