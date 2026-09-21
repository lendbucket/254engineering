import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { windstormInquiries, overdueBy } from "@/lib/ops-windstorm-inquiries";
import { WINDSTORM_WORK_IN_SCOPE_YEAR, windstormScopeVerdict } from "@/lib/windstorm-inquiry";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { MarkAnswered } from "./WindstormInquiriesClient";

export const dynamic = "force-dynamic";

/**
 * WINDSTORM BRIEFS ON EXISTING BUILDINGS, AND THE PROMISES ATTACHED TO THEM.
 *
 * WHY THIS SCREEN EXISTS. The public form writes a row carrying `respond_by`,
 * NOT NULL, defaulting to 24 hours. Without somewhere to read those rows the
 * promise would be recorded and never discharged: briefs arriving into a table
 * nobody opens, and a person who answered twelve questions hearing nothing. A
 * write path with no read path is a feature that looks finished and does
 * nothing, which is the shape 0053 was already caught in once.
 *
 * WHY IT IS A SECOND SCREEN RATHER THAN A TAB ON THE DESIGN ONE. The rows carry
 * different questions, which is the argument 0054 makes at length. A screen
 * showing both would have to render half its columns blank for whichever kind
 * it was looking at.
 *
 * THE YEAR OF THE WORK IS SHOWN FIRST AND THE YEAR BUILT SECOND, because that
 * is the order they decide anything in. Texas Insurance Code 2210.251 turns on
 * the date of the WORK, so a 1975 house with a 2021 reroof is in scope and the
 * screen must not invite the opposite reading.
 */
const ASKING_AS: Record<string, string> = {
  owner: "Owner",
  buyer: "Buyer",
  agent: "Agent",
  builder: "Builder",
  contractor: "Contractor",
};

const OPENINGS_RATED: Record<string, string> = {
  yes_documented: "Openings rated, documented",
  yes_undocumented: "Openings rated, no paperwork",
  no: "Openings not rated",
  unknown: "Openings unknown",
};

const WILL_OPEN_UP: Record<string, string> = {
  yes: "Will open up to verify",
  no: "Will not open up",
  need_to_discuss: "Opening up needs discussing",
};

const when = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function WindstormInquiriesPage() {
  /*
   * files.create, THE INTAKE GRANT, AND NOT files.list.
   *
   * The same ruling the design briefs carry, and it is followed here rather
   * than rediscovered: an engineer HOLDS files.list, so gating on that would
   * open the screen to him while the ruling says an enquiry nobody has scoped
   * is the firm's business rather than his. That disagreement went red on
   * roles-audit once already, on /portal/inquiries, and the guard moved to
   * match the ruling rather than the ruling moving to match the guard.
   */
  const actor = await currentActor();
  if (!can(actor, "files.create")) notFound();

  const rows = await windstormInquiries(actor);
  const open = rows.filter((r) => r.responded_at === null);

  return (
    <>
      <PageHead
        eyebrow="Windstorm"
        title="Windstorm briefs"
        lede="Existing buildings somebody has asked about, with the reply they were promised. Unanswered first, and the oldest promise at the top."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No briefs yet"
          body="A row arrives here when somebody sends the windstorm brief from the site. Each one carries a deadline to reply, and the deadline is recorded rather than remembered."
        />
      ) : (
        <>
          <p className="mb-4 text-[13.5px] text-[var(--secondary)]">
            {open.length} awaiting a reply, {rows.length - open.length} answered.
          </p>
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const lateHours = overdueBy(r);
              const flags = [
                r.open_insurance_claim ? "Open insurance claim" : null,
                r.active_litigation ? "Active or threatened litigation" : null,
                r.prior_adverse_report ? "Prior adverse report" : null,
              ].filter(Boolean) as string[];

              /*
               * THE SCOPE VERDICT IS THE RULE'S, NOT THIS SCREEN'S.
               *
               * It would be three lines to compare the year here, and those
               * three lines would be a second copy of a rule that has a proof
               * and a statute behind it. The first encoding of that rule was
               * backwards, and a screen carrying its own copy is a screen that
               * would still be backwards after the rule was fixed.
               *
               * Null is UNDATED and is not "out of scope": the person could not
               * date the work, which is the ordinary case and routes to the
               * same conversation.
               */
              const verdict = windstormScopeVerdict(
                r.most_recent_work_year === null
                  ? [{ what: r.work_done }]
                  : [{ what: r.work_done, year: r.most_recent_work_year }],
              );
              const scope =
                verdict.state === "in_scope"
                  ? { label: `Work ${r.most_recent_work_year}, in scope`, tone: "good" as const }
                  : verdict.state === "undated"
                    ? { label: "Work undated", tone: "warn" as const }
                    : {
                        label: `Work ${r.most_recent_work_year}, pre ${WINDSTORM_WORK_IN_SCOPE_YEAR}`,
                        tone: "warn" as const,
                      };

              return (
                <li
                  key={r.id}
                  className={`rounded-[4px] border bg-white p-4 ${
                    lateHours !== null ? "border-[var(--warn-border)] border-l-[var(--red)]" : "border-[var(--border)]"
                  }`}
                >
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    <Chip label={scope.label} tone={scope.tone} />
                    {flags.map((f) => (
                      <Chip key={f} label={f} tone="warn" />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] leading-[1.35] font-semibold text-[var(--navy)]">
                        {r.name}{" "}
                        <span className="font-normal text-[var(--secondary)]">
                          ({ASKING_AS[r.asking_as] ?? r.asking_as})
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13.5px] text-[var(--secondary)]">
                        {r.email}
                        {r.phone ? `, ${r.phone}` : ""}
                      </p>
                      <p className="mt-1.5 text-[13.5px] text-[var(--navy)]">{r.property_address}</p>
                      <p className="mt-0.5 text-[13.5px] text-[var(--secondary)]">
                        {r.county ? `${r.county} County` : "County not given"}
                        {r.year_built ? `, built ${r.year_built}` : ""}
                      </p>
                      <p className="mt-1.5 text-[13.5px] text-[var(--secondary)]">
                        {OPENINGS_RATED[r.openings_rated] ?? r.openings_rated}.{" "}
                        {WILL_OPEN_UP[r.will_open_up] ?? r.will_open_up}.
                      </p>
                      {r.deadline ? (
                        <p className="mt-1.5 text-[13.5px] text-[var(--secondary)]">Their date: {r.deadline}</p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      {r.responded_at !== null ? (
                        <p className="text-[13.5px] font-semibold text-[var(--green)]">
                          Answered {when(r.responded_at)}
                        </p>
                      ) : lateHours !== null ? (
                        <p className="text-[13.5px] font-semibold text-[var(--red)]">
                          {lateHours} hour{lateHours === 1 ? "" : "s"} past the reply we promised
                        </p>
                      ) : (
                        <p className="text-[13.5px] font-semibold text-[var(--navy)]">
                          Reply by {when(r.respond_by)}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-2.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                    Work done: {r.work_done}
                  </p>
                  <p className="mt-1 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                    Covered up: {r.what_is_covered}
                  </p>

                  {r.responded_at === null ? <MarkAnswered inquiryId={r.id} name={r.name} /> : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
