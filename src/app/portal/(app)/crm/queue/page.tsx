import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { queueFor, type QueueCard } from "@/lib/crm-queue";
import { CALL_OUTCOME_LABEL, type CallOutcome } from "@/lib/crm-queue-rules";
import { STAGE_LABEL, type CrmStage } from "@/lib/crm-rules";
import { SCRIPT_CLOSE } from "@/content/crm-scripts";
import { telLink } from "@/lib/phone-link";
import { calendarDateLabel, formatInFirmZone } from "@/lib/firm-calendar";
import { ButtonLink, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { OutcomeForm } from "./QueueClient";

export const dynamic = "force-dynamic";

/**
 * THE CALL QUEUE. crm.use, Robert's sales CRM ruling of 2026-11-02, item R3.
 *
 * One company at a time, the next one due: its people with numbers to tap, the
 * script for its vertical, its permit activity, the last three entries in its
 * history and, for a customer, its orders. Recording an outcome writes the
 * call, moves the company by the sequence Robert approved, and draws the next
 * card. Closed outside 8 AM to 8 PM Central.
 */

function activityWords(kind: string, outcome: string | null): string {
  if (kind === "stage_change") return "Stage change";
  const label = outcome && outcome in CALL_OUTCOME_LABEL ? CALL_OUTCOME_LABEL[outcome as CallOutcome] : outcome?.replace(/_/g, " ");
  const what = kind === "call" ? "Call" : kind === "email" ? "Email" : kind === "note" ? "Note" : kind.replace(/_/g, " ");
  return label ? `${what}, ${label.toLowerCase()}` : what;
}

export default async function QueuePage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const view = await queueFor(actor);

  if (!view.ok) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Call queue" />
        <ErrorState title="The queue could not be read" body={`${view.error} This is a failed read, not an empty queue.`} />
      </>
    );
  }

  if (view.closed !== null) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Call queue" />
        <EmptyState title="Outside calling hours" body={view.closed} action={<ButtonLink href="/portal/prospects" tone="ghost">Open the sales list</ButtonLink>} />
      </>
    );
  }

  const lede =
    `Your companies and the ones nobody owns yet, the next one due first. ${view.due.toLocaleString("en-US")} due now.` +
    (view.skippedSuppressed ? ` ${view.skippedSuppressed.toLocaleString("en-US")} passed over because somebody there is on the suppression list.` : "") +
    " Companies whose next step is an email are on Sequence emails.";

  if (!view.card) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Call queue" lede={lede} />
        <EmptyState
          title="Nothing is due to call"
          body="Every company you can call has its next step scheduled later, or there is nobody on the list yet. New companies arrive from Imports or from the sales list."
          action={<ButtonLink href="/portal/prospects" tone="ghost">Open the sales list</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Sales" title="Call queue" lede={lede} />
      <p className="mb-6 text-[14px]"><Link href="/portal/crm/emails" className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline">Open the sequence emails</Link></p>
      <CardView card={view.card} />
    </>
  );
}

function CardView({ card }: { card: QueueCard }) {
  const callable = card.contacts.filter((c) => c.phone);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid gap-8">
        <Panel title={card.company} description={`${card.verticalLabel}. ${card.stageLabel}.${card.city ? ` ${card.city}${card.county ? `, ${card.county} County` : ""}.` : card.county ? ` ${card.county} County.` : ""}`}>
          <dl className="grid gap-2 text-[14px] sm:grid-cols-[150px_1fr]">
            <dt className="font-semibold text-[var(--ink)]">Score</dt>
            <dd className="text-[var(--ink)]">{card.score}</dd>
            <dt className="font-semibold text-[var(--ink)]">Permits on file</dt>
            <dd className="text-[var(--ink)]">
              {card.permitCount
                ? `${card.permitCount.toLocaleString("en-US")}${card.lastPermitOn ? `, the last on ${calendarDateLabel(card.lastPermitOn)}` : ""}`
                : "None recorded"}
            </dd>
            <dt className="font-semibold text-[var(--ink)]">Website</dt>
            <dd>{card.website ? <a href={card.website} className="text-[var(--navy)] underline" rel="noreferrer" target="_blank">{card.website}</a> : <span className="text-[var(--ink)]">None on file</span>}</dd>
            <dt className="font-semibold text-[var(--ink)]">Step</dt>
            <dd className="text-[var(--ink)]">{card.sequenceStep ? `Step ${card.sequenceStep} of 5` : "First call"}</dd>
          </dl>
          <div className="mt-4">
            <Link href={`/portal/crm/${card.id}`} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">Open the company</Link>
          </div>
        </Panel>

        <Panel title="People" description={callable.length ? "Tap a number to call it." : "No number on file. Add one on the company, or record the call as a wrong number."}>
          {card.contacts.length === 0 ? (
            <EmptyState title="Nobody named yet" body="Add a person on the company page." />
          ) : (
            <ul className="grid gap-3">
              {card.contacts.map((c) => {
                const tel = telLink(c.phone);
                return (
                  <li key={c.id} className="border-b border-[var(--row-rule)] pb-3 text-[14px]">
                    <p className="font-semibold text-[var(--ink)]">{c.name ?? "No name on file"}{c.isPrimary ? " (main contact)" : ""}</p>
                    <div className="mt-1 flex flex-wrap gap-x-6">
                      {tel ? (
                        <a href={tel} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline">{c.phone}</a>
                      ) : (
                        <span className="text-[var(--secondary)]">No phone</span>
                      )}
                      {c.reportedWrong ? <span className="inline-flex items-center text-[var(--ink)]">Reported wrong</span> : null}
                      {c.email ? <a href={`mailto:${c.email}`} className="inline-flex min-h-[44px] items-center text-[var(--navy)] underline">{c.email}</a> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-8">
        <Panel title="Script" description={card.script.ok ? (card.script.variant === "open" ? "This line can be ordered now." : "This line is not open for ordering yet, so the script offers the list for when it opens.") : undefined}>
          {card.script.ok ? (
            <>
              {card.script.note ? <p className="mb-3 text-[14px] font-semibold leading-[1.6] text-[var(--ink)]">{card.script.note}</p> : null}
              <p className="max-w-[70ch] text-[15px] leading-[1.7] text-[var(--ink)]">{card.script.text}</p>
              <p className="mt-3 max-w-[70ch] text-[14px] leading-[1.6] text-[var(--secondary)]">{SCRIPT_CLOSE}</p>
            </>
          ) : (
            <ErrorState title="The script could not be shown" body={card.script.error} />
          )}
        </Panel>

        <Panel title="What happened on the call">
          <OutcomeForm
            prospectId={card.id}
            contacts={card.contacts.filter((c) => c.phone).map((c) => ({ id: c.id, label: `${c.name ?? "No name"}, ${c.phone}` }))}
          />
        </Panel>

        <Panel title="The last three entries" description="The newest three from the company's history. The whole history is on the company page.">
          {card.activities.length === 0 ? (
            <EmptyState title="No calls or notes yet" body="This is the first call. What you record above starts the history." />
          ) : (
            <ul className="grid gap-3">
              {card.activities.map((a, i) => (
                <li key={`${a.at}-${i}`} className="border-b border-[var(--row-rule)] pb-3 text-[14px]">
                  <p className="font-semibold text-[var(--ink)]">{activityWords(a.kind, a.outcome)}</p>
                  <p className="text-[var(--secondary)]">{formatInFirmZone(a.at)}{a.byName ? `, ${a.byName}` : ""}</p>
                  {a.body ? <p className="mt-1 text-[var(--ink)]">{a.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {card.orders ? (
          <Panel title="Their orders" description="A customer since the account was opened. Counts and dates only.">
            {card.orders.count === 0 ? (
              <EmptyState title="No order yet" body="The account is open and nothing has been ordered. Ask what is coming up." />
            ) : (
              <>
                <p className="text-[14px] text-[var(--ink)]">{card.orders.count.toLocaleString("en-US")} order{card.orders.count === 1 ? "" : "s"}. The newest:</p>
                <ul className="mt-2 grid gap-1 text-[14px] text-[var(--ink)]">
                  {card.orders.recent.map((o) => (
                    <li key={o.reference}>{o.reference}, {o.placedAt ? formatInFirmZone(o.placedAt) : "not placed yet"}, {o.status.replace(/_/g, " ")}</li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        ) : null}

        <p className="text-[14px] text-[var(--secondary)]">Stage now: {STAGE_LABEL[card.stage as CrmStage]}.</p>
      </div>
    </div>
  );
}
