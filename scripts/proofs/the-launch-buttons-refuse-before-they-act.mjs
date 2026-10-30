/**
 * THE TWO BUTTONS OF OPENING REFUSE EVERYBODY BUT THE OPERATOR, AND WRITE THEIR
 * RECORD BEFORE THEY ACT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-launch-buttons-refuse-before-they-act.mjs
 *
 * Robert's ruling, 10:52 Central 2026-10-29 (issue #1 comment 6501552714),
 * 254-WF-024:
 *   step 3, "a proving-charge button on /portal/launch, admin only. It is used
 *           only on Robert's word, and states the charge before it runs."
 *   step 4, "a waitlist 'we are open' email button on /portal/launch. It is
 *           enabled only when the gate reads live, and sends Robert a preview
 *           first. Never sent by a board or a probe."
 *
 * NOTHING HERE CALLS STRIPE OR QUEUES MAIL. The acts are asserted from the
 * source by position, because the ORDER of the refusals is the guarantee: a
 * record written after the charge, or a probe check after the send, is a check
 * that can be passed by doing the thing first. The one pure function, the
 * content hash that binds a send to its preview, is called.
 */
import { readSource } from "../lib/read-source.mjs";

const { announcementContentHash } = await import("../../src/lib/ops-announce.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
/* Comments stripped, so an account of what code used to do is never read as code. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const bodyOf = (src, header) => {
  const start = src.indexOf(header);
  if (start < 0) return "";
  const next = src.indexOf("\nexport ", start + header.length);
  return src.slice(start, next < 0 ? undefined : next);
};
const inOrder = (body, marks) => {
  const at = marks.map((m) => body.indexOf(m));
  return { ok: at.every((p, i) => p >= 0 && (i === 0 || p > at[i - 1])), at };
};

/* ------------------------------------------------------------- the grants */
const holders = (action) => DEFAULT_ROLES.filter((r) => r.grants.includes(action)).map((r) => r.key);
check("payments.charge is the administrator's alone by default", holders("payments.charge").join() === "admin", holders("payments.charge").join(", "));
check("roles.manage is the administrator's alone by default", holders("roles.manage").join() === "admin", holders("roles.manage").join(", "));

/* ----------------------------------------------------- the proving charge */
const proving = code(readSource("src/lib/ops-proving-charge.ts"));
const run = bodyOf(proving, "export async function runProvingCharge(");
check("runProvingCharge exists", run.length > 0);
{
  const o = inOrder(run, [
    "if (!actor) return",
    "!== PROVING_REFERENCE",
    "provingChargeBlockers(actor)",
    "isProbeAddress(",
    'existing.status !== "awaiting_payment"',
    "verifyOwnPassword(actor.id",
    "await writeAuditOrRefuse({",
    "if (!recorded.ok) return",
    "await startProvingCheckout(actor)",
  ]);
  check(
    "the proving charge asks, in order: signed in, the typed reference, the four conditions, no probe, not already paid, the password, the record, and only then the checkout",
    o.ok,
    o.at.join(", "),
  );
}
check("a missing confirmation names the word, so the screen and roles-audit can read it", /\{"confirm":"\$\{PROVING_REFERENCE\}"\}/.test(run));
check("the conditions refuse with 409 and their own sentences", /status: 409, error: blockers\.join\(" "\), blockers/.test(run));
check("a probe account is refused with 403", /if \(isProbeAddress\(.*\)\) \{\s*return \{ ok: false, status: 403/.test(run));
check("its record is proving_charge.started, confirmed by password", run.includes('action: "proving_charge.started"') && run.includes('confirmedBy: "password"'));
check("the charge it states is a constant, never the request's", /export const PROVING_AMOUNT_CENTS = 100;/.test(proving) && !/request\.amount|body\.amount/.test(run));

const provingRoute = code(readSource("src/app/api/portal/proving-charge/route.ts"));
check("the route takes the charge only through runProvingCharge", /await runProvingCharge\(actor,/.test(provingRoute) && !/startProvingCheckout\(/.test(provingRoute));

/* ---------------------------------------------------- the announcement */
const announce = code(readSource("src/lib/ops-announce.ts"));
const who = bodyOf(announce, "async function announcerRefusal(");
{
  const o = inOrder(who, ['can(actor, "roles.manage")', "announcementBlockedReason()", "isProbeAddress(email)", "verifyOwnPassword(actor.id"]);
  check("both announcement steps ask, in order: the administrator, the gate open, no probe, the password", o.ok, o.at.join(", "));
}
const preview = bodyOf(announce, "export async function sendAnnouncementPreview(");
{
  const o = inOrder(preview, ["await announcerRefusal(", "const to = business.notificationEmail;", "await writeAuditOrRefuse({", "if (!recorded.ok) return", "await queueEmail({ ...message, to,"]);
  check("the preview goes only to the firm's own notification address, recorded before it is queued", o.ok, o.at.join(", "));
}
check("the preview's record carries the content hash", preview.includes('action: "announcement.previewed"') && /diff: \{ contentHash, to \}/.test(preview));

const send = bodyOf(announce, "export async function sendAnnouncementToWaitlist(");
{
  const o = inOrder(send, [
    "await announcerRefusal(",
    "if (contentHash !== current)",
    "if (!history.previewed)",
    "if (history.sent)",
    "await waitlistRecipients()",
    "await writeAuditOrRefuse({",
    "if (!recorded.ok) return",
    "await sendLaunchAnnouncement(list.recipients)",
  ]);
  check(
    "the send asks, in order: the same four, content unchanged since the preview, a preview of it sent, not already sent, the list, the record, and only then the send",
    o.ok,
    o.at.join(", "),
  );
}
check("the send's record is announcement.sent with the hash", send.includes('action: "announcement.sent"') && send.includes("contentHash: current"));
check("the list send still refuses before the gate and skips the suppressed", /if \(!isOpen\(\)\)/.test(announce) && /await isSuppressed\(person\.email\)/.test(announce));

const h1 = announcementContentHash();
const h2 = announcementContentHash();
check("the content hash is stable for the same template", /^[0-9a-f]{64}$/.test(h1) && h1 === h2, h1.slice(0, 12));

const announceRoute = code(readSource("src/app/api/portal/launch-announcement/route.ts"));
check("the announcement route is POST only", /export const POST = /.test(announceRoute) && !/export const GET/.test(announceRoute));
check(
  "the route reaches the list only through the two steps",
  /sendAnnouncementPreview\(actor, password\)/.test(announceRoute) &&
    /sendAnnouncementToWaitlist\(actor, password, /.test(announceRoute) &&
    !/sendLaunchAnnouncement\(/.test(announceRoute),
);

/* ---------------------------------------------------------- the screen */
const panel = code(readSource("src/app/portal/(app)/launch/LaunchActions.tsx"));
const provingPanel = bodyOf(panel, "export function ProvingChargePanel(");
check(
  "the proving panel states the charge before its button",
  provingPanel.indexOf("The charge:") >= 0 && provingPanel.indexOf("The charge:") < provingPanel.indexOf('<button type="submit"'),
);
check("its button is drawn only for payments.charge with no condition unmet", /const ready = proving\.canCharge && proving\.blockers\.length === 0;/.test(provingPanel) && /\{ready \? \(/.test(provingPanel));
check("it sends the typed reference and the password", /JSON\.stringify\(\{ confirm, password \}\)/.test(provingPanel));

const announcePanel = bodyOf(panel, "export function AnnouncementPanel(");
check("the announcement buttons are drawn only while the gate is open and it is not yet sent", /const enabled = announcement\.blocked === null && !announcement\.sent;/.test(announcePanel) && /\{enabled \? \(/.test(announcePanel));
check("the waitlist button stays shut until a preview was sent", /disabled=\{busy !== null \|\| !announcement\.previewed\}/.test(announcePanel));

const page = code(readSource("src/app/portal/(app)/launch/page.tsx"));
check("the page passes the server's blockers and the charge grant", /canCharge: can\(actor, "payments\.charge"\)/.test(page) && /blockers: provingChargeBlockers\(actor\)/.test(page));
check("the page passes the gate's own reason and the preview address from config", /blocked: announcementBlockedReason\(\)/.test(page) && /previewTo: business\.notificationEmail/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the proving charge and the launch announcement refuse everybody but the operator, record first, and act last.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
