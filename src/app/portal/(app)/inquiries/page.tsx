import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { designInquiries, overdueBy } from "@/lib/ops-inquiries";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { MarkAnswered } from "./InquiriesClient";

export const dynamic = "force-dynamic";

/**
 * DESIGN BRIEFS, AND THE PROMISES ATTACHED TO THEM.
 *
 * WHY THIS SCREEN EXISTS. The public form writes a row carrying `respond_by`,
 * NOT NULL, defaulting to 24 hours. Without somewhere to read those rows the
 * promise would be recorded and never discharged: briefs arriving into a table
 * nobody opens, and a person who filled in eleven fields hearing nothing. A
 * write path with no read path is a feature that looks finished and does
 * nothing, which is the same shape as 0053 shipping a lock with no key.
 *
 * THE THREE FLAGS ARE THE FIRST THING SHOWN ON A ROW THAT CARRIES ANY. They
 * decide whether the firm takes the work, the specification says the customer
 * is told in the first conversation rather than after paying, and whoever picks
 * up the phone needs to know before they dial rather than halfway down a form.
 */
const ASKING_AS: Record<string, string> = {
  owner: "Owner",
  builder: "Builder",
  architect: "Architect",
  engineer: "Engineer",
};

const WORK_KIND: Record<string, string> = {
  new_construction: "New construction",
  addition: "Addition",
  repair: "Repair",
  remediation: "Remediation",
};

const DELIVERABLE: Record<string, string> = {
  sealed_plans: "Sealed plans",
  sealed_letter: "Sealed letter",
  repair_specification: "Repair specification",
  design_review: "Design review",
};

const when = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function InquiriesPage() {
  const actor = await currentActor();
  if (!can(actor, "files.list")) notFound();

  const rows = await designInquiries(actor);
  const open = rows.filter((r) => r.responded_at === null);

  return (
    <>
      <PageHead
        eyebrow="Design"
        title="Design briefs"
        lede="What somebody asked the firm to design, with the reply they were promised. Unanswered first, and the oldest promise at the top."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No briefs yet"
          body="A row arrives here when somebody sends the design brief from the site. Each one carries a deadline to reply, and the deadline is recorded rather than remembered."
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

              return (
                <li
                  key={r.id}
                  className={`rounded-[4px] border bg-white p-4 ${
                    lateHours !== null ? "border-[var(--warn-border)] border-l-[var(--red)]" : "border-[var(--border)]"
                  }`}
                >
                  {flags.length > 0 ? (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {flags.map((f) => (
                        <Chip key={f} label={f} tone="warn" />
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] leading-[1.35] font-semibold text-[var(--navy)]">
                        {r.name} <span className="font-normal text-[var(--secondary)]">({ASKING_AS[r.asking_as] ?? r.asking_as})</span>
                      </p>
                      <p className="mt-0.5 text-[13.5px] text-[var(--secondary)]">
                        {r.email}
                        {r.phone ? `, ${r.phone}` : ""}
                      </p>
                      <p className="mt-1.5 text-[13.5px] text-[var(--navy)]">
                        {WORK_KIND[r.work_kind] ?? r.work_kind}, {DELIVERABLE[r.deliverable] ?? r.deliverable}
                      </p>
                      <p className="mt-0.5 text-[13.5px] text-[var(--secondary)]">{r.property_address}</p>
                      {r.deadline ? (
                        <p className="mt-1.5 text-[13.5px] text-[var(--secondary)]">
                          Their date: {r.deadline}
                        </p>
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

                  {r.drawings ? (
                    <p className="mt-2.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                      What they have: {r.drawings}
                    </p>
                  ) : null}

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
