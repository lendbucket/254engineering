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

      <p className="text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">Your account</p>
      <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.2rem)] leading-[1.2] font-semibold text-slate">
        {me.displayName}
      </h1>
      <p className="mt-2 text-[1rem] leading-[1.7] text-slate-muted">
        Signed in as {me.email}.{" "}
        {me.account.billingMode === "invoice"
          ? `This account is invoiced, on ${me.account.netDays} day terms.`
          : "This account pays by card at the time of ordering."}
      </p>

      <div className="mt-8 rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white px-5 py-5">
        <h2 className="font-display text-[1.15rem] font-semibold text-slate">
          Order for several properties
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.65] text-slate-muted">
          One submission, one payment, and each property becomes its own file. You see which the
          firm can take and which it cannot, with the reason, before anything is charged.
        </p>
        <Link
          href="/account/order"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-[3px] bg-brass px-5 text-[14px] font-bold text-slate-ink"
        >
          Start a submission
        </Link>
      </div>

      <div className="mt-4 rounded-[4px] border border-limestone-line bg-white px-5 py-5">
        <h2 className="font-display text-[1.15rem] font-semibold text-slate">Settings</h2>
        <p className="mt-2 text-[13.5px] leading-[1.65] text-slate-muted">
          The billing contact, the standing access instructions that go onto every order, and the
          properties you order against repeatedly.
        </p>
        <Link
          href="/account/settings"
          className="mt-4 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-slate underline underline-offset-2"
        >
          Open settings
        </Link>
      </div>

      {me.account.billingMode === "invoice" ? (
        <div className="mt-4 rounded-[4px] border border-limestone-line bg-white px-5 py-5">
          <h2 className="font-display text-[1.15rem] font-semibold text-slate">Statements</h2>
          <p className="mt-2 text-[13.5px] leading-[1.65] text-slate-muted">
            What has been billed, what is still to be billed, and paying an outstanding statement.
          </p>
          <Link
            href="/account/statements"
            className="mt-4 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-slate underline underline-offset-2"
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
