import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { partnerDetail } from "@/lib/ops-partners-admin";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/ops-money";
import { AbsentChip, EmptyState, Panel, RestrictedMode, StatusPill } from "@/components/portal/design";
import { PageHead } from "@/components/portal/surfaces";
import {
  AdjustmentForm,
  DecideSubmission,
  InviteForm,
  MoneyActions,
  StatusForm,
  TermsForm,
} from "./PartnerActions";

export const dynamic = "force-dynamic";

const MODEL_LABEL: Record<string, string> = {
  percent_of_order: "A percentage of the order",
  flat_per_order: "A flat fee for each order",
  flat_per_qualified_lead: "A flat fee for each qualified lead",
  tiered_by_volume: "A percentage that improves with volume",
};

/**
 * One partner: what they have sent, what they are owed, and everything the firm
 * can decide about them.
 *
 * THE LEDGER IS ON THIS SCREEN IN FULL
 * ------------------------------------
 * Not a balance with a link to the detail. The whole argument of Phase 9
 * Section 3 is that a partner can reconcile what they are told against entries
 * that never move, and the operator side of that argument is being able to see
 * exactly what the partner sees while talking to them on the telephone.
 */
export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "partners.manage")) notFound();

  const { id } = await params;
  const detail = await partnerDetail(actor, id);
  if (!detail) notFound();

  const { partner, terms, people, statements, ledger, netCents, blocked } = detail;

  /*
   * Read here rather than in the module, because it is the one thing on this
   * screen that belongs to the asset library rather than to the partner record.
   */
  const db = supabaseAdmin();
  const { data: submissions } = db
    ? await db
        .from("eng_partner_submissions")
        .select("id, kind, title, body, link, status, decision_note, decided_at, created_at")
        .eq("partner_id", id)
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] };

  const current = terms.find((t) => !t.effectiveTo) ?? terms[0] ?? null;
  const actionable = statements.filter((s) => s.status === "open" || s.status === "issued");

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
        title={partner.organisation}
        lede={`Code ${partner.code}. ${partner.contactName}, ${partner.contactEmail}.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="State">
          <StatusPill
            tone={partner.status === "active" ? "good" : partner.status === "suspended" ? "failed" : "inert"}
          >
            {partner.status === "active" ? "Active" : partner.status === "suspended" ? "Suspended" : "Ended"}
          </StatusPill>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--secondary)]">
            {partner.agreementVersion
              ? `On agreement version ${partner.agreementVersion}.`
              : "No agreement version accepted."}
          </p>
        </Panel>

        <Panel title="Net on the ledger">
          <p className="font-display text-[24px] leading-none font-bold tabular-nums text-[var(--navy)]">
            {money(netCents)}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--secondary)]">
            Accruals, reversals and adjustments together, whether or not they are on a statement.
          </p>
        </Panel>

        <Panel title="Waiting for a figure">
          <p className="font-display text-[24px] leading-none font-bold tabular-nums text-[var(--navy)]">
            {blocked}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--secondary)]">
            Owed, and not yet computable. Excluded from every total rather than counted as nothing.
          </p>
        </Panel>
      </div>

      <Panel title="Compensation terms" description="Effective dated. A change is a new row, never an edit.">
        {current ? (
          <div className="mb-5 rounded-[var(--radius-card)] border border-[var(--border)] p-3">
            <p className="text-[14.5px] font-bold text-[var(--navy)]">
              {MODEL_LABEL[current.model] ?? current.model}
            </p>
            <p className="mt-1 text-[13.5px] leading-[1.55] text-[var(--ink)]">
              {current.percentBps !== null ? `${current.percentBps / 100} percent. ` : ""}
              {current.flatCents !== null ? `${money(current.flatCents)} each. ` : ""}
              Holdback {current.holdbackDays} days. In force from {current.effectiveFrom}
              {current.effectiveTo ? ` to ${current.effectiveTo}` : ""}.
            </p>
            {current.note ? (
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--secondary)]">{current.note}</p>
            ) : null}
          </div>
        ) : (
          <div className="mb-5">
            <EmptyState
              title="No terms are set"
              body="Every delivery this partner is credited for will be recorded as owed with no figure until terms exist. Nothing is lost, and nothing can be paid either."
            />
          </div>
        )}

        {terms.length > 1 ? (
          <details className="mb-5">
            <summary className="min-h-[var(--tap-target)] cursor-pointer text-[13.5px] font-semibold text-[var(--navy)]">
              {terms.length - 1} earlier set{terms.length - 1 === 1 ? "" : "s"} of terms
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {terms.slice(1).map((t) => (
                <li key={t.id} className="text-[13px] leading-[1.55] text-[var(--secondary)]">
                  {MODEL_LABEL[t.model] ?? t.model}, from {t.effectiveFrom}
                  {t.effectiveTo ? ` to ${t.effectiveTo}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <TermsForm partnerId={partner.id} />
      </Panel>

      <Panel title="Who signs in" description="An organisation outlives whoever holds the login.">
        {people.length === 0 ? (
          <div className="mb-5">
            <EmptyState
              title="Nobody yet"
              body="Adding a partner does not create a login. Invite somebody below and send them the link yourself."
            />
          </div>
        ) : (
          <ul className="mb-5 flex flex-col gap-2">
            {people.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--border)] p-3"
              >
                <div>
                  <p className="text-[14.5px] font-semibold text-[var(--navy)]">{u.displayName}</p>
                  <p className="text-[12.5px] text-[var(--secondary)]">{u.email}</p>
                </div>
                <StatusPill tone={u.status === "active" ? "good" : u.status === "invited" ? "pending" : "failed"}>
                  {u.status === "active" ? "Active" : u.status === "invited" ? "Invited" : "Suspended"}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
        <InviteForm partnerId={partner.id} />
      </Panel>

      <Panel title="Statements and payouts">
        {statements.length === 0 ? (
          <div className="mb-5">
            <EmptyState
              title="No statements"
              body="Close a period below once something is payable. Nothing is opened when the net is zero or negative."
            />
          </div>
        ) : (
          <ul className="mb-5 flex flex-col gap-2">
            {statements.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--border)] p-3"
              >
                <div>
                  <p className="font-mono text-[14px] font-semibold text-[var(--navy)]">{s.reference}</p>
                  <p className="text-[12.5px] text-[var(--secondary)]">
                    {s.period}
                    {s.paidAt
                      ? `, paid ${new Date(s.paidAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[14px] font-semibold tabular-nums text-[var(--navy)]">
                    {money(s.totalCents)}
                  </span>
                  <StatusPill tone={s.status === "paid" ? "good" : s.status === "issued" ? "in-motion" : "pending"}>
                    {s.status}
                  </StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}

        <MoneyActions
          partnerId={partner.id}
          openStatements={actionable.map((s) => ({ id: s.id, reference: s.reference, status: s.status }))}
        />
      </Panel>

      <Panel
        title="The ledger"
        description="Exactly what the partner sees. Nothing here is ever edited: a correction is an entry beside it."
      >
        {ledger.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            body="An entry is written when a file this partner is credited for reaches delivered, or when a lead of theirs is converted under a lead fee."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {ledger.map((e) => (
              <li key={e.id} className="rounded-[var(--radius-card)] border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p
                    className={`text-[14.5px] font-bold tabular-nums ${
                      e.kind === "reversal" ? "text-[var(--red)]" : "text-[var(--navy)]"
                    }`}
                  >
                    {e.status === "blocked" ? <AbsentChip>owed, figure not known</AbsentChip> : money(e.amountCents)}
                  </p>
                  <StatusPill
                    tone={e.kind === "reversal" ? "failed" : e.status === "blocked" ? "pending" : "good"}
                  >
                    {e.kind}
                  </StatusPill>
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--ink)]">{e.explanation}</p>
                <p className="mt-1.5 text-[12px] text-[var(--secondary)]">
                  {new Date(e.occurredAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {e.statementId ? " · on a statement" : " · not yet on a statement"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Correct something" description="The only way a decided figure changes.">
        <AdjustmentForm partnerId={partner.id} />
      </Panel>

      <Panel title="Material they have sent">
        {(submissions ?? []).length === 0 ? (
          <EmptyState
            title="Nothing sent"
            body="A partner can send wording or artwork from their own portal to be looked at before they publish it."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {(submissions ?? []).map((s) => (
              <li key={s.id as string} className="rounded-[var(--radius-card)] border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14.5px] font-bold text-[var(--navy)]">{s.title as string}</p>
                  <StatusPill
                    tone={
                      s.status === "approved" ? "good" : s.status === "changes_requested" ? "failed" : "pending"
                    }
                  >
                    {s.status as string}
                  </StatusPill>
                </div>

                {s.body ? (
                  <p className="mt-2 max-w-[74ch] text-[13.5px] leading-[1.6] text-[var(--ink)]">
                    {s.body as string}
                  </p>
                ) : null}
                {s.link ? (
                  <p className="mt-2 break-all text-[13px] text-[var(--secondary)]">{s.link as string}</p>
                ) : null}

                {/*
                  THE FIRM'S OWN READ OF IT, BEFORE ANYBODY DECIDED.

                  Written when the submission arrived, by the same patterns that
                  refuse the firm's own copy. It is advice and not a decision: a
                  person still says yes or no, and the note they write replaces
                  this one.
                */}
                {!s.decided_at && s.decision_note ? (
                  <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--gold-wash)] px-3 py-2 text-[13px] leading-[1.55] text-[var(--warn-ink)]">
                    Before anybody read it: {s.decision_note as string}
                  </p>
                ) : null}

                {s.decided_at ? (
                  <p className="mt-2 text-[13px] leading-[1.55] text-[var(--ink)]">
                    {(s.decision_note as string) ?? ""}
                  </p>
                ) : (
                  <DecideSubmission submissionId={s.id as string} partnerId={partner.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Ending or pausing this partner">
        <StatusForm partnerId={partner.id} status={partner.status} />
      </Panel>
    </>
  );
}
