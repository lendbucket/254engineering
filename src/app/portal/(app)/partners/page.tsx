import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { partnerRoster } from "@/lib/ops-partners-admin";
import { submissionsAwaitingDecision } from "@/lib/ops-partner-assets";
import { money } from "@/lib/ops-money";
import {
  DataTable,
  EmptyState,
  Panel,
  RestrictedMode,
  StatusPill,
  type Column,
} from "@/components/portal/design";
import { PageHead } from "@/components/portal/surfaces";
import { NewPartner } from "./NewPartner";
import type { PartnerRow } from "@/lib/ops-partners-admin";

export const dynamic = "force-dynamic";

/**
 * The referral roster.
 *
 * WHY THE FIGURES ARE ON THE LIST RATHER THAN ONE CLICK IN
 * ---------------------------------------------------------
 * The two questions an operator opens this screen with are who is sending work
 * and who is owed money. A roster of names with a chevron answers neither, and
 * the answer is two joins away, so it is here.
 *
 * "Waiting for a figure" is a count and never a zero: those are commissions the
 * firm owes and cannot yet compute, and rolling them into a total as nothing
 * would understate what the firm owes in the direction nobody questions.
 */
export default async function PartnersPage() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "partners.manage")) notFound();

  const rows = await partnerRoster(actor);
  const queue = await submissionsAwaitingDecision();

  const columns: Column<PartnerRow>[] = [
    {
      key: "organisation",
      header: "Partner",
      cell: (p) => <span className="font-semibold">{p.organisation}</span>,
    },
    { key: "code", header: "Code", cell: (p) => <span className="font-mono">{p.code}</span> },
    {
      key: "status",
      header: "State",
      cell: (p) => (
        <StatusPill tone={p.status === "active" ? "good" : p.status === "suspended" ? "failed" : "inert"}>
          {p.status === "active" ? "Active" : p.status === "suspended" ? "Suspended" : "Ended"}
        </StatusPill>
      ),
    },
    { key: "referrals", header: "Referrals", numeric: true, cell: (p) => String(p.referrals) },
    {
      key: "payable",
      header: "Payable now",
      numeric: true,
      cell: (p) => <span className="font-semibold">{money(p.payableCents)}</span>,
    },
    {
      key: "blocked",
      header: "Waiting for a figure",
      numeric: true,
      cell: (p) => (p.blocked === 0 ? "none" : <span className="font-semibold">{p.blocked}</span>),
    },
    { key: "people", header: "People", numeric: true, cell: (p) => String(p.people) },
  ];

  const anythingBlocked = rows.reduce((n, r) => n + r.blocked, 0);

  /*
   * ENDED PARTNERS ARE BEHIND A DISCLOSURE, NOT HIDDEN.
   *
   * The roster answers who is sending work. An ended relationship is history
   * and belongs on the screen, because the ledger and the statements are still
   * there, but putting it in the same list makes the list about the past.
   *
   * The count is on the summary line, so nothing disappears silently. On
   * development this is also where eight probe partners live: they were created
   * by a script from Section 2 that held no ledger, and they cannot be deleted
   * because each one has a touch and the touch log refuses deletion by design.
   */
  const live = rows.filter((r) => r.status !== "ended");
  const ended = rows.filter((r) => r.status === "ended");

  return (
    <>
      <RestrictedMode
        also={
          <>
            A commission accrues when a file reaches delivered, and no file can reach delivered while
            the gate is down. Attribution is being recorded now; nothing is being earned yet.
          </>
        }
      />

      <PageHead
        eyebrow="Referral programme"
        title="Partners"
        lede="Who is sending work, what the firm owes them, and what is waiting for a person."
      />

      {queue.length > 0 ? (
        <Panel
          title={`${queue.length} piece${queue.length === 1 ? "" : "s"} of material waiting for a decision`}
          description="A partner sent these to be looked at before publishing them. The firm's own read of each is on the partner's page."
        >
          <ul className="flex flex-col gap-2">
            {queue.map((s) => (
              <li key={s.id as string} className="rounded-[var(--radius-card)] border border-[var(--border)] p-3">
                <Link
                  href={`/portal/partners/${s.partner_id}`}
                  className="text-[14.5px] font-semibold text-[var(--navy)] underline"
                >
                  {s.title as string}
                </Link>
                <p className="mt-1 text-[12.5px] text-[var(--secondary)]">
                  Sent{" "}
                  {new Date(s.created_at as string).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {anythingBlocked > 0 ? (
        <Panel title={`${anythingBlocked} commission${anythingBlocked === 1 ? "" : "s"} is owed with no figure`}>
          <p className="max-w-[74ch] text-[13.5px] leading-[1.6] text-[var(--ink)]">
            Something about those deliveries means the amount could not be worked out: usually terms
            that were not in force on the day, or an order with no total. They are not counted as
            nothing and they are not lost. Open the partner to see which.
          </p>
        </Panel>
      ) : null}

      <Panel
        title="The roster"
        description="Created by the firm, never by signup. A partner using the firm's name is a decision the firm makes."
      >
        <DataTable
          caption="Referral partners"
          columns={columns}
          rows={live}
          total={live.length}
          onRowHref={(p) => `/portal/partners/${p.id}`}
          empty={
            <EmptyState
              title="No partners yet"
              body="Nothing is attributed and nothing is owed until one exists. Every ?ref= on the live site is currently a 204 that writes nothing."
            />
          }
        />
      </Panel>

      {ended.length > 0 ? (
        <Panel>
          <details>
            <summary className="flex min-h-[var(--tap-target)] cursor-pointer items-center text-[13.5px] font-semibold text-[var(--navy)]">
              {ended.length} ended partner{ended.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {ended.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/portal/partners/${p.id}`} className="text-[13.5px] font-semibold text-[var(--navy)] underline">
                    {p.organisation}
                  </Link>
                  <span className="font-mono text-[12.5px] text-[var(--secondary)]">{p.code}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
              An ended partner keeps its ledger and its statements. Ending a relationship and
              refusing to pay for work already delivered are different decisions.
            </p>
          </details>
        </Panel>
      ) : null}

      <Panel title="Add a partner">
        <NewPartner />
      </Panel>
    </>
  );
}
