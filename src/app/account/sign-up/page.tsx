import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentCustomer } from "@/lib/customer-auth";
import { customerSessionConfigured } from "@/lib/customer-session";
import {
  firmName,
  registrationLine,
  selfServiceSignUpClosedSentence,
  selfServiceSignUpOpen,
} from "@/lib/launch";
import { SignUpForm } from "./SignUpForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open an account | 254 Engineering Services",
  description:
    `Open an ordering account with ${firmName()}. Choose a password from the link sent to your address, and the account is ready to use.`,
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
 *
 * ===========================================================================
 * RESTYLED TO DESIGN V10, 2026-09-29. PRESENTATION ONLY.
 * ===========================================================================
 *
 * THE STEP COUNTER IS NOT HERE, AND LEAVING IT OUT IS THE WHOLE RULE IN ONE
 * LINE. V10-signup is headed "Step 1 of 2", because the design has a second
 * screen where a six digit code is typed. This platform has no code and no
 * second screen: the address is proven by opening the emailed link, which is
 * also where the password is chosen. Rendering "Step 1 of 2" over a flow with
 * one step is a sentence about the product that is not true, and it is the
 * cheapest possible version of the defect section 2c of CLAUDE.md exists for.
 *
 * THE FOOTER IS DERIVED AND THE DESIGN'S FOOTER IS WRONG. V10 draws
 * "254 Engineering LLC, TBPELS Firm F-29811". Three names are in play and that
 * pairing is not one of them: the STATE holds 254 Engineering LLC since the
 * 2026-09-16 amendment, and the BOARD holds F-29811 in the name 254 Services
 * LLC. Printing the board's number beside a name the board has no record of is
 * the exact misstatement the compliance gate exists to prevent, made in the one
 * place a reader goes to check. `registrationLine()` reads the registrant off
 * the register, so this footer stays right through reissuance without anybody
 * editing it.
 *
 * WHAT CHANGED IS THE SHAPE. No card, no brass top edge, no grey ground. A
 * header bar, one centred column, a footer, all on white.
 */
export default async function AccountSignUpPage() {
  const existing = await currentCustomer();
  if (existing) redirect("/account");

  const open = selfServiceSignUpOpen();
  const configured = customerSessionConfigured();

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/*
        The signed out header. White with a hairline under it. The navy bar with
        the gold rule belongs to the signed in shell, and using it here would
        promise a portal the reader is not in yet.
      */}
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="254 Engineering Services, home">
            <Wordmark height={28} priority />
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

      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
          Create your account
        </h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
          {/*
            THIS SENTENCE WENT OUT OF DATE THE DAY THE THIRD DOOR WAS BUILT.
            It said a single order does not need an account, which was true
            while paying created nothing. Paying now opens one, so the honest
            version says you do not have to come here first rather than
            implying you never get an account by ordering.
          */}
          For organizations that expect to order more than once. You do not have to start here:
          paying for an order opens an account too, and the link emailed with it works either way.
        </p>

        {!open ? (
          /*
            V10 forbids tinted panels and carries status in weight. The sentence
            still comes from the gate rather than from this file, so a screen
            cannot disagree with the condition it is reporting.
          */
          <p className="mt-7 border-t border-[var(--color-limestone-line)] pt-6 text-[16px] leading-[1.6] font-semibold text-[var(--color-ink)]">
            {selfServiceSignUpClosedSentence()}
          </p>
        ) : !configured ? (
          <p className="mt-7 border-t border-[var(--color-limestone-line)] pt-6 text-[16px] leading-[1.6] font-semibold text-[var(--color-ink)]">
            Accounts are not available on this deployment yet.
          </p>
        ) : (
          <SignUpForm />
        )}

        <p className="mt-8 text-[14px] text-[var(--color-ink-quiet)]">
          Already have an account?{" "}
          <Link
            href="/account/login"
            prefetch={false}
            className="font-semibold text-[var(--color-link)]"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-[14px] text-[var(--color-ink-quiet)]">
          {/*
            Not prefetched, for the reason given on /account/login: prefetching
            "/" loads the lead form's zod in the browser. Measured 2026-09-15 at
            433KB with the prefetch and 316KB without it, signed out.
          */}
          <Link
            href="/"
            prefetch={false}
            className="text-[var(--color-link)] underline underline-offset-2"
          >
            Back to the site
          </Link>
        </p>
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
