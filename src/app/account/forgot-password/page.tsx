import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentCustomer } from "@/lib/customer-auth";
import { customerSessionConfigured } from "@/lib/customer-session";
import { registrationLine } from "@/lib/launch";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password | 254 Engineering Services",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Where somebody who cannot get in asks for a way back.
 *
 * WHY IT DID NOT EXIST UNTIL 2026-09-29, which is worth writing down because
 * nothing about the code looked wrong. `reset_password` was a declared token
 * purpose from the day the table was written, `/account/set-password` worked,
 * and `setCustomerPassword` spends a token of either purpose without caring
 * which. Every piece was in place except the one that mints the token, and
 * nothing called it. A customer who forgot their password had no route back
 * into the account they had bought through, and nobody at the firm could send
 * them one either.
 *
 * IT IS NOT GATED ON THE SIGN UP CONDITION. That condition asks whether the
 * firm is accepting NEW self service accounts. Somebody here already has one.
 * Gating recovery on it would mean closing public sign up silently locked every
 * existing customer out of their own password. The route says the same thing at
 * greater length.
 *
 * NOT INDEXED. A recovery form in a search result is an invitation to mail
 * strangers, and there is nothing here for a crawler.
 *
 * THE SIGNED IN REDIRECT IS A CONVENIENCE AND NOT A CONTROL. Somebody with a
 * live session who lands here wanted their settings, not this. It is not
 * protecting anything: the route below is public by design, because a person
 * who cannot sign in is exactly who needs it.
 */
export default async function ForgotPasswordPage() {
  const existing = await currentCustomer();
  if (existing) redirect("/account/settings");

  return (
    /*
     * RESTYLED TO DESIGN V10, 2026-09-29, in the same pass that built it. It
     * shipped in the old card style hours earlier because the reset branch was
     * cut from main; this brings it onto the same surface as sign in and sign
     * up, so a person moving between the three does not cross a visual seam.
     */
    <div className="v10-phone-ground flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="254 Engineering Services, home">
            {/* v5's header rule as CSS. See the note on /account/login. */}
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" priority />
          </Link>
          <Link
            href="/account/login"
            prefetch={false}
            className="text-[14px] font-semibold text-[var(--color-link)]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[520px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div>
        <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
          Reset your password
        </h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
          Give us the address the account is under and we will email a link for setting a new
          password.
        </p>
        </div>

        {customerSessionConfigured() ? (
          <ForgotPasswordForm />
        ) : (
          /* V10 carries status in weight rather than in a tinted panel. */
          <p className="mt-7 border-t border-[var(--color-limestone-line)] pt-6 text-[16px] leading-[1.6] font-semibold text-[var(--color-ink)]">
            Accounts are not available on this deployment yet.
          </p>
        )}

        <div>
        <p className="mt-8 text-[14px] text-[var(--color-ink-quiet)]">
          <Link
            href="/account/login"
            prefetch={false}
            className="font-semibold text-[var(--color-link)]"
          >
            Back to sign in
          </Link>
        </p>
        <p className="mt-3 text-[14px] text-[var(--color-ink-quiet)]">
          {/*
            Not prefetched, for the reason given on /account/login: prefetching
            "/" loads the lead form's zod in the browser.
          */}
          <Link
            href="/"
            prefetch={false}
            className="text-[var(--color-link)] underline underline-offset-2"
          >
            Back to the site
          </Link>
        </p>
        </div>
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
