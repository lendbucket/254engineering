import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { inspectCustomerToken, MIN_CUSTOMER_PASSWORD_LENGTH } from "@/lib/customer-auth";
import { registrationLine } from "@/lib/launch";
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
    /*
     * RESTYLED TO DESIGN V10, 2026-09-29. PRESENTATION ONLY.
     *
     * This is where every link lands, from all three account doors and now from
     * both reset paths, so it gets the same surface as sign in, sign up and
     * forgot password rather than being the one card left in the old style.
     *
     * THE THREE REFUSAL SENTENCES ARE UNCHANGED, and that matters more here
     * than the styling. Expired, already used and not valid are three different
     * facts and they say three different things, and one of them now also
     * covers a suspended account, deliberately, so a dead link discloses
     * nothing about why it is dead.
     */
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="254 Engineering Services, home">
            <Wordmark height={28} priority />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[520px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        {result.ok ? (
          <>
            <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
              Choose your password
            </h1>
            <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
              {result.displayName}, your sign in address is{" "}
              <span className="font-semibold break-all text-[var(--color-ink)]">
                {result.email}
              </span>
              .
            </p>
            <AccountSetPasswordForm token={token!} minLength={MIN_CUSTOMER_PASSWORD_LENGTH} />
          </>
        ) : (
          <>
            <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
              {result.reason === "expired"
                ? "That link has expired"
                : result.reason === "used"
                  ? "That link has already been used"
                  : "That link is not valid"}
            </h1>
            <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
              {result.reason === "expired"
                ? "Links last three days. The firm can send a new one."
                : result.reason === "used"
                  ? "If that was not you, tell the firm."
                  : "Check the link came through whole. The firm can send a new one."}
            </p>
            {/*
              A DEAD END WITH NO NEXT STEP IS WHERE SOMEBODY GIVES UP.

              The portal and the partner surface both offer this and the
              customer one did not. Found on 2026-09-07, the first time
              forms-audit exercised a credential form outside the portal: a
              customer whose invite had expired reached a sentence and
              nothing to press.

              IT LEADS TO SIGN IN AND SIGN IN NOW OFFERS A RESET, which closes
              the loop this comment described. Before 2026-09-29 the next step
              was a screen with no way to get a fresh link either.
            */}
            <Link
              href="/account/login"
              className="mt-8 inline-flex min-h-[var(--tap-target)] items-center rounded-[3px] border border-[var(--color-limestone-edge)] px-6 text-[15px] font-semibold text-[var(--color-ink)]"
            >
              Go to sign in
            </Link>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-[var(--color-ink-quiet)] sm:px-6">
          {/* Derived from the board's own record. Never typed. */}
          <p>{registrationLine()}</p>
          <nav className="flex gap-5">
            <Link href="/terms" prefetch={false} className="text-[var(--color-link)]">
              Terms
            </Link>
            <Link href="/privacy" prefetch={false} className="text-[var(--color-link)]">
              Privacy
            </Link>
            <Link href="/contact" prefetch={false} className="text-[var(--color-link)]">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
