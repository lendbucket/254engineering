import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { payLedger, techRoster } from "@/lib/ops-field";
import { canonicalCounty } from "@/lib/ops-counties";
import { services } from "@/content/services";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { CoverageMap } from "@/components/portal/CoverageMap";
import { BaseForm, LedgerActions } from "./TechsClient";

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

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export default async function TechsPage() {
  const actor = await currentActor();
  if (!can(actor, "profiles.list")) notFound();

  const roster = await techRoster(actor);
  const ledger = await payLedger(actor);
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

  return (
    <>
      <PageHead
        eyebrow="Field"
        title="Technicians"
        lede="Who works where, what they are certified for, what they are carrying, and what they are owed."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
        <div>
          {roster.length === 0 ? (
            <EmptyState
              title="No technicians yet"
              body="Add a field technician from the people screen. They appear here once the account exists, with their coverage counties and certifications."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {roster.map((tech) => {
                const certified = tech.certifications.filter((c) => c.status === "certified");
                return (
                  <li
                    key={tech.id}
                    className="rounded-[4px] border border-limestone-line bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-[17px] leading-[1.25] font-bold text-slate">
                          {tech.display_name}
                        </p>
                        <p className="mt-0.5 text-[13px] text-slate-muted">
                          {tech.email}
                          {tech.phone ? `, ${tech.phone}` : ""}
                        </p>
                      </div>
                      <Chip
                        label={tech.status}
                        tone={tech.status === "active" ? "good" : tech.status === "invited" ? "warn" : "bad"}
                      />
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                          Coverage
                        </dt>
                        <dd className="mt-1 text-[13.5px] leading-[1.5] text-slate-muted">
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
                        <dt className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                          Certified for
                        </dt>
                        <dd className="mt-1 text-[13.5px] leading-[1.5] text-slate-muted">
                          {certified.length === 0
                            ? "Nothing yet. Certification is the gate dispatch cannot pass."
                            : certified.map((c) => serviceName(c.service_slug)).join(", ")}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                          Workload
                        </dt>
                        <dd className="mt-1 text-[13.5px] text-slate-muted">
                          {tech.openJobs} open, {tech.completedJobs} finished
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                          Owed
                        </dt>
                        <dd className="mt-1 text-[13.5px] text-slate-muted">
                          {money(tech.pendingCents)} outstanding, {money(tech.paidCents)} paid to date
                        </dd>
                      </div>
                    </dl>

                    {tech.expiringCredentials.length > 0 ? (
                      <p className="mt-3 rounded-[3px] border border-[#f0d9a8] bg-[#fdf3e0] px-3 py-2 text-[13px] leading-[1.5] text-[#7a4c05]">
                        Expiring within 45 days:{" "}
                        {tech.expiringCredentials
                          .map((c) => `${c.kind.replace(/_/g, " ")} on ${c.expires_on}`)
                          .join(", ")}
                        . An insurance certificate that lapses is a dispatching problem, not a
                        filing one.
                      </p>
                    ) : null}

                    <div className="mt-4 border-t border-limestone-line pt-4">
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
            {ledger.length === 0 ? (
              <p className="text-[13.5px] leading-[1.55] text-slate-muted">
                Nothing yet. The first entry appears when a technician submits an evidence package.
              </p>
            ) : (
              <>
                <dl className="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                      Awaiting approval
                    </dt>
                    <dd className="mt-1 font-display text-[19px] font-bold text-slate">
                      {money(pending.reduce((s, l) => s + l.amount_cents, 0))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                      Approved, unpaid
                    </dt>
                    <dd className="mt-1 font-display text-[19px] font-bold text-slate">
                      {money(approved.reduce((s, l) => s + l.amount_cents, 0))}
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
            <p className="text-[13.5px] leading-[1.55] text-slate-muted">
              A technician is offered work only in service lines they are certified for, and that
              gate is not a preference dispatch weighs. The certification workflow itself, the
              training run and the score, is Phase 3. Until it ships, certifications are set
              directly against the record.
            </p>
            <Link
              href="/portal/people"
              className="mt-3 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-slate underline underline-offset-4"
            >
              Manage accounts on the people screen
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
