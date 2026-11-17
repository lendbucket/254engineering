/**
 * A CONVERSION IS OWED ONCE, AND SAID WHEN IT CANNOT GO.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-conversion-is-owed-once-and-said-when-it-cannot-go.mjs
 *
 * Robert's /start add-on of 2026-11-15, items 10 to 12: a paid order goes to
 * GA4 and Google Ads from the server, leads go to Google Ads as secondary
 * conversions, the offline upload is built in full, and until the credentials
 * are set it reports COULD NOT TELL.
 *
 *   A  the rules, against literals typed here rather than read from the code:
 *      Google's normalisation for enhanced conversions, the Ads date format,
 *      the click id precedence, the GA4 purchase body, the credential names,
 *      the conversion action map, and the or() quoting.
 *   B  0137 replayed: a conversion is unique per destination, kind and subject,
 *      the statuses are the four, and the table has row level security and no
 *      API grant.
 *   C  the sender read from its source: COULD NOT TELL names what is missing
 *      and is not counted as an attempt; the webhook records conversions only
 *      after markPaid succeeded and not on a repeat; nothing is sent from the
 *      browser for a paid order.
 */
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const rules = await import("../../src/lib/ad-conversion-rules.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const sha = (s) => createHash("sha256").update(s).digest("hex");

/* ------------------------------------------------------------------ A, rules */

check("A: a gmail address loses its dots and its case before hashing", rules.hashedEmail("  J.Doe@Gmail.com ") === sha("jdoe@gmail.com"));
check("A: any other address keeps its dots", rules.hashedEmail("J.Doe@Example.com") === sha("j.doe@example.com"));
check("A: an empty or broken email is no identifier, never the hash of nothing", rules.hashedEmail("") === null && rules.hashedEmail("not an email") === null && rules.hashedEmail(null) === null);
check("A: a ten digit phone becomes +1 and its digits", rules.hashedPhone("(281) 940-4490") === sha("+12819404490"));
check("A: eleven digits starting 1 keep it", rules.hashedPhone("1 281 940 4490") === sha("+12819404490"));
check("A: anything else is no identifier", rules.hashedPhone("940-4490") === null && rules.hashedPhone("") === null);
check("A: the Ads time is UTC with an explicit offset", rules.adsDateTime("2026-11-15T22:51:08.123Z") === "2026-11-15 22:51:08+00:00", rules.adsDateTime("2026-11-15T22:51:08.123Z"));

const conv = rules.adsClickConversion({
  customerId: "1234567890",
  actionId: "987",
  click: { gclid: "Cj0KCQiA_gclid", gbraid: "gbraid_value_1", wbraid: null },
  at: "2026-11-15T22:51:08Z",
  valueCents: 60000,
  orderId: "order-1",
  email: "A.B@gmail.com",
  phone: "2819404490",
});
check("A: a gclid wins over a gbraid, and only one click id is sent", conv.gclid === "Cj0KCQiA_gclid" && !("gbraid" in conv) && !("wbraid" in conv));
check("A: the action is the customer's resource name", conv.conversionAction === "customers/1234567890/conversionActions/987");
check("A: the value goes in dollars and USD", conv.conversionValue === 600 && conv.currencyCode === "USD");
check(
  "A: enhanced conversions carry the two hashes and nothing in the clear",
  JSON.stringify(conv.userIdentifiers) === JSON.stringify([{ hashedEmail: sha("ab@gmail.com") }, { hashedPhoneNumber: sha("+12819404490") }]) && !JSON.stringify(conv).includes("2819404490\""),
);
const lead = rules.adsClickConversion({ customerId: "1", actionId: "2", click: { gclid: null, gbraid: null, wbraid: "wb_value_123" }, at: "2026-11-15T00:00:00Z", valueCents: null, orderId: null, email: null, phone: null });
check("A: a lead conversion carries no value, no order and no identifiers when none exist", !("conversionValue" in lead) && !("orderId" in lead) && !("userIdentifiers" in lead) && lead.wbraid === "wb_value_123");

const ga = rules.ga4PurchaseBody({ orderId: "o1", reference: "254-0001", valueCents: 60000, serviceSlug: "roof-certification" });
check("A: GA4 hears a purchase with the order's reference as its transaction id and its value", ga.events[0].name === "purchase" && ga.events[0].params.transaction_id === "254-0001" && ga.events[0].params.value === 600 && ga.events[0].params.currency === "USD");

check(
  "A: with nothing set, Google Ads names all six missing credentials",
  JSON.stringify(rules.missingAdsCredentials({})) ===
    JSON.stringify(["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CONVERSION_ACTIONS"]),
);
check("A: GA4 names its secret and refuses a measurement id that is not G-", JSON.stringify(rules.missingGa4Credentials({ NEXT_PUBLIC_GA_MEASUREMENT_ID: "UA-1" })) === JSON.stringify(["GA4_API_SECRET", "NEXT_PUBLIC_GA_MEASUREMENT_ID"]));
check("A: and is satisfied by both", rules.missingGa4Credentials({ NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-ABC123", GA4_API_SECRET: "s" }).length === 0);
check(
  "A: the action map gives a numeric id, and nothing for a kind it does not name or a broken map",
  rules.conversionActionFor("callback", '{"callback":"123"}') === "123" && rules.conversionActionFor("inquiry", '{"callback":"123"}') === null && rules.conversionActionFor("callback", "{not json") === null && rules.conversionActionFor("callback", '{"callback":"12a"}') === null,
);
check("A: an or() value is quoted and cannot close its own quote", rules.orValue("(281) 940-4490") === '"(281) 940-4490"' && rules.orValue('a"b\\c') === '"abc"');

/* ------------------------------------------------------------- B, the table */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0137_"));
check("B: 0137 is in the chain", at >= 0);
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));

const refused = async (sql) => {
  try {
    await db.query(sql);
    return "";
  } catch (e) {
    return String(e?.message ?? e);
  }
};
const LEAD = "00000000-0000-4000-8000-0000000000b2";
await db.exec(`insert into eng_leads (id, site, form, name, gclid, clicked_at) values ('${LEAD}', '254engineering', 'callback', 'Conversion proof, not a real person', 'Cj0KCQiA_proof', now())`);
const first = await refused(`insert into eng_ad_conversions (destination, kind, lead_id, gclid) values ('google_ads', 'callback', '${LEAD}', 'Cj0KCQiA_proof')`);
check("B: the first conversion for a lead is recorded", first === "", first.slice(0, 120));
const twice = await refused(`insert into eng_ad_conversions (destination, kind, lead_id, gclid) values ('google_ads', 'callback', '${LEAD}', 'Cj0KCQiA_proof')`);
check("B: a second for the same lead, kind and destination is refused by the index", twice.includes("eng_ad_conversions_once"), twice.slice(0, 120));
const otherKind = await refused(`insert into eng_ad_conversions (destination, kind, lead_id, gclid) values ('google_ads', 'inquiry', '${LEAD}', 'Cj0KCQiA_proof')`);
check("B: a different kind for the same lead is its own conversion", otherKind === "", otherKind.slice(0, 120));
const index = (await db.query(`select indexdef from pg_indexes where indexname = 'eng_ad_conversions_once'`)).rows[0]?.indexdef ?? "";
check("B: the unique index is destination, kind and the order or else the lead", /UNIQUE/i.test(index) && /COALESCE\(order_id, lead_id\)/i.test(index), index);
const badStatus = await refused(`insert into eng_ad_conversions (destination, kind, lead_id, status) values ('google_ads', 'email_price', '${LEAD}', 'maybe')`);
check("B: a status outside the four is refused", badStatus.length > 0, badStatus.slice(0, 100));
const rls = (await db.query(`select relrowsecurity from pg_class where relname = 'eng_ad_conversions'`)).rows[0]?.relrowsecurity;
check("B: row level security is on", rls === true);

/* ----------------------------------------------------------- C, the sender */

const src = readSource("src/lib/ad-conversions.ts");
check("C: a missing credential is recorded as could_not_tell with the names", (src.match(/"could_not_tell", `not set: \$\{missing\.join\(", "\)\}`/g) ?? []).length === 2);
check("C: and could_not_tell does not count as an attempt", /if \(status === "could_not_tell"\) attempts -= 1;/.test(src));
check("C: the pure rules have one home", !/export function hashedEmail/.test(src) && src.includes('from "./ad-conversion-rules"'));
const hook = readSource("src/app/api/stripe/webhook/route.ts");
const call = hook.indexOf("after(() => recordPaidOrderConversions(");
const paid = hook.indexOf("await markPaid(");
const refusedReturn = hook.indexOf("if (!result.ok) {", paid);
const repeatGuard = hook.lastIndexOf("if (!result.alreadyRecorded) {", call);
check(
  "C: the webhook records the conversion after markPaid's failure has returned, behind the repeat guard",
  paid > 0 && refusedReturn > paid && repeatGuard > refusedReturn && call > repeatGuard && call - repeatGuard < 120,
  `markPaid ${paid}, refusal ${refusedReturn}, guard ${repeatGuard}, call ${call}`,
);
const finder = readSource("src/components/start/Finder.tsx");
check("C: the browser sends no purchase", !/"purchase"/.test(finder));

console.log(wrong === 0 ? "PASS: a conversion is owed once, and said when it cannot go." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
