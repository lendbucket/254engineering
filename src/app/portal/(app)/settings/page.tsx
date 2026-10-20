import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { currentRefundLimit } from "@/lib/ops-refund-requests";
import { money } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { RefundLimitForm } from "../refunds/RefundClient";

export const dynamic = "force-dynamic";

/**
 * SETTINGS THE OPERATOR CHANGES. settings.refund_limit, admin alone,
 * 2026-10-20. One today: the most a refund request may be approved for by
 * somebody without payments.refund. It starts at $0 until it is set, and every
 * change is a dated row with who made it, so the history is never lost.
 */
export default async function SettingsPage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "settings.refund_limit")) notFound();
  const limit = await currentRefundLimit();

  return (
    <>
      <PageHead eyebrow="Firm" title="Settings" lede="Values you set for the firm. Each change is recorded with who made it and when." />
      <Panel
        title="Refund approval limit"
        description="The most an operations manager may approve on one refund request. Anything above it waits for an administrator. Zero means every refund waits for an administrator."
      >
        {!limit.ok ? (
          <ErrorState title="The limit could not be read" body={`${limit.error} Until it can, nothing can be approved under it.`} />
        ) : (
          <>
            <p className="mb-4 text-[14px] text-[var(--ink)]">
              {limit.setAt
                ? `Currently ${money(limit.cents)}, set ${formatInFirmZone(limit.setAt) ?? "on an unrecorded date"}.`
                : "Currently $0.00. It has never been set."}
            </p>
            <RefundLimitForm currentDollars={limit.cents / 100} />
          </>
        )}
      </Panel>
    </>
  );
}
