/**
 * THE PRICE EMAILS STOP WHEN THE PERSON ORDERS.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-price-emails-stop-when-the-person-orders.mjs
 *
 * Robert's /start add-on of 2026-11-15, item 14, and his answer 1 of 13:11
 * Central: "Email me the price" sends one email now, one at two days and a
 * final one on day five, each stopping when the person orders, none to a
 * suppressed address, each with an unsubscribe link and the office address.
 *
 *   A  the rule: an order, the list, a stopped lead and the third email each
 *      stop the sequence, and the order is asked first after a stop.
 *   B  the days are 0, 2 and 5, typed here, and the due times follow them.
 *   C  the sender read from its source: the order and the list are asked
 *      before the step is claimed, the claim moves exactly one step, and the
 *      email is queued only after the claim; the template is marketing, so the
 *      suppression gate and the unsubscribe apply.
 *   D  0137 replayed: the step cannot leave 0 to 3, and a quoted price cannot
 *      be zero or less.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const rules = await import("../../src/lib/ad-conversion-rules.ts");
const finder = await import("../../src/lib/start-finder.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------------- A, rule */

const r = (o) => rules.priceEmailStopReason({ ordered: false, suppressed: false, step: 0, stopped: false, ...o });
check("A: a fresh request may send", r({}) === null);
check("A: an order stops it", r({ ordered: true }) === "ordered");
check("A: the suppression list stops it", r({ suppressed: true }) === "suppressed");
check("A: an order is the reason given when both are true", r({ ordered: true, suppressed: true }) === "ordered");
check("A: after the third email nothing more goes", r({ step: 3 }) === "complete" && r({ step: 2 }) === null);
check("A: a stopped lead stays stopped", r({ stopped: true }) === "complete");

/* ------------------------------------------------------------------- B, days */

check("B: the days are 0, 2 and 5", JSON.stringify(finder.PRICE_EMAIL_DAYS) === JSON.stringify([0, 2, 5]));
const asked = new Date("2026-11-15T16:00:00Z");
check(
  "B: and the due times follow them",
  finder.priceEmailDueAt(asked, 1).toISOString() === "2026-11-15T16:00:00.000Z" &&
    finder.priceEmailDueAt(asked, 2).toISOString() === "2026-11-17T16:00:00.000Z" &&
    finder.priceEmailDueAt(asked, 3).toISOString() === "2026-11-20T16:00:00.000Z",
);

/* ---------------------------------------------------------------- C, sender */

const src = readSource("src/lib/price-emails.ts");
const body = src.slice(src.indexOf("async function sendNext("), src.indexOf("export async function startPriceEmails("));
const at = (needle) => body.indexOf(needle);
const ordered = at("await orderedSince(");
const suppressed = at("await isSuppressed(");
const claim = at('.eq("follow_up_step", lead.follow_up_step)');
const queued = at("await queueEmail(");
check("C: the order is asked, then the list, then the step is claimed, then the email queued", ordered > 0 && suppressed > ordered && claim > suppressed && queued > claim, `${ordered} ${suppressed} ${claim} ${queued}`);
check("C: an order check that could not be answered sends nothing", /if \(ordered === null\) return null;/.test(body));
check("C: a claim that matched no row sends nothing", /if \(claimError \|\| !claimed \|\| claimed\.length !== 1\) return null;/.test(body));
check("C: the price is the lead's own, never re-read from a browser", body.includes("priceLine: money(lead.quoted_cents)"));
check("C: the stop rule has one home", src.includes("export const stopReason = priceEmailStopReason;"));
const sweep = src.slice(src.indexOf("export async function sweepDuePriceEmails("));
check("C: the sweep reads only email_price leads that are not stopped and are due", sweep.includes('.eq("form", "email_price")') && sweep.includes('.is("follow_up_stopped_at", null)') && sweep.includes('.lte("follow_up_next_at"'));
const templates = readSource("src/lib/email-templates.ts");
const list = templates.slice(templates.indexOf("export const MARKETING_TEMPLATES"), templates.indexOf("];", templates.indexOf("export const MARKETING_TEMPLATES")));
check("C: the price email is a marketing template, so it carries an unsubscribe and passes the suppression gate", list.includes('"marketing.price_email"'));

/* ---------------------------------------------------------------- D, table */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const idx = files.findIndex((f) => f.startsWith("0137_"));
for (const f of files.slice(0, idx + 1)) await db.exec(readSource(join(DIR, f)));
const refused = async (sql) => {
  try {
    await db.query(sql);
    return "";
  } catch (e) {
    return String(e?.message ?? e);
  }
};
const ok = await refused(`insert into eng_leads (site, form, email, quoted_service, quoted_cents, follow_up_step) values ('254engineering', 'email_price', 'proof@audit-probe.invalid', 'roof', 60000, 3)`);
check("D: a lead at step 3 with a price is taken", ok === "", ok.slice(0, 120));
const four = await refused(`insert into eng_leads (site, form, email, follow_up_step) values ('254engineering', 'email_price', 'proof@audit-probe.invalid', 4)`);
check("D: step 4 is refused", four.length > 0, four.slice(0, 120));
const zero = await refused(`insert into eng_leads (site, form, email, quoted_cents) values ('254engineering', 'email_price', 'proof@audit-probe.invalid', 0)`);
check("D: a price of zero is refused", zero.length > 0, zero.slice(0, 120));

console.log(wrong === 0 ? "PASS: the price emails stop when the person orders." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
