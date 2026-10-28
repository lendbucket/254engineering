import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { currentRefundLimit } from "@/lib/ops-refund-requests";
import { listAlertRecipients } from "@/lib/alert-recipients";
import { money } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { RefundLimitForm } from "../refunds/RefundClient";
import { AddAlertRecipient, RemoveAlertRecipient } from "./AlertRecipientsClient";

export const dynamic = "force-dynamic";

/**
 * SETTINGS THE OPERATOR CHANGES. settings.refund_limit, admin alone,
 * 2026-10-20. The most a refund request may be approved for by somebody
 * without payments.refund. It starts at $0 until it is set, and every change
 * is a dated row with who made it, so the history is never lost.
 *
 * AND WHERE THE OFFICE'S ALERTS GO, alerts.manage, the owner alone (Robert's
 * addendum of 2026-10-25, item 8b; 0099). An empty list sends every alert to
 * the firm's notification address, which is server side and not printed here.
 */
export default async function SettingsPage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "settings.refund_limit")) notFound();
  const limit = await currentRefundLimit();
  const manageAlerts = can(actor, "alerts.manage");
  const recipients = manageAlerts ? await listAlertRecipients() : null;

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

      {manageAlerts ? (
        <div className="mt-6">
          <Panel
            title="Where alerts go"
            description="Faults, a stuck queue, an outage, a payment whose work did not start, a failed refund, retention, and files past their target date. Each address on the list receives every one."
          >
            {recipients === null ? (
              <ErrorState
                title="The list could not be read"
                body="This is not the same as an empty list. Alerts still go out: when the list cannot be read they go to the firm's notification address. Try again in a minute."
              />
            ) : (
              <>
                {recipients.length === 0 ? (
                  <EmptyState
                    title="No address is on the list"
                    body="Every alert goes to the firm's notification address until one is added. Add an address below to send them there instead."
                  />
                ) : (
                  <ul className="mb-4 flex flex-col">
                    {recipients.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--row-rule)] py-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold break-words text-[var(--ink)]">{r.email}</p>
                          <p className="mt-0.5 text-[13px] text-[var(--secondary)]">Added {formatInFirmZone(r.addedAt) ?? "on an unrecorded date"}</p>
                        </div>
                        <RemoveAlertRecipient id={r.id} email={r.email} last={recipients.length === 1} />
                      </li>
                    ))}
                  </ul>
                )}
                <AddAlertRecipient />
              </>
            )}
          </Panel>
        </div>
      ) : null}
    </>
  );
}
