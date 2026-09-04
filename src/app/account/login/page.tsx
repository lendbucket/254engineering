import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentCustomer } from "@/lib/customer-auth";
import { customerSessionConfigured } from "@/lib/customer-session";
import { AccountLoginForm } from "./AccountLoginForm";

export const dynamic = "force-dynamic";

/**
 * Where an ordering account signs in.
 *
 * `next` is validated here as well as in the proxy. An open redirect out of a
 * sign in is a phishing primitive, and the rule is the same one the portal
 * uses: it must be a path on this site and it must be inside /account, because
 * a customer has no business being sent to a portal route after signing in.
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
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark height={44} priority />
        </div>

        <div className="rounded-[4px] border border-[var(--border)] border-t-brass bg-white p-6 sm:p-7">
          <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
            Sign in to your account
          </h1>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
            For organisations that order regularly. If you placed a single order, the link emailed
            to you opens it without signing in.
          </p>

          {customerSessionConfigured() ? (
            <div className="mt-5">
              <AccountLoginForm next={safeNext} />
            </div>
          ) : (
            <p className="mt-5 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.6] text-[var(--warn-ink)]">
              Accounts are not available on this deployment yet.
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[13.5px] text-[var(--secondary)]">
          <Link href="/" className="underline underline-offset-2">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
