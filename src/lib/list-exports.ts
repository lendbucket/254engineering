import { csv } from "./csv";
import { moneyCell } from "./ops-money";
import type { Action } from "./ops-authz";
import type { ApplicationRow } from "./admin-data";
import type { InquiryRow } from "./ops-inquiries";
import type { WindstormInquiryRow } from "./ops-windstorm-inquiries";
import type { RosterRow } from "./ops-field";
import type { PartnerRow } from "./ops-partners-admin";
import type { TaskRow } from "./ops-tasks";
import type { PersonListRow, SuppressionListRow } from "./staff-lists";

/**
 * ===========================================================================
 * THE STAFF LISTS, AS FILES. Office ready (CLAUDE.md section 2d, "paper and
 * spreadsheets"), built on Robert's instruction of 21:07 Central, 2026-10-28:
 * "list every staff list screen without a CSV export. Build the missing ones
 * as one bundle, owner or admin only, with the shared CSV safety and an audit
 * row, the same as the accounts export."
 * ===========================================================================
 *
 * ONE GATE FOR ALL SIX, AND WHY IT IS THIS ONE. The model Robert named, the
 * accounts export, gates on accounts.manage, which roles-audit pins to the
 * administrator alone; the owner holds that role. These six reuse it rather
 * than each inventing an Action, because a new Action is a migration (roles
 * have been data since 0018) and "owner or admin only" is one rule, not six.
 * The export door also asks the screen's own grant, so a file never carries
 * more than its screen shows. If Robert later wants a dedicated export grant,
 * it is this one constant and its migration.
 *
 * Every cell goes through csv(), the platform's one escaping rule with its
 * formula guard, and money through moneyCell: dollars, and an absent figure
 * left empty rather than zero. Pure, so a proof can hand them rows.
 */
export const LIST_EXPORT_GRANT: Action = "accounts.manage";

/**
 * The staff list reports the export door accepts beside its existing ones.
 * People and do not contact joined with their list controls (2026-10-29).
 */
export const LIST_EXPORT_REPORTS = ["applications", "design-briefs", "windstorm-briefs", "technicians", "partners", "tasks", "people", "suppressions"] as const;
export type ListExportReport = (typeof LIST_EXPORT_REPORTS)[number];

const yesNo = (v: boolean | null | undefined) => (v === null || v === undefined ? "" : v ? "yes" : "no");
const unknownNote: [string, unknown] = ["Figures", "An empty figure means it is not known, and is not zero."];

export function applicationsCsv(rows: readonly ApplicationRow[], filter: string): string {
  return csv({
    preamble: [
      ["Applications", `${rows.length} matching`],
      ["Filter", filter],
    ],
    headers: ["Received", "Site", "Position", "Name", "Email", "Phone", "City"],
    rows: rows.map((r) => [r.created_at, r.site, r.role, r.name, r.email, r.phone ?? "", r.city ?? ""]),
  });
}

export function designBriefsCsv(rows: readonly InquiryRow[], filter: string): string {
  return csv({
    preamble: [
      ["Design briefs", `${rows.length} matching`],
      ["Filter", filter],
    ],
    headers: [
      "Received",
      "Name",
      "Email",
      "Phone",
      "Asking as",
      "Work",
      "Deliverable",
      "Property",
      "Jurisdiction",
      "Square feet",
      "Storeys",
      "Deadline",
      "Open insurance claim",
      "Active litigation",
      "Prior adverse report",
      "Reply due",
      "Replied",
    ],
    rows: rows.map((r) => [
      r.created_at,
      r.name,
      r.email,
      r.phone ?? "",
      r.asking_as,
      r.work_kind,
      r.deliverable,
      r.property_address,
      r.jurisdiction ?? "",
      r.square_feet ?? "",
      r.storeys ?? "",
      r.deadline ?? "",
      yesNo(r.open_insurance_claim),
      yesNo(r.active_litigation),
      yesNo(r.prior_adverse_report),
      r.respond_by,
      r.responded_at ?? "",
    ]),
  });
}

export function windstormBriefsCsv(rows: readonly WindstormInquiryRow[], filter: string): string {
  return csv({
    preamble: [
      ["Windstorm briefs", `${rows.length} matching`],
      ["Filter", filter],
    ],
    headers: [
      "Received",
      "Name",
      "Email",
      "Phone",
      "Asking as",
      "Property",
      "County",
      "Year built",
      "Most recent work year",
      "Work done",
      "Deadline",
      "Open insurance claim",
      "Active litigation",
      "Prior adverse report",
      "Reply due",
      "Replied",
    ],
    rows: rows.map((r) => [
      r.created_at,
      r.name,
      r.email,
      r.phone ?? "",
      r.asking_as,
      r.property_address,
      r.county ?? "",
      r.year_built ?? "",
      r.most_recent_work_year ?? "",
      r.work_done,
      r.deadline ?? "",
      yesNo(r.open_insurance_claim),
      yesNo(r.active_litigation),
      yesNo(r.prior_adverse_report),
      r.respond_by,
      r.responded_at ?? "",
    ]),
  });
}

export function techniciansCsv(rows: readonly RosterRow[], filter: string): string {
  return csv({
    preamble: [
      ["Field technicians", `${rows.length} matching`],
      ["Filter", filter],
      ["Money", "In dollars."],
      unknownNote,
    ],
    headers: ["Name", "Email", "Phone", "Status", "Base city", "Base county", "Coverage counties", "Open jobs", "Completed jobs", "Owed", "Paid to date"],
    rows: rows.map((t) => [
      t.display_name,
      t.email,
      t.phone ?? "",
      t.status,
      t.base_city ?? "",
      t.base_county ?? "",
      t.coverage_counties.join("; "),
      t.openJobs ?? "",
      t.completedJobs ?? "",
      moneyCell(t.pendingCents),
      moneyCell(t.paidCents),
    ]),
  });
}

export function partnersCsv(rows: readonly PartnerRow[], filter: string): string {
  return csv({
    preamble: [
      ["Partners", `${rows.length} matching`],
      ["Filter", filter],
      ["Money", "In dollars."],
      unknownNote,
    ],
    headers: ["Partner", "Contact", "Contact email", "Code", "State", "Since", "Agreement", "Referrals", "Payable now", "Blocked", "People"],
    rows: rows.map((p) => [
      p.organisation,
      p.contactName,
      p.contactEmail,
      p.code,
      p.status,
      p.createdAt,
      p.agreementVersion ?? "",
      p.referrals ?? "",
      moneyCell(p.payableCents),
      p.blocked ?? "",
      p.people ?? "",
    ]),
  });
}

export function tasksCsv(rows: readonly TaskRow[], filter: string): string {
  return csv({
    preamble: [
      ["Tasks", `${rows.length} matching`],
      ["Filter", filter],
    ],
    headers: ["Title", "Status", "Priority", "Due", "Created", "Completed", "Repeats", "Description"],
    rows: rows.map((t) => [t.title, t.status, t.priority, t.due_at ?? "", t.created_at, t.completed_at ?? "", t.recurrence ?? "", t.description ?? ""]),
  });
}

/**
 * Who can sign in. Never a password or a token, which this platform does not
 * hold anyway; the licence number is the engineer's public record.
 */
export function peopleCsv(rows: readonly PersonListRow[], filter: string): string {
  return csv({
    preamble: [
      ["People", `${rows.length} matching`],
      ["Filter", filter],
    ],
    headers: ["Name", "Email", "Phone", "Role", "Status", "Base county", "Last sign in", "Added"],
    rows: rows.map((p) => [p.display_name, p.email, p.phone ?? "", p.role, p.status, p.base_county ?? "", p.last_sign_in_at ?? "never", p.created_at]),
  });
}

/**
 * The do not contact list. A row marked as a mistake is still exported and
 * says so, because a file that dropped it would be a consent record with the
 * correction missing.
 */
export function suppressionsCsv(rows: readonly SuppressionListRow[], filter: string): string {
  return csv({
    preamble: [
      ["Do not contact", `${rows.length} matching`],
      ["Filter", filter],
      ["Standing", "A row marked as a mistake no longer stops marketing to that address; it is kept as the record of the correction."],
    ],
    headers: ["Email", "Reason", "Added", "How it came", "Standing", "Marked as a mistake on", "Why", "Recorded instead for"],
    rows: rows.map((r) => [
      r.email,
      r.because,
      r.createdAt,
      r.enteredByOperator ? "recorded by somebody here" : "they clicked the link",
      r.voided ? "marked as a mistake" : "in force",
      r.voided?.at ?? "",
      r.voided?.because ?? "",
      r.voided?.replacedBy ?? "",
    ]),
  });
}

/** A file's name, dated by the caller's own stamp() so this module reads no clock. */
export function listExportFilename(report: ListExportReport, day: string): string {
  return `${report}-${day}.csv`;
}
