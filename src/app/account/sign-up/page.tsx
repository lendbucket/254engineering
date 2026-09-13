import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentCustomer } from "@/lib/customer-auth";
import { customerSessionConfigured } from "@/lib/customer-session";
import { selfServiceSignUpClosedSentence, selfServiceSignUpOpen } from "@/lib/launch";
import { SignUpForm } from "./SignUpForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open an account | 254 Engineering Services",
  description:
    "Open an ordering account with 254 Engineering Services. Choose a password from the link sent to your address, and the account is ready to use.",
  robots: { index: false, follow: false },
};

/**
 * Where a person opens an account without speaking to anybody.
 *
 * NOT INDEXED, and that is not a launch decision. A sign up form is a place to
 * do a thing rather than a page to arrive at from a search, and the two sibling
 * brands have their own. Indexing it would put three near identical forms in
 * one operator's name in front of the same query, which is the doorway shape
 * this brand's whole content rule exists to avoid.
 *
 * THE GATE IS READ HERE AND IN THE ROUTE, which is two reads of one answer
 * rather than two answers. A screen that hides a form is a screen; the route is
 * what somebody who reads HTML has to get past. Neither alone is the gate.
 *
 * WHAT A SHUT DOOR SAYS. Not "coming soon", which is a promise with a date
 * implied, and not an error, which suggests something broke. It says accounts
 * are not open for sign up and names the two ways a person can still get one,
 * because the operator door is open and the telephone works.
 */
export default async function AccountSignUpPage() {
  const existing = await currentCustomer();
  if (existing) redirect("/account");

  const open = selfServiceSignUpOpen();
  const configured = customerSessionConfigured();

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark height={44} priority />
        </div>

        <div className="rounded-[4px] border border-[var(--border)] border-t-brass bg-white p-6 sm:p-7">
          <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
            Open an account
          </h1>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
            {/*
              THIS SENTENCE WENT OUT OF DATE THE DAY THE THIRD DOOR WAS BUILT.
              It said a single order does not need an account, which was true
              while paying created nothing. Paying now opens one, so the honest
              version says you do not have to come here first rather than
              implying you never get an account by ordering.
            */}
            For organisations that expect to order more than once. You do not have to start here:
            paying for an order opens an account too, and the link emailed with it works either
            way.
          </p>

          {!open ? (
            <p className="mt-5 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.6] text-[var(--warn-ink)]">
              {selfServiceSignUpClosedSentence()}
            </p>
          ) : !configured ? (
            <p className="mt-5 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.6] text-[var(--warn-ink)]">
              Accounts are not available on this deployment yet.
            </p>
          ) : (
            <SignUpForm />
          )}
        </div>

        <p className="mt-5 text-center text-[13.5px] text-[var(--secondary)]">
          <Link href="/account/login" className="underline underline-offset-2">
            Already have an account? Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-[13.5px] text-[var(--secondary)]">
          <Link href="/" className="underline underline-offset-2">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
