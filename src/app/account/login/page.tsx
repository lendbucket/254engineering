import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { customerSessionConfigured } from "@/lib/customer-session";
import { selfServiceSignUpOpen } from "@/lib/launch";
import { SignInFrame, SignInHeading } from "@/components/portal/SignInFrame";
import { AccountLoginForm } from "./AccountLoginForm";

export const dynamic = "force-dynamic";

/*
 * Its own title, as the account's other doors have. Robert's ruling Q14 of
 * 2026-11-02, from the live site audit (issue #1, 6585009543, issue 11):
 * /account, /account/login and /account/orders, which all land here signed
 * out, carried the home page's title. The account layout keeps it noindex.
 */
export const metadata: Metadata = {
  title: "Sign in to your account | 254 Engineering",
};

/**
 * Where an ordering account signs in.
 *
 * `next` is validated here as well as in the proxy. An open redirect out of a
 * sign in is a phishing primitive, and the rule is the same one the portal
 * uses: it must be a path on this site and it must be inside /account, because
 * a customer has no business being sent to a portal route after signing in.
 *
 * ===========================================================================
 * THE 2026-11-08 REDESIGN. PRESENTATION ONLY.
 * ===========================================================================
 *
 * Robert's order: one design for the three sign-in screens, the navy panel and
 * the form on white, a visual change only. The guard for a signed in customer,
 * the `next` rule and the not-configured line are unchanged, and the form
 * still takes an email and a password and nothing else.
 *
 * What left the page: the registration line in its footer (still in the
 * public footer, every email and the portal rail), the telephone in the
 * header, the subtitle, "Back to the site", Contact, and the column describing
 * how a roof certification works, whose figures were derived from the price
 * book and so take no second home with them.
 *
 * What stayed, outside the form: "Create an account", only while
 * `selfServiceSignUpOpen()` says the door is open, because a customer has no
 * other way to find it; and Terms and Privacy, because a person signing in is
 * entitled to read them. Both are on the posted recommendation of issue #1
 * question 2 and move if Robert rules otherwise.
 */
export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const existing = await currentCustomer();
  if (existing) redirect("/account");

  const { next } = await searchParams;
  const safeNext = typeof next === "string" && /^\/account(\/|$)/.test(next) ? next : "/account";

  return (
    <SignInFrame purpose="Your orders, their status and your letters.">
      <SignInHeading />

      {customerSessionConfigured() ? (
        <AccountLoginForm next={safeNext} />
      ) : (
        <p className="mt-7 text-[15px] leading-[1.6] font-semibold text-[var(--ink)]">
          Accounts are not available on this deployment yet.
        </p>
      )}

      {/*
        `selfServiceSignUpOpen()` needs BOTH the operator's clearance and the
        gate to be open (2026-09-24), so this link cannot invite somebody
        through a door that refuses. Not prefetched, as every link on this
        page: a prefetch here once cost the screen 112KB (perf-budgets).
      */}
      {selfServiceSignUpOpen() ? (
        <p className="mt-8 border-t border-[var(--border)] pt-5 text-center text-[15px] text-[var(--ink)]">
          New here?{" "}
          <Link
            href="/account/sign-up"
            prefetch={false}
            className="inline-flex min-h-[var(--tap-target)] items-center font-semibold text-[var(--navy)] underline underline-offset-2"
          >
            Create an account
          </Link>
        </p>
      ) : null}

      <nav aria-label="Legal" className="mt-8 flex justify-center gap-6">
        <Link
          href="/terms"
          prefetch={false}
          className="inline-flex min-h-[var(--tap-target)] items-center text-[15px] text-[var(--navy)] underline underline-offset-2"
        >
          Terms
        </Link>
        <Link
          href="/privacy"
          prefetch={false}
          className="inline-flex min-h-[var(--tap-target)] items-center text-[15px] text-[var(--navy)] underline underline-offset-2"
        >
          Privacy
        </Link>
      </nav>
    </SignInFrame>
  );
}
