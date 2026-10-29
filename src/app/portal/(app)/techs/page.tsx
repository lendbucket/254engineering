import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { isKnown, money, type Cents } from "@/lib/ops-money";
import { can } from "@/lib/ops-authz";
import { payLedger, techRoster } from "@/lib/ops-field";
import { canonicalCounty } from "@/lib/ops-counties";
import { services } from "@/content/services";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { CoverageMap } from "@/components/portal/CoverageMap";
import { BaseForm, LedgerActions } from "./TechsClient";
import { VerificationQueue } from "./VerificationQueue";
import { awaitingVerification } from "@/lib/ops-credential-submissions";
import { calendarDateLabel, firmDateLabel } from "@/lib/firm-calendar";
import { ListControls, listHref } from "@/components/portal/ListControls";
import { LIST_EXPORT_GRANT } from "@/lib/list-exports";
import { LIST_NOT_LOADED } from "@/lib/outcome-copy";
import { RetryButton } from "@/components/portal/Unreachable";
import { techListQuery, techListRows } from "@/lib/tech-list";

export const dynamic = "force-dynamic";

/**
 * The field roster.
 *
 * FOUR FACTS PER PERSON, AND THEY ARE THE FOUR DISPATCH RUNS ON
 * -------------------------------------------------------------
 * Coverage and certification, because they are two of the three hard gates and
 * the only two an administrator can do anything about. Open workload, because it
 * is the first sort key in every offer list. And what they are owed, because a
 * technician who has not been paid for three jobs is a technician who stops
 * answering the phone, and that failure looks like a dispatch problem for weeks
 * before anybody traces it back.
 *
 * The map answers the question a roster list cannot: where the bench does not
 * reach. Eight rows of coverage counties do not add up to a shape in anybody's
 * head, and the white areas are where a job would be offered to nobody.
 */

/*
 * Money comes from ops-money now. The private one here was typed
 * (cents: number) with no null branch, so an absent figure printed $0.00 on
 * the same eng_tech_pay_ledger that /portal/pay reads correctly.
 */
const sumKnown = (rows: { amount_cents: number | null }[]): Cents =>
  rows.some((r) => !isKnown(r.amount_cents))
    ? null
    : rows.reduce((s, r) => s + (r.amount_cents as number), 0);

export default async function TechsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!can(actor, "profiles.list")) notFound();
  const params = await searchParams;

  const rosterRead = await techRoster(actor);
  /* Coverage counts every active technician, whatever the list below is filtered to. */
  const roster = rosterRead.ok ? rosterRead.rows : [];
  const query = techListQuery(params);
  const shown = techListRows(roster, query);
  /* A failed ledger read is said in the pay panel, never an empty ledger (F24). */
  const ledgerRead = await payLedger(actor);
  const ledger = ledgerRead.ok ? ledgerRead.rows : [];
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;

  /*
   * Only active technicians count toward coverage. A suspended account's
   * counties are not coverage, and colouring them in would draw a map of a
   * bench the firm does not have.
   */
  const counts: Record<string, number> = {};
  for (const tech of roster) {
    if (tech.status !== "active") continue;
    for (const raw of tech.coverage_counties) {
      const county = canonicalCounty(raw);
      if (county) counts[county] = (counts[county] ?? 0) + 1;
    }
  }

  const nameOf = new Map(roster.map((t) => [t.id, t.display_name]));
  const pending = ledger.filter((l) => l.status === "pending");
  const approved = ledger.filter((l) => l.status === "approved");

  /*
   * CREDENTIALS TECHNICIANS HAVE SUBMITTED, AWAITING VERIFICATION, at the top.
   * Operator ruling of 2026-10-09. Only somebody who can record credentials
   * sees the queue, the same grant verify and reject are refused without.
   */
  const queue = can(actor, "profiles.update") ? await awaitingVerification() : [];

  return (
    <>
      <PageHead
        eyebrow="Field"
        title="Technicians"
        lede="Who works where, what they are certified for, what they are carrying, and what they are owed."
      />

      {can(actor, "profiles.update") ? (
        <Panel
          title={`Awaiting verification${queue && queue.length ? ` (${queue.length})` : ""}`}
          description="Credentials technicians submitted themselves: the type, the issuing state and the expiry, never a document. Dispatch counts none of them until it is verified here."
        >
          {queue === null ? (
            <p className="text-[14px] font-semibold text-[var(--ink)]">
              The submissions could not be read, so this is not an empty queue.
            </p>
          ) : queue.length === 0 ? (
            <p className="text-[14px] text-[var(--secondary)]">Nothing is waiting.</p>
          ) : (
            <VerificationQueue
              rows={queue.map((s) => ({
                id: s.id,
                name: s.name,
                label: s.label,
                detail: [
                  s.issuingState ? `Issued in ${s.issuingState}` : null,
                  s.expiresOn ? `expires ${calendarDateLabel(s.expiresOn)}` : "no expiry",
                ]
                  .filter(Boolean)
                  .join(", "),
                submitted: firmDateLabel(s.submittedAt) ?? "on an unrecorded date",
              }))}
            />
          )}
        </Panel>
      ) : null}

      <ListControls
        action="/portal/techs"
        search={params.q ?? ""}
        searchLabel="Search name, email, phone, city or county"
        filters={[
          {
            name: "status",
            label: "Status",
            value: query.status,
            options: [
              { value: "all", label: "Everyone" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Not active" },
            ],
          },
        ]}
        sorts={[{ value: "name", label: "Name" }, { value: "open", label: "Open jobs" }, { value: "owed", label: "Owed" }]}
        sort={query.sort}
        direction={query.ascending ? "asc" : "desc"}
        csvHref={
          can(actor, LIST_EXPORT_GRANT)
            ? listHref("/api/portal/exports", { q: params.q, status: params.status, sort: params.sort, dir: params.dir }, { report: "technicians" })
            : undefined
        }
      />
      {rosterRead.ok && rosterRead.failed.length ? (
        <Panel className="mb-6" title="Part of the roster could not be read" description="What is listed below is real; what failed is missing from it, not zero.">
          <ul className="text-[14px] leading-[1.55] text-[var(--ink)]">{rosterRead.failed.map((f) => <li key={f}>{f}</li>)}</ul>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
        <div>
          {!rosterRead.ok ? (
            <div role="alert" data-list-not-loaded className="py-6">
              <p className="text-[15px] font-semibold text-[var(--ink)]">{LIST_NOT_LOADED}</p>
              <p className="mt-1 text-[14px] text-[var(--secondary)]">The roster could not be read, so this is not an empty bench.</p>
              <div className="mt-4 flex">
                <RetryButton />
              </div>
            </div>
          ) : roster.length === 0 ? (
            <EmptyState
              title="No technicians yet"
              body="Add a field technician from the people screen. They appear here once the account exists, with their coverage counties and certifications."
            />
          ) : shown.length === 0 ? (
            <EmptyState title="Nobody matches that search" body="Clear the search or the filter to see the whole roster." />
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((tech) => {
                const certified = tech.certifications.filter((c) => c.status === "certified");
                return (
                  <li
                    key={tech.id}
                    className="border-b border-[var(--row-rule)] py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-[17px] leading-[1.25] font-bold text-[var(--ink)]">
                          {/*
                            inline-block, so a name that wraps is ONE box. A wrapped
                            inline link's bounding box has a gap between its line
                            fragments, and a press at its centre lands on the
                            paragraph instead, which native-audit caught.

                            AND AT LEAST THE HOUSE TAP HEIGHT, 44px. The list controls
                            this roster gained (2026-10-24) sit directly above the first
                            row, so a 21px name no longer had the clear space round it
                            that WCAG 2.5.8 lets an undersized target pass on, and
                            mobile-audit refused it at 320px on board 40156724917.
                            inline-flex is still one box, so the wrap rule above holds.
                          */}
                          <Link href={`/portal/techs/${tech.id}`} className="inline-flex min-h-[44px] items-center hover:underline active:opacity-70">
                            {tech.display_name}
                          </Link>
                        </p>
                        <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                          {tech.email}
                          {tech.phone ? <>, <PhoneLink phone={tech.phone} /></> : ""}
                        </p>
                      </div>
                      <Chip
                        label={tech.status}
                        tone={tech.status === "active" ? "good" : tech.status === "invited" ? "warn" : "bad"}
                      />
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="portal-label">
                          Coverage
                        </dt>
                        <dd className="mt-1 text-[14px] leading-[1.5] text-[var(--secondary)]">
                          {tech.coverage_counties.length === 0
                            ? "No counties set. This technician is offered nothing."
                            : `${tech.coverage_counties.length} count${
                                tech.coverage_counties.length === 1 ? "y" : "ies"
                              }: ${tech.coverage_counties.slice(0, 6).join(", ")}${
                                tech.coverage_counties.length > 6 ? ", and more" : ""
                              }`}
                        </dd>
                      </div>

                      <div>
                        <dt className="portal-label">
                          Certified for
                        </dt>
                        <dd className="mt-1 text-[14px] leading-[1.5] text-[var(--secondary)]">
                          {certified.length === 0
                            ? "Nothing yet. Certification is the gate dispatch cannot pass."
                            : certified.map((c) => serviceName(c.service_slug)).join(", ")}
                        </dd>
                      </div>

                      <div>
                        <dt className="portal-label">
                          Workload
                        </dt>
                        <dd className="mt-1 text-[14px] text-[var(--secondary)]">
                          {tech.openJobs === null || tech.completedJobs === null
                            ? "Could not be read"
                            : `${tech.openJobs} open, ${tech.completedJobs} finished`}
                        </dd>
                      </div>

                      <div>
                        <dt className="portal-label">
                          Owed
                        </dt>
                        <dd className="mt-1 text-[14px] text-[var(--secondary)]">
                          {rosterRead.ok && rosterRead.failed.some((f) => f.startsWith("Pay could not be read"))
                            ? "Could not be read, so not shown; it is not zero"
                            : `${money(tech.pendingCents)} outstanding, ${money(tech.paidCents)} paid to date`}
                        </dd>
                      </div>
                    </dl>

                    {tech.expiringCredentials.length > 0 ? (
                      <p className="mt-3 rounded-[2px] border-l-2 border-[var(--ink)] px-3 py-2 text-[14px] leading-[1.5] text-[var(--ink)]">
                        Expiring within 45 days:{" "}
                        {tech.expiringCredentials
                          .map((c) => `${c.kind.replace(/_/g, " ")} on ${c.expires_on}`)
                          .join(", ")}
                        . An insurance certificate that lapses is a dispatching problem, not a
                        filing one.
                      </p>
                    ) : null}

                    <div className="mt-4 border-t border-[var(--border)] pt-4">
                      <BaseForm
                        techId={tech.id}
                        baseCity={tech.base_city}
                        baseCounty={tech.base_county}
                        lat={tech.base_lat}
                        lng={tech.base_lng}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Where the bench reaches">
            <CoverageMap counts={counts} />
          </Panel>

          <Panel
            title="Pay ledger"
            description="An entry is written when a technician submits a package, not when the file is sealed. What they were paid for is the visit, and the visit is done."
          >
            {!ledgerRead.ok ? (
              <p role="alert" className="text-[14px] leading-[1.55] text-[var(--ink)]">
                {ledgerRead.error} So no figure is shown here: this is a failed read, not an empty ledger.
              </p>
            ) : ledger.length === 0 ? (
              <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
                Nothing yet. The first entry appears when a technician submits an evidence package.
              </p>
            ) : (
              <>
                <dl className="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="portal-label">
                      Awaiting approval
                    </dt>
                    <dd className="mt-1 font-display text-[17px] font-bold text-[var(--ink)]">
                      {money(sumKnown(pending))}
                    </dd>
                  </div>
                  <div>
                    <dt className="portal-label">
                      Approved, unpaid
                    </dt>
                    <dd className="mt-1 font-display text-[17px] font-bold text-[var(--ink)]">
                      {money(sumKnown(approved))}
                    </dd>
                  </div>
                </dl>

                <LedgerActions
                  rows={ledger.slice(0, 40).map((l) => ({
                    id: l.id,
                    techName: nameOf.get(l.tech_id) ?? "Unknown",
                    amount: money(l.amount_cents),
                    status: l.status,
                    note: l.note,
                    fileId: l.file_id,
                  }))}
                />
              </>
            )}
          </Panel>

          <Panel title="Certification">
            <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
              A technician is offered work only in service lines they are certified for, and that
              gate is not a preference dispatch weighs. The certification workflow itself, the
              training run and the score, is Phase 3. Until it ships, certifications are set
              directly against the record.
            </p>
            <Link
              href="/portal/people"
              className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
            >
              Manage accounts on the people screen
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
