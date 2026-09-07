import Link from "next/link";
import { currentPartner } from "@/lib/partner-auth";
import { agreementOutstanding, currentAgreement, partnerOverview } from "@/lib/ops-partner-portal";
import { money } from "@/lib/ops-money";
import {
  AbsentChip,
  EmptyState,
  Figure,
  Panel,
  RestrictedMode,
  StatusPill,
  SystemAlert,
} from "@/components/portal/design";

export const dynamic = "force-dynamic";

/**
 * What this partner has sent, and what the firm owes them.
 *
 * THE FOUR FIGURES, AND WHY EACH IS LABELLED THE WAY IT IS
 * --------------------------------------------------------
 * "Earned and not yet on a statement" rather than "balance", because a balance
 * reads as a thing you can ask for and this one may still move: an accrual
 * inside its holdback window is money the firm expects to pay and has not
 * committed to.
 *
 * "Held back" is shown separately rather than folded in, because a partner who
 * sees one number and gets a smaller payment assumes they were shorted. Two
 * numbers and a sentence is the difference between a programme somebody trusts
 * and one they audit.
 *
 * "Waiting for a figure" is a COUNT and never a zero. Those are commissions the
 * firm owes and cannot yet compute, and rolling them into the total as nothing
 * would understate what is owed in the direction nobody complains about.
 */
export default async function PartnerHome() {
  const principal = await currentPartner();
  if (!principal) return null;

  const overview = await partnerOverview(principal);
  const agreement = await currentAgreement();
  const outstanding = agreementOutstanding(principal, agreement);

  return (
    <>
      <RestrictedMode />

      {outstanding ? (
        <SystemAlert condition="The programme agreement has been updated.">
          Read and accept the current version. Referrals already made are unaffected and what has
          been earned stands.{" "}
          <Link href="/partner/agreement" className="font-semibold underline">
            Read it now
          </Link>
        </SystemAlert>
      ) : null}

      <div>
        <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
          {principal.partner.organisation}
        </h1>
        <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          Your referral code is{" "}
          <span className="font-mono font-semibold text-[var(--navy)]">{principal.partner.code}</span>. It
          works as a link and as a code somebody says on the telephone, and either one credits you
          for thirty days.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          label="Earned, not yet on a statement"
          value={money(overview.payableCents)}
          note="Past its holdback window and gathered into the next statement."
        />
        <Figure
          label="Held back"
          value={money(overview.heldCents)}
          note="Earned, and inside the window that lets a refund reverse it first."
        />
        <Figure
          label="On an issued statement"
          value={money(overview.issuedCents)}
          note="Told to you and not yet recorded as paid."
        />
        <Figure
          label="Referrals"
          value={String(overview.referrals)}
          note={`${overview.delivered} of them have earned a commission entry.`}
        />
      </div>

      {overview.blocked > 0 ? (
        <SystemAlert condition={`${overview.blocked} commission${overview.blocked === 1 ? "" : "s"} is owed with no figure yet.`}>
          Something about those referrals means the amount cannot be worked out yet. They are not
          counted as nothing and they are not lost. The firm has the same list.
        </SystemAlert>
      ) : null}

      <Panel
        title="Recent activity"
        description="Every entry on your ledger, in the order it happened, with the reason it was written."
      >
        {overview.recent.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            body="An entry appears here when the firm delivers work you referred. Nothing is written when an order is placed, only when it is delivered."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {overview.recent.map((row) => (
              <li
                key={row.id}
                className="rounded-[var(--radius-card)] border border-[var(--border)] p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-bold tabular-nums text-[var(--navy)]">
                    {row.status === "blocked" ? <AbsentChip>owed, figure not yet known</AbsentChip> : money(row.amountCents)}
                  </p>
                  <StatusPill
                    tone={
                      row.kind === "reversal" ? "failed" : row.status === "blocked" ? "pending" : "good"
                    }
                  >
                    {row.kind === "reversal"
                      ? "Reversed"
                      : row.kind === "adjustment"
                        ? "Adjustment"
                        : "Earned"}
                  </StatusPill>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--ink)]">{row.explanation}</p>
                <p className="mt-1.5 text-[12px] text-[var(--secondary)]">
                  {new Date(row.occurredAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {row.statementId ? " · on a statement" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="How you are paid"
        description="Recorded by the firm, and shown here so there is one version of it."
      >
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="portal-column-header">Method</dt>
            <dd className="text-[13.5px] text-[var(--ink)] sm:mt-1">
              {principal.partner.payoutMethod ?? <AbsentChip>not recorded</AbsentChip>}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 sm:block">
            <dt className="portal-column-header">Reference</dt>
            <dd className="text-[13.5px] text-[var(--ink)] sm:mt-1">
              {principal.partner.payoutReference ?? <AbsentChip>not recorded</AbsentChip>}
            </dd>
          </div>
        </dl>
        {/*
          NOT EDITABLE HERE, AND THAT IS THE FEATURE.

          A referrer who can change where money is sent, from a session, is the
          shape of every payout fraud that has ever worked. Changing these is a
          conversation with the firm, and the firm records it.
        */}
        <p className="mt-3 max-w-[70ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
          These are changed by speaking to the firm rather than here. Payment details that can be
          changed from a signed in session are the first thing anybody who takes over an account
          changes.
        </p>
      </Panel>
    </>
  );
}
