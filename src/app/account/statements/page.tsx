import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { statementsFor } from "@/lib/ops-statements";
import { accountBalance } from "@/lib/ops-bulk";
import { Wordmark } from "@/components/brand/Wordmark";
import { money } from "@/lib/ops-money";
import { registrationLine } from "@/lib/launch";
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
    /*
     * RESTYLED TO DESIGN V10, 2026-09-29. Shell and headings; the statement
     * rows below keep the portal's money styling for now, which is recorded in
     * BACKLOG.md with the other interiors still owed a pass.
     */
    <div className="v10-phone-ground flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/account" prefetch={false} aria-label="254 Engineering Services, your account">
            {/* v5's header rule as CSS. See the note on /account/login. */}
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" />
          </Link>
          <Link
            href="/account"
            prefetch={false}
            className="text-[14px] font-semibold text-[var(--color-link)]"
          >
            Your account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div>
          <p className="v10-label">Your account</p>
          <h1 className="mt-2.5 text-[clamp(1.65rem,3vw,2rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
            Statements
          </h1>
          <p className="mt-3 max-w-[62ch] text-[1rem] leading-[1.7] text-[var(--secondary)]">
            {me.account.billingMode !== "invoice"
              ? "This account pays by card when it orders, so there is nothing to be billed for later and no statements are produced."
              : `Work is billed at the end of each period on ${me.account.netDays} day terms. Anything done since the last statement shows below as not yet billed.`}
          </p>
        </div>

      {me.account.billingMode !== "invoice" ? null : (
        <div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-[var(--row-rule)] pb-4">
            <span className="text-[14px] text-[var(--secondary)]">
              Issued and unpaid{" "}
              <span className="font-semibold text-[var(--ink)]">{money(balance.issuedUnpaidCents)}</span>
            </span>
            <span className="text-[14px] text-[var(--secondary)]">
              Not yet billed{" "}
              <span className="font-semibold text-[var(--ink)]">{money(balance.unbilledCents)}</span>
            </span>
          </div>

          {statements.length === 0 ? (
            <p className="mt-6 text-[14px] text-[var(--secondary)]">No statements yet.</p>
          ) : (
            <ul className="mt-6 divide-y divide-limestone-line border-t border-[var(--border)]">
              {statements.map((s) => (
                <li key={s.id as string} className="py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="v10-code text-[13px] font-semibold text-[var(--ink)]">
                      {s.reference as string}
                    </span>
                    <span className="text-[14px] text-[var(--ink)]">{s.period as string}</span>
                    <span className="text-[13px] text-[var(--secondary)]">
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
                    <span className="ml-auto text-[14px] font-semibold text-[var(--ink)]">
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
        </div>
      )}

        <p className="mt-10 text-[14px] text-[var(--color-ink-quiet)]">
          <Link href="/account" className="text-[var(--color-link)] underline underline-offset-2">
            Back to your account
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
