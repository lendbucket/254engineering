import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { statementsFor } from "@/lib/ops-statements";
import { accountBalance } from "@/lib/ops-bulk";
import { Wordmark } from "@/components/brand/Wordmark";
import { money } from "@/lib/ops-money";
import { PayStatementButton } from "./PayStatementButton";

export const dynamic = "force-dynamic";

/**
 * What this organisation has been billed.
 *
 * THE TWO FIGURES ARE SEPARATE HERE TOO
 * -------------------------------------
 * Issued and unpaid is what they owe today. Not yet billed is work already done
 * that no statement covers, and a customer planning cash flow needs both. One
 * combined number would be the same total and a worse answer.
 *
 * A card account gets an explanation rather than an empty list, because a screen
 * that is empty for a structural reason should say what the reason is.
 */
export default async function StatementsPage() {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  const [statements, balance] = await Promise.all([
    statementsFor(me.accountId),
    accountBalance(me.accountId),
  ]);

  return (
    <main className="mx-auto max-w-[760px] px-4 py-10">
      <div className="mb-6">
        <Wordmark height={36} />
      </div>

      <p className="text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">Your account</p>
      <h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-[1.2] font-semibold text-slate">
        Statements
      </h1>

      {me.account.billingMode !== "invoice" ? (
        <p className="mt-3 max-w-[62ch] text-[1rem] leading-[1.7] text-slate-muted">
          This account pays by card when it orders, so there is nothing to be billed for later and no
          statements are produced.
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-[62ch] text-[1rem] leading-[1.7] text-slate-muted">
            Work is billed at the end of each period on {me.account.netDays} day terms. Anything done
            since the last statement shows below as not yet billed.
          </p>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 rounded-[4px] border border-limestone-line bg-white px-5 py-4">
            <span className="text-[13.5px] text-slate-muted">
              Issued and unpaid{" "}
              <span className="font-semibold text-slate">{money(balance.issuedUnpaidCents)}</span>
            </span>
            <span className="text-[13.5px] text-slate-muted">
              Not yet billed{" "}
              <span className="font-semibold text-slate">{money(balance.unbilledCents)}</span>
            </span>
          </div>

          {statements.length === 0 ? (
            <p className="mt-6 text-[13.5px] text-slate-muted">No statements yet.</p>
          ) : (
            <ul className="mt-6 divide-y divide-limestone-line border-t border-limestone-line">
              {statements.map((s) => (
                <li key={s.id as string} className="py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-[12.5px] font-semibold text-slate">
                      {s.reference as string}
                    </span>
                    <span className="text-[13.5px] text-slate">{s.period as string}</span>
                    <span className="text-[12.5px] text-slate-muted">
                      {s.status === "paid"
                        ? "paid"
                        : s.status === "issued"
                          ? s.due_at
                            ? `due ${new Date(s.due_at as string).toLocaleDateString("en-US")}`
                            : "issued"
                          : s.status === "void"
                            ? "cancelled"
                            : "still being prepared"}
                    </span>
                    <span className="ml-auto text-[14px] font-semibold text-slate">
                      {money(s.total_cents === null ? null : Number(s.total_cents))}
                    </span>
                  </div>
                  {s.status === "issued" ? (
                    <div className="mt-2">
                      <PayStatementButton statementId={s.id as string} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-8 text-[13.5px] text-slate-muted">
        <Link href="/account" className="underline underline-offset-2">
          Back to your account
        </Link>
      </p>
    </main>
  );
}
