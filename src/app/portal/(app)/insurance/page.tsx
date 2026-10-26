import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { money } from "@/lib/ops-money";
import { todayInFirmCalendar } from "@/lib/firm-calendar";
import { INSURANCE_KIND_LABEL, daysToExpiry, listPolicies } from "@/lib/ops-insurance";
import { Chip, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { RecordPolicyForm, WithdrawPolicy } from "./InsuranceClient";

export const dynamic = "force-dynamic";

/**
 * THE FIRM'S INSURANCE. Robert's addendum of 2026-10-25, item 1: the office and
 * the owner record each policy from its certificate, open the certificate, and
 * withdraw a policy recorded in error or replaced. Nothing here is edited or
 * deleted. Whether the launch gate reads this register is a ruling still to
 * come, so the screen says so rather than implying it does.
 */
export default async function InsurancePage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "insurance.manage")) notFound();
  const read = await listPolicies(actor);
  const today = todayInFirmCalendar();

  return (
    <>
      <PageHead
        eyebrow="Firm"
        title="Insurance"
        lede="Each policy as its certificate states it, with the certificate kept beside it. The office and the owner are warned 45, 14 and 1 days before one expires."
      />
      <Panel
        title="On the register"
        description="Recording a policy here does not yet change whether the firm may take orders; that still reads the policy recorded in the code, until the owner rules otherwise."
      >
        {!read.ok ? (
          <ErrorState title="The register could not be read" body={`${read.error} Reload the page to try again.`} />
        ) : read.policies.length === 0 ? (
          <EmptyState title="No policy is recorded yet" body="Record the professional liability policy below from its certificate, once it is bound." />
        ) : (
          <ul className="divide-y divide-[var(--row-rule)]">
            {read.policies.map((p) => {
              const left = daysToExpiry(p.expiresOn, today);
              const tone = p.withdrawnAt ? "neutral" : left < 0 ? "bad" : left <= 45 ? "warn" : "good";
              const status = p.withdrawnAt ? "Withdrawn" : left < 0 ? "Expired" : left === 0 ? "Expires today" : `${left} days left`;
              return (
                <li key={p.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                    <span className="text-[15px] font-semibold text-[var(--ink)]">
                      {INSURANCE_KIND_LABEL[p.kind]}, {p.carrier}, policy {p.policyNumber}
                    </span>
                    <Chip label={status} tone={tone} />
                  </div>
                  <p className="mt-1 text-[14px] leading-[1.55] text-[var(--ink)]">
                    {money(p.limitPerClaimCents)} per claim, {money(p.limitAggregateCents)} aggregate. In force {p.effectiveOn} to {p.expiresOn}.
                    Named insureds: {p.namedInsureds.join("; ")}.
                  </p>
                  {p.withdrawnAt ? (
                    <p className="mt-1 text-[14px] leading-[1.55] text-[var(--ink)]">Withdrawn: {p.withdrawnReason}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-start gap-3">
                    <a
                      href={`/api/portal/insurance?certificate=${p.id}`}
                      className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline underline-offset-4"
                    >
                      Open the certificate
                    </a>
                    {p.withdrawnAt ? null : <WithdrawPolicy id={p.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title="Record a policy" description="Type each figure exactly as the certificate prints it, and attach the certificate as a PDF.">
        <RecordPolicyForm />
      </Panel>
    </>
  );
}
