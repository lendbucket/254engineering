import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { designInquiries, overdueBy } from "@/lib/ops-inquiries";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { MarkAnswered } from "./InquiriesClient";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { LIST_NOT_LOADED } from "@/lib/outcome-copy";
import { RetryButton } from "@/components/portal/Unreachable";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { INQUIRY_PAGE_SIZE, inquiryListQuery } from "@/lib/inquiry-list";

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
  (formatInFirmZone(value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) ?? "");

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  /*
   * files.create RATHER THAN files.list, AND THE BOARD IS WHY.
   *
   * This shipped gated on files.list, and roles-audit went red: "an engineer
   * does not get /portal/inquiries (HTTP 200)". The engineer HOLDS files.list,
   * so the page opened to him while the ruling recorded beside it said he was
   * refused. One fact with two homes, the guard and the ruling, disagreeing on
   * the first board after they were written.
   *
   * The RULING is the operator's and it stands: a design brief is commercial
   * intake, who is asking and when somebody must ring them back. He scopes the
   * work once it is a job; deciding whether to pursue an enquiry is the firm's
   * business. So the guard moves to match it.
   *
   * files.create is the intake grant, the one behind "New job", and an engineer
   * does not hold it. That is the honest expression of "this is intake" rather
   * than a permission minted to produce a refusal.
   */
  if (!can(actor, "files.create")) notFound();

  const params = await searchParams;
  const query = inquiryListQuery(params);
  const read = await designInquiries(actor, query);
  const rows = read.ok ? read.rows : [];
  /* Nothing at all is "no briefs yet"; nothing under a search or a filter is "nothing matches". */
  const nothingAtAll = read.ok && read.open + read.answered === 0 && query.term === "";

  return (
    <>
      <PageHead
        eyebrow="Design"
        title="Design briefs"
        lede="What somebody asked the firm to design, with the reply they were promised. Unanswered first, and the oldest promise at the top."
      />
      <ListControls
        action="/portal/inquiries"
        search={params.q ?? ""}
        searchLabel="Search name, email, phone or address"
        filters={[
          {
            name: "show",
            label: "Show",
            value: query.show,
            options: [
              { value: "all", label: "Everything" },
              { value: "open", label: "Awaiting a reply" },
              { value: "answered", label: "Answered" },
            ],
          },
        ]}
        sorts={[{ value: "due", label: "Reply by" }, { value: "received", label: "Received" }, { value: "name", label: "Name" }]}
        sort={query.sort}
        direction={query.ascending ? "asc" : "desc"}
      />

      {/* A failed read never renders as "No briefs yet". Operator ruling, 2026-10-12, his wording. */}
      {!read.ok ? (
        <div role="alert" data-list-not-loaded className="py-6">
          <p className="text-[15px] font-semibold text-[var(--ink)]">{LIST_NOT_LOADED}</p>
          <div className="mt-4 flex">
            <RetryButton />
          </div>
        </div>
      ) : nothingAtAll ? (
        <EmptyState
          title="No briefs yet"
          body="A row arrives here when somebody sends the design brief from the site. Each one carries a deadline to reply, and the deadline is recorded rather than remembered."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing matches that search"
          body={`${read.open} awaiting a reply and ${read.answered} answered${query.term ? " match the search" : ""}. Change the search or show everything.`}
        />
      ) : (
        <>
          <p className="mb-4 text-[13.5px] text-[var(--secondary)]">
            {read.open} awaiting a reply, {read.answered} answered{query.term ? ", matching the search" : ""}.
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
                        {r.phone ? <>, <PhoneLink phone={r.phone} /></> : ""}
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
          <Pager page={query.page} pageSize={INQUIRY_PAGE_SIZE} total={read.total} hrefFor={(n) => listHref("/portal/inquiries", params, { page: String(n) })} />
        </>
      )}
    </>
  );
}
