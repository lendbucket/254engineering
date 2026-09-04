import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
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

      <div className="mt-8 rounded-[4px] border border-limestone-line bg-white px-5 py-4">
        <p className="text-[13.5px] leading-[1.65] text-slate-muted">
          Ordering for several properties at once, saved properties, API access and statements are
          being built. Until they are here, orders go through the service pages as usual and this
          screen is how the firm knows who you are.
        </p>
      </div>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
