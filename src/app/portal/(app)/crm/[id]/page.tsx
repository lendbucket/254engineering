import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { assignablePeople, companyPage, type CompanyPage } from "@/lib/crm-pipeline";
import { CRM_STAGES, CUSTOMER_STAGES, STAGE_LABEL, VERTICAL_LABEL } from "@/lib/crm-rules";
import { telLink } from "@/lib/phone-link";
import { calendarDateLabel, formatInFirmZone } from "@/lib/firm-calendar";
import { ButtonLink, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { AssignCompany, CompanyNotes, MoveStage } from "../PipelineClient";

export const dynamic = "force-dynamic";

/**
 * THE COMPANY PAGE. crm.use, Robert's sales CRM ruling of 2026-11-02, item R4:
 * the full timeline (calls, emails, notes, stage changes and where it came
 * from), its people, its notes thread with mentions, the emails it was sent,
 * and the linked account. Editing the details and converting stay on
 * /portal/prospects/[id], one link away, so there is one form for each.
 */
export default async function CompanyPageScreen({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const { id } = await params;
  const read = await companyPage(actor, id);
  if (read.ok && !read.page) notFound();
  if (!read.ok || !read.page) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Company" />
        <ErrorState title="This company could not be read" body={`${read.ok ? "It was not found." : read.error} Nothing was changed.`} />
      </>
    );
  }
  const p = read.page;
  const people = await assignablePeople(actor);
  const inNotes = p.notes.joined ? new Set(p.notes.participants.map((x) => x.id)) : new Set<string>();
  const targets = CRM_STAGES.filter((s) => !CUSTOMER_STAGES.includes(s)).map((s) => ({ stage: s, label: STAGE_LABEL[s] }));

  return (
    <>
      <PageHead
        eyebrow="Sales"
        title={p.company}
        lede={`${VERTICAL_LABEL[p.vertical]}. ${STAGE_LABEL[p.stage]}. ${p.ownerName ? `Owned by ${p.ownerName}.` : "Nobody owns it yet."}`}
      />
      <nav aria-label="This company" className="mb-6 flex flex-wrap gap-x-6 print:hidden">
        <Link href="/portal/crm" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">Back to the pipeline</Link>
        <Link href={`/portal/prospects/${p.id}`} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">Edit details or make them a customer</Link>
      </nav>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-8">
          <Details p={p} />

          <Panel title="People" description={p.contacts.some((c) => c.phone) ? "Tap a number to call it." : "No number on file. Add one from Edit details."}>
            {p.contacts.length === 0 ? (
              <EmptyState title="Nobody named yet" body="Add a person from Edit details." />
            ) : (
              <ul className="grid gap-3">
                {p.contacts.map((c) => {
                  const tel = telLink(c.phone);
                  return (
                    <li key={c.id} className="border-b border-[var(--row-rule)] pb-3 text-[14px]">
                      <p className="font-semibold text-[var(--ink)]">{c.fullName ?? "No name on file"}{c.isPrimary ? " (main contact)" : ""}{c.roleTitle ? `, ${c.roleTitle}` : ""}</p>
                      <div className="mt-1 flex flex-wrap gap-x-6">
                        {tel ? <a href={tel} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline">{c.phone}</a> : <span className="text-[var(--secondary)]">No phone</span>}
                        {c.email ? <a href={`mailto:${c.email}`} className="inline-flex min-h-[44px] items-center text-[var(--navy)] underline">{c.email}</a> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Stage" description={CUSTOMER_STAGES.includes(p.stage) ? "A customer now: the stage follows the account." : p.stage === "do_not_contact" ? "This company asked not to be contacted. That is kept for good." : "Moving the stage writes it to the history."}>
            {CUSTOMER_STAGES.includes(p.stage) || p.stage === "do_not_contact" ? (
              <p className="text-[14px] text-[var(--ink)]">{STAGE_LABEL[p.stage]}.</p>
            ) : (
              <MoveStage prospectId={p.id} stage={p.stage} targets={targets} />
            )}
          </Panel>

          {can(actor, "crm.assign") ? (
            <Panel title="Owner" description="Reassign it to a person, or to the next rep holding its county's territory. Each change is written to the history.">
              {people.ok ? (
                <AssignCompany prospectId={p.id} ownerId={p.ownerId} people={people.rows} />
              ) : (
                <p role="alert" className="text-[14px] text-[var(--ink)]">{people.error} Reassigning is unavailable until it can be read.</p>
              )}
            </Panel>
          ) : null}

          <LinkedAccount p={p} />

          <Panel title="Emails sent" description="Every email the history records as sent to this company.">
            {p.sent.length === 0 ? (
              <EmptyState title="Nothing sent yet" body="Emails sent from the sequence appear here and in the history." />
            ) : (
              <ul className="grid gap-2 text-[14px]">
                {p.sent.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="border-b border-[var(--row-rule)] pb-2">
                    <p className="font-semibold text-[var(--ink)]">{formatInFirmZone(e.at)}{e.byName ? `, ${e.byName}` : ""}</p>
                    {e.body ? <p className="text-[var(--ink)]">{e.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-8">
          <Panel
            title="Notes"
            description={p.notes.joined ? `In these notes: ${p.notes.participants.map((x) => x.name).join(", ")}.` : "The company's own thread, for notes and mentions."}
          >
            <CompanyNotes prospectId={p.id} joined={p.notes.joined} people={people.ok ? people.rows.filter((x) => x.id !== actor.id && !inNotes.has(x.id)) : []} />
            {!people.ok ? <p role="alert" className="mt-3 text-[14px] text-[var(--ink)]">{people.error} Adding a colleague is unavailable until it can be read.</p> : null}
          </Panel>

          <Panel title="History" description="Everything recorded about this company, newest first: calls, emails, notes, stage changes and where it came from.">
            {p.timeline.length === 0 ? (
              <EmptyState title="Nothing recorded yet" body="Calls from the queue, notes and stage moves appear here as they happen." />
            ) : (
              <ol className="grid gap-3">
                {p.timeline.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="border-b border-[var(--row-rule)] pb-3 text-[14px]">
                    <p className="font-semibold text-[var(--ink)]">{e.title}</p>
                    <p className="text-[var(--secondary)]">{formatInFirmZone(e.at)}{e.byName ? `, ${e.byName}` : ""}</p>
                    {e.body ? <p className="mt-1 whitespace-pre-wrap text-[var(--ink)]">{e.body}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Details({ p }: { p: CompanyPage }) {
  return (
    <Panel title="The company">
      <dl className="grid gap-2 text-[14px] sm:grid-cols-[150px_1fr]">
        <dt className="font-semibold text-[var(--ink)]">Where</dt>
        <dd className="text-[var(--ink)]">
          {[p.addressLine, p.city, p.postalCode].filter(Boolean).join(", ") || "No address on file"}
          {p.county ? `. ${p.county} County${p.regionName ? `, ${p.regionName}` : ""}.` : ""}
        </dd>
        <dt className="font-semibold text-[var(--ink)]">Score</dt>
        <dd className="text-[var(--ink)]">{p.score}</dd>
        <dt className="font-semibold text-[var(--ink)]">Next action</dt>
        <dd className="text-[var(--ink)]">{p.nextActionAt ? formatInFirmZone(p.nextActionAt) : "Not scheduled"}</dd>
        <dt className="font-semibold text-[var(--ink)]">Permits on file</dt>
        <dd className="text-[var(--ink)]">{p.permitCount ? `${p.permitCount.toLocaleString("en-US")}${p.lastPermitOn ? `, the last on ${calendarDateLabel(p.lastPermitOn)}` : ""}` : "None recorded"}</dd>
        <dt className="font-semibold text-[var(--ink)]">Website</dt>
        <dd>{p.website ? <a href={p.website} className="text-[var(--navy)] underline" rel="noreferrer" target="_blank">{p.website}</a> : <span className="text-[var(--ink)]">None on file</span>}</dd>
        <dt className="font-semibold text-[var(--ink)]">Tags</dt>
        <dd className="text-[var(--ink)]">{p.tags.length ? p.tags.join(", ") : "None"}</dd>
        <dt className="font-semibold text-[var(--ink)]">Came from</dt>
        <dd className="text-[var(--ink)]">{p.sources.length ? p.sources.map((s) => s.label).join(", ") : "Not recorded"}</dd>
      </dl>
    </Panel>
  );
}

function LinkedAccount({ p }: { p: CompanyPage }) {
  if (!p.account) {
    return (
      <Panel title="Account" description="Not a customer yet.">
        <p className="text-[14px] text-[var(--ink)]">When they want to order, make them a customer from Edit details; the account appears here.</p>
        <div className="mt-3">
          <ButtonLink href={`/portal/prospects/${p.id}`} tone="ghost">Edit details or make them a customer</ButtonLink>
        </div>
      </Panel>
    );
  }
  const a = p.account;
  return (
    <Panel title="Account" description="A customer. Order counts and dates only.">
      {a.orderCount === 0 ? (
        <p className="text-[14px] text-[var(--ink)]">The account is open and nothing has been ordered yet.</p>
      ) : (
        <>
          <p className="text-[14px] text-[var(--ink)]">
            {a.orderCount.toLocaleString("en-US")} order{a.orderCount === 1 ? "" : "s"}
            {a.firstOrderAt ? `, the first on ${formatInFirmZone(a.firstOrderAt)}` : ""}
            {a.lastOrderAt && a.orderCount > 1 ? `, the latest on ${formatInFirmZone(a.lastOrderAt)}` : ""}.
          </p>
          <ul className="mt-2 grid gap-1 text-[14px] text-[var(--ink)]">
            {a.recent.map((o) => (
              <li key={o.reference}>{o.reference}, {o.placedAt ? formatInFirmZone(o.placedAt) : "not placed yet"}, {o.status.replace(/_/g, " ")}</li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
