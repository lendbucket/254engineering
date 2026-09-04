import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

/**
 * The account home.
 *
 * Deliberately thin in this increment: it proves the boundary works end to end
 * and nothing more. Bulk ordering, saved properties, API keys and statements are
 * the increments that follow, and shipping empty shells for them now would be
 * four screens that look finished and are not.
 */
export default async function AccountHomePage() {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  return (
    <main className="mx-auto max-w-[68ch] px-4 py-10">
      <div className="mb-6">
        <Wordmark height={36} />
      </div>

      <p className="portal-kicker text-[var(--gold-deep)]">Your account</p>
      <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.2rem)] leading-[1.2] font-semibold text-[var(--navy)]">
        {me.displayName}
      </h1>
      <p className="mt-2 text-[1rem] leading-[1.7] text-[var(--secondary)]">
        Signed in as {me.email}.{" "}
        {me.account.billingMode === "invoice"
          ? `This account is invoiced, on ${me.account.netDays} day terms.`
          : "This account pays by card at the time of ordering."}
      </p>

      <div className="mt-8 rounded-[4px] border border-[var(--border)] border-t-brass bg-white px-5 py-5">
        <h2 className="font-display text-[1.15rem] font-semibold text-[var(--navy)]">
          Order for several properties
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">
          One submission, one payment, and each property becomes its own file. You see which the
          firm can take and which it cannot, with the reason, before anything is charged.
        </p>
        <Link
          href="/account/order"
          className="mt-4 inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[13.5px] font-bold text-white"
        >
          Start a submission
        </Link>
      </div>

      <div className="mt-4 rounded-[4px] border border-[var(--border)] bg-white px-5 py-5">
        <h2 className="font-display text-[1.15rem] font-semibold text-[var(--navy)]">Settings</h2>
        <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">
          The billing contact, the standing access instructions that go onto every order, and the
          properties you order against repeatedly.
        </p>
        <Link
          href="/account/settings"
          className="mt-4 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
        >
          Open settings
        </Link>
      </div>

      {me.account.billingMode === "invoice" ? (
        <div className="mt-4 rounded-[4px] border border-[var(--border)] bg-white px-5 py-5">
          <h2 className="font-display text-[1.15rem] font-semibold text-[var(--navy)]">Statements</h2>
          <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">
            What has been billed, what is still to be billed, and paying an outstanding statement.
          </p>
          <Link
            href="/account/statements"
            className="mt-4 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
          >
            Open statements
          </Link>
        </div>
      ) : null}

      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
