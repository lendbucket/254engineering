/**
 * UPLOADS AFTER ORDERING, TURNAROUND TARGETS, AND THE ALERT LIST.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/uploads-targets-and-alerts-follow-the-addendum.mjs
 *
 * Robert's addendum of 2026-10-25, items 4, 6 and 8b, with his targets of
 * 2026-10-27, 09:20 Central. No database, no server, no credential: each rule
 * is a pure function or a source fact, and the expected values are literals
 * here rather than read back from the code they check.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const src = (p) => readFileSync(p, "utf8");

/* ------------------------------------------------------------- item 4 */
console.log("\nItem 4: uploads after ordering");

const inputs = src("src/lib/ops-file-inputs.ts");
check(
  "the outstanding information email's button is the tokened status link, not the bare reference",
  /supplyUrl: await supplyUrlFor\(input\.fileId\)/.test(inputs) && !/\/order\/\$\{input\.orderReference/.test(inputs),
);
check(
  "and that link is minted, as every customer email mints its own",
  /issueCustomerLink\(\{ orderId:/.test(inputs) && /customerStatusUrl\(/.test(inputs),
);

const { outstandingInformation } = await import("../../src/lib/email-templates.ts");
const base = {
  customerName: "Probe",
  customerEmail: "probe@audit-probe.invalid",
  fileNumber: "254-2026-0001",
  propertyAddress: "1 Probe Way",
  items: [{ label: "Plans", when: "Before it can be sealed" }],
  holdingUp: "it can be sealed",
};
const withLink = outstandingInformation({ ...base, supplyUrl: "https://254engineering.com/order/254-ORD-1?token=T" });
const without = outstandingInformation({ ...base, supplyUrl: null });
check("with an order, the email carries the tokened link", withLink.html.includes("?token=T") && withLink.text.includes("?token=T"));
check(
  "with no order, it carries no button and asks for a reply instead",
  !without.html.includes("Send these to the firm") && /Reply to this email/.test(without.text),
);

const { requestedSlots, statusUploadKeyProblem } = await import("../../src/lib/status-upload-rules.ts");
const fields = [
  { id: "plans", label: "Plans", kind: "file", required: true, stage: "seal", audience: "customer", applies: "all", group: "document" },
  { id: "roof_photo", label: "Roof photo", kind: "file", photo: true, required: true, stage: "seal", audience: "customer", applies: "all", group: "document" },
  { id: "survey", label: "Survey", kind: "file", required: true, stage: "seal", audience: "customer", applies: "all", group: "document" },
  { id: "framing", label: "Framing", kind: "file", required: true, stage: "seal", audience: "firm", applies: "all", group: "document" },
  { id: "extra", label: "Extra", kind: "file", required: false, stage: "seal", audience: "customer", applies: "all", group: "document" },
  { id: "gate_code", label: "Gate code", kind: "text", required: true, stage: "dispatch", audience: "customer", applies: "all", group: "access" },
];
const slots = requestedSlots(fields, { survey: "already sent" });
check(
  "the status page offers exactly the required customer documents still missing",
  JSON.stringify(slots.map((s) => s.id)) === JSON.stringify(["plans", "roof_photo"]),
  slots.map((s) => s.id).join(", "),
);
check("and a photograph slot is marked as one", slots.find((s) => s.id === "roof_photo")?.photo === true);

const ORDER = "00000000-0000-4000-8000-000000000001";
check("an upload under this order and this slot is accepted", statusUploadKeyProblem(ORDER, "plans", `status/${ORDER}/plans/1f0e2d3c-aaaa-4bbb-8ccc-123456789abc.pdf`) === null);
check("one under another order is refused", statusUploadKeyProblem(ORDER, "plans", `status/00000000-0000-4000-8000-000000000002/plans/x.pdf`) !== null);
check("one under another slot is refused", statusUploadKeyProblem(ORDER, "plans", `status/${ORDER}/survey/x.pdf`) !== null);
check("one that climbs out of its folder is refused", statusUploadKeyProblem(ORDER, "plans", `status/${ORDER}/plans/../../orders/x.pdf`) !== null);
check("and a draft's key is refused", statusUploadKeyProblem(ORDER, "plans", `orders/${ORDER}/plans/x.pdf`) !== null);

const uploads = src("src/lib/order-uploads.ts");
const pdfLimit = Number(uploads.match(/ORDER_PDF_MAX_BYTES = (\d+) \* 1024 \* 1024/)?.[1]);
const imageLimit = Number(uploads.match(/ORDER_IMAGE_MAX_BYTES = (\d+) \* 1024 \* 1024/)?.[1]);
check("a plan PDF on an order may be 40 MB", pdfLimit === 40, `${pdfLimit} MB`);
check("a photograph stays at 10 MB", imageLimit === 10, `${imageLimit} MB`);
check("and the limit is chosen by content type", /contentType === "application\/pdf"\s*\?\s*\{ bytes: ORDER_PDF_MAX_BYTES/.test(uploads));
check("a slot that asks for a document takes only a PDF", /params\.pdfOnly && params\.contentType !== "application\/pdf"/.test(uploads));
const bucket = src("supabase/migrations/0099_plans_fit_and_alerts_go_to_a_list.sql").match(/set file_size_limit = (\d+)/)?.[1];
check("and the bucket's own limit is the same 40 MB, so it never refuses what the application allows", Number(bucket) === 40 * 1024 * 1024, String(bucket));

const statusPage = src("src/app/(order)/order/[reference]/page.tsx");
check("the status page offers the upload only beside the token that opened it", /view\.requested\.length > 0 && token \?/.test(statusPage));
const route = src("src/app/api/order-documents/route.ts");
check("the upload route answers no token and a wrong token alike", /if \(!token \|\| !fieldId\) return notHere\(\)/.test(route) && /=== STATUS_UPLOAD_NOT_HERE\s*\?\s*notHere\(\)/.test(route));

/* ------------------------------------------------------------- item 6 */
console.log("\nItem 6: turnaround targets");

const { dueFor, isOverdue } = await import("../../src/lib/turnaround-target.ts");
const roof = dueFor("roof-inspections", "standard", "2026-10-30");
check("a roof order placed Friday Oct 30 is due ten business days later, Friday Nov 13", roof?.dueDate === "2026-11-13", roof?.dueDate);
check("through the end of that day in Chicago, which is 05:59:59 UTC after the clocks change", roof?.dueAt === "2026-11-14T05:59:59.999Z", roof?.dueAt);
const wpi = dueFor("windstorm-wpi-8", "completed", "2026-10-26");
check("WPI-8 completed construction ordered Monday Oct 26 is due seven business days later, Wednesday Nov 4", wpi?.dueDate === "2026-11-04", wpi?.dueDate);
const summer = dueFor("solar-structural-letters", "standard", "2026-07-01");
check("a summer date ends at 04:59:59 UTC, in daylight time", summer?.dueDate === "2026-07-08" && summer?.dueAt === "2026-07-09T04:59:59.999Z", `${summer?.dueDate} ${summer?.dueAt}`);
check("design has no target, so no due date", dueFor("residential-light-commercial-design", "custom-package", "2026-10-30") === null);
check("WPI-8 ongoing has no target, so no due date", dueFor("windstorm-wpi-8", "ongoing", "2026-10-30") === null);

const crm = src("src/lib/ops-crm.ts");
check("a file opened at order takes its due date from its line's target unless one was typed", /due_at: input\.dueAt \|\| dueForToday\(input\.serviceSlug, input\.deliverable\)\?\.dueAt \|\| null/.test(crm));

const NOW = Date.parse("2026-11-20T12:00:00Z");
const past = "2026-11-14T05:59:59.999Z";
check("a file under review past its date is overdue", isOverdue({ status: "under_review", due_at: past }, NOW));
check("a file waiting on the owner's repairs is not the firm's delay", !isOverdue({ status: "repairs_required", due_at: past }, NOW));
check("a sealed file owes nothing", !isOverdue({ status: "sealed", due_at: past }, NOW));
check("a file with no target is never overdue", !isOverdue({ status: "under_review", due_at: null }, NOW));

const watch = src("src/lib/overdue-watch.ts");
check("the overdue alert sends at most once a day", /OVERDUE_COOLDOWN_HOURS = 24;/.test(watch));
check("and the health watch runs it", /await watchOverdueFiles\(\)/.test(src("src/app/api/cron/health-watch/route.ts")));

/* ------------------------------------------------------------ item 8b */
console.log("\nItem 8b: the alert list");

const { recipientsOrDefault, isOfficeAlert, OFFICE_ALERT_IDS } = await import("../../src/lib/alert-recipient-rules.ts");
check("an empty list sends to the default address", JSON.stringify(recipientsOrDefault([], "default@example.com")) === JSON.stringify(["default@example.com"]));
check(
  "a list sends to each address once, whatever its case, and drops what is not an address",
  JSON.stringify(recipientsOrDefault(["A@x.com", "a@x.com", "not one", "b@y.org"], "default@example.com")) === JSON.stringify(["a@x.com", "b@y.org"]),
);

const { allTemplatesForAudit } = await import("../../src/lib/email-templates.ts");
const rendered = allTemplatesForAudit();
const unaddressedOps = [...new Set(rendered.filter((t) => t.id.startsWith("ops.") && !t.to).map((t) => t.id))];
const missed = unaddressedOps.filter((id) => !isOfficeAlert(id));
check("every office alert that names no recipient goes to the list", missed.length === 0, missed.join(", ") || `${unaddressedOps.length} alert template(s)`);
const stale = OFFICE_ALERT_IDS.filter((id) => !rendered.some((t) => t.id === id));
check("and the list names no alert that does not exist", stale.length === 0, stale.join(", ") || "all rendered");
check("the overdue alert is one of them", isOfficeAlert("ops.files_overdue"));

const notify = src("src/lib/notify.ts");
const jobs = src("src/lib/ops-jobs.ts");
check("a direct send resolves the list for an office alert", /isOfficeAlert\(email\.id\) \? \(await officeAlertAddresses\(\)\)\.to/.test(notify));
check(
  "a queued alert is queued once per address, each with its own recipient",
  /if \(!email\.to && isOfficeAlert\(email\.id\)\)/.test(jobs) && /queueEmail\(\{ \.\.\.email, to: address \}/.test(jobs),
);
const addresses = src("src/lib/alert-addresses.ts");
check(
  "a list that cannot be read sends to the default address rather than to nobody",
  /return \{ to: \[business\.notificationEmail\], source: "default", unread: why \}/.test(addresses) && /READ_LIMIT_MS/.test(addresses),
);
const manage = src("src/lib/alert-recipients.ts");
check(
  "only the owner edits the list, and every change is recorded first",
  (manage.match(/can\(actor, "alerts\.manage"\)/g) ?? []).length === 2 && (manage.match(/writeAuditOrRefuse\(/g) ?? []).length === 2,
);

console.log(wrong === 0 ? "\nPASS: uploads, targets and the alert list follow the addendum" : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
