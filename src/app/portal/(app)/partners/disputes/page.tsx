import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { disputeView } from "@/lib/ops-partners-admin";
import { money } from "@/lib/ops-money";
import { EmptyState, Panel, RestrictedMode, StatusPill, SystemAlert } from "@/components/portal/design";
import { PageHead } from "@/components/portal/surfaces";
import { LookupForm } from "./LookupForm";

export const dynamic = "force-dynamic";

/**
 * Why an order went to the partner it went to.
 *
 * THIS IS THE SCREEN 0014's TOUCH LOG WAS BUILT FOR
 * -------------------------------------------------
 * That migration keeps every touch, including the ones that lost, and its
 * comment says why: "a dispute is settled by showing the partner the touch that
 * beat theirs, which is impossible if only the winner is kept."
 *
 * Building it found that the join was missing. A touch is keyed by the visitor
 * cookie and the ORDER never stored the key it was attributed under, so the
 * evidence was complete and unreachable from the record it explains. 0022 adds
 * the column; orders attributed before it say so rather than showing an empty
 * list, because an empty list is the claim that there were no touches.
 *
 * NOTHING ON THIS SCREEN CHANGES AN ATTRIBUTION. It cannot: the columns are
 * frozen on a paid order by trigger. A dispute is settled by an adjustment on
 * the partner's ledger, which stands beside what it corrects, and both are on
 * the statement where the partner can read them.
 */
export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "partners.manage")) notFound();

  const { reference } = await searchParams;
  const view = reference ? await disputeView(actor, reference) : null;

  return (
    <>
      <RestrictedMode />

      <p className="-mb-2">
        <Link
          href="/portal/partners"
          className="inline-flex min-h-[var(--tap-target)] items-center text-[13.5px] font-semibold text-[var(--secondary)]"
        >
          All partners
        </Link>
      </p>

      <PageHead
        eyebrow="Referral programme"
        title="Why an order was attributed"
        lede="Every touch behind one order, including the ones that lost. This is what a partner is shown when they think an order should have been theirs."
      />

      <Panel title="Look up an order">
        <LookupForm reference={reference ?? ""} />
      </Panel>

      {reference && !view ? (
        <Panel>
          <EmptyState
            title="No order with that reference"
            body="Check the reference on the order itself. It is the 254 prefixed one the customer was given, not the file number."
          />
        </Panel>
      ) : null}

      {view ? (
        <>
          <Panel title="The order">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="portal-column-header">Reference</dt>
                <dd className="mt-1 font-mono text-[14px] text-[var(--navy)]">{view.order.reference}</dd>
              </div>
              <div>
                <dt className="portal-column-header">Value</dt>
                <dd className="mt-1 text-[14px] tabular-nums text-[var(--navy)]">{money(view.order.totalCents)}</dd>
              </div>
              <div>
                <dt className="portal-column-header">Placed</dt>
                <dd className="mt-1 text-[14px] text-[var(--ink)]">
                  {view.order.placedAt
                    ? new Date(view.order.placedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "not recorded"}
                </dd>
              </div>
              <div>
                <dt className="portal-column-header">Paid</dt>
                <dd className="mt-1 text-[14px] text-[var(--ink)]">
                  {view.order.paidAt ? "yes, so the attribution is frozen" : "not yet"}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="What the rule decided, in its own words">
            {view.attributed.code ? (
              <p className="text-[14.5px] font-semibold text-[var(--navy)]">
                Credited to <span className="font-mono">{view.attributed.code}</span>
              </p>
            ) : (
              <p className="text-[14.5px] font-semibold text-[var(--navy)]">Credited to nobody</p>
            )}
            <p className="mt-2 max-w-[74ch] text-[13.5px] leading-[1.6] text-[var(--ink)]">
              {view.attributed.reason ?? "No reason was recorded, which means this order predates attribution."}
            </p>
            <p className="mt-2 text-[12.5px] text-[var(--secondary)]">
              That sentence is what the rule produced at the time and is stored verbatim. It is not a
              reconstruction.
            </p>
          </Panel>

          {!view.reconstructable ? (
            <SystemAlert condition="The link touches for this order cannot be shown.">
              It was attributed before the order started keeping the visitor key its decision was made
              from, so the click history cannot be joined back to it. Any code typed at checkout is
              still below. This is stated rather than shown as an empty list, because an empty list
              would be the claim that there were no touches.
            </SystemAlert>
          ) : null}

          <Panel
            title="Every touch"
            description="Newest first. The ones that lost are kept deliberately: a partner who did not get credit is entitled to see what beat them."
          >
            {view.touches.length === 0 ? (
              <EmptyState
                title="No touches are recorded against this order"
                body="Either nobody followed a partner link and nobody typed a code, or the order predates the key that joins them."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {view.touches.map((t, index) => (
                  <li key={t.id} className="rounded-[var(--radius-card)] border border-[var(--border)] p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[14.5px] font-semibold text-[var(--navy)]">
                        {t.organisation} <span className="font-mono text-[13px]">{t.code}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <StatusPill tone={t.kind === "code" ? "good" : "inert"}>
                          {t.kind === "code" ? "Typed at checkout" : "Followed a link"}
                        </StatusPill>
                        {index === 0 && t.partnerId === view.attributed.partnerId ? (
                          <StatusPill tone="in-motion">This one won</StatusPill>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-[var(--secondary)]">
                      {new Date(t.occurredAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {t.landingPath ? ` · ${t.landingPath}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Settling it">
            <p className="max-w-[74ch] text-[13.5px] leading-[1.65] text-[var(--ink)]">
              Nothing here changes the attribution, and nothing can: the columns are frozen on a paid
              order at the database. If the firm decides a different partner should have been
              credited, that is an adjustment on each partner&apos;s ledger, recorded from their own
              page with the reason written out.
            </p>
            <p className="mt-3 max-w-[74ch] text-[13.5px] leading-[1.65] text-[var(--ink)]">
              Both entries stand, and both appear on the statements. A partner who was corrected
              downward can read why, which is the difference between a programme somebody trusts and
              one they audit.
            </p>
          </Panel>
        </>
      ) : null}
    </>
  );
}
