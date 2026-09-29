import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentCustomer } from "@/lib/customer-auth";
import { customerSessionConfigured } from "@/lib/customer-session";
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
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark height={44} priority />
        </div>

        <div className="rounded-[4px] border border-[var(--border)] border-t-brass bg-white p-6 sm:p-7">
          <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
            Reset your password
          </h1>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
            Give us the address the account is under and we will email a link for setting a new
            password.
          </p>

          {customerSessionConfigured() ? (
            <ForgotPasswordForm />
          ) : (
            <p className="mt-5 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.6] text-[var(--warn-ink)]">
              Accounts are not available on this deployment yet.
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[13.5px] text-[var(--secondary)]">
          <Link href="/account/login" className="underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-[13.5px] text-[var(--secondary)]">
          {/*
            Not prefetched, for the reason given on /account/login: prefetching
            "/" loads the lead form's zod in the browser.
          */}
          <Link href="/" prefetch={false} className="underline underline-offset-2">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
