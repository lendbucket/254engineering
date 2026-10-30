/**
 * AN ACCOUNT'S CREDIT TERMS CHANGE ONLY FOR AN ADMINISTRATOR, ONLY WITH THE
 * PASSWORD ENTERED AGAIN, AND ONLY AFTER THE RECORD OF THE CHANGE IS WRITTEN.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-accounts-terms-change-asks-the-password-and-is-recorded-first.mjs
 *
 * Robert's ruling, 10:52 Central 2026-10-29 (issue #1 comment 6501552714),
 * 254-WF-022 step 3: "an admin panel on /portal/accounts to set an account's
 * credit terms. It is confirmed by password re-entry, the same as the no-charge
 * override, not an authenticator code. The owner's admin account uses none.
 * Audit row on every change. This is a money flow, so it needs its own proof
 * and an injection."
 *
 * The values are exercised on termsFromChange and centsFromDollars, the rule
 * the panel and the server share. That setAccountTerms asks the grant, then
 * the password through verifyOwnPassword, then reads the current terms, then
 * writes the record through writeAuditOrRefuse and returns on its failure, all
 * BEFORE the update, is asserted from the source by position: the ordering is
 * the guarantee, and a record written after the change is a record that can be
 * missing.
 */
import { readSource } from "../lib/read-source.mjs";

const { termsFromChange, termsDiff, centsFromDollars, TERMS_AUDIT_ACTION, TERMS_PASSWORD_MISSING } = await import(
  "../../src/lib/account-terms.ts"
);
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------ the values */
const current = { billingMode: "invoice", creditLimitCents: 250000, netDays: 30 };
const t = (change) => termsFromChange(current, change);

check("a new limit in whole cents is taken", t({ creditLimitCents: 500000 }).ok && t({ creditLimitCents: 500000 }).next.creditLimitCents === 500000);
check("an explicit null clears the limit to no credit", t({ creditLimitCents: null }).ok && t({ creditLimitCents: null }).next.creditLimitCents === null);
check("a field left out keeps its value", t({ netDays: 45 }).ok && t({ netDays: 45 }).next.creditLimitCents === 250000);
check("a negative limit is refused", !t({ creditLimitCents: -1 }).ok);
check("a limit that is not a number is refused", !t({ creditLimitCents: "5000" }).ok && !t({ creditLimitCents: Number.NaN }).ok);
check("a fraction of a cent is refused, never rounded", !t({ creditLimitCents: 1999.5 }).ok, t({ creditLimitCents: 1999.5 }).ok ? "it was taken" : "");
check("net days outside 0 to 120, or not whole, are refused", !t({ netDays: -1 }).ok && !t({ netDays: 121 }).ok && !t({ netDays: 30.5 }).ok);
check("a billing mode other than card or invoice is refused", !t({ billingMode: "cash" }).ok);

const diff = termsDiff(current, { billingMode: "invoice", creditLimitCents: 500000, netDays: 45 });
check(
  "the record names both sides of every field that moved, and nothing that did not",
  diff.credit_limit_cents?.from === 250000 && diff.credit_limit_cents?.to === 500000 && diff.net_days?.from === 30 && diff.net_days?.to === 45 && !("billing_mode" in diff),
  JSON.stringify(diff),
);

check("dollars typed as 2,500.50 are 250050 cents exactly", centsFromDollars("2,500.50").ok && centsFromDollars("2,500.50").cents === 250050);
check("an empty limit box is no credit", centsFromDollars("  ").ok && centsFromDollars("").cents === null);
check("three decimals or a minus sign are refused, never rounded", !centsFromDollars("12.345").ok && !centsFromDollars("-5").ok);

/* --------------------------------------------------------------- the grant */
const holders = DEFAULT_ROLES.filter((r) => r.grants.includes("accounts.manage")).map((r) => r.key);
check("accounts.manage is the administrator's alone by default", holders.length === 1 && holders[0] === "admin", holders.join(", "));

/* ------------------------------------------------- setAccountTerms, in order */
const admin = readSource("src/lib/ops-accounts-admin.ts");
const start = admin.indexOf("export async function setAccountTerms(");
const body = start >= 0 ? admin.slice(start) : "";
const at = (s) => body.indexOf(s);
check("setAccountTerms exists", start >= 0);

const grant = at('if (!can(actor, "accounts.manage"))');
const missing = at("if (!password) return { ok: false, status: 400, error: TERMS_PASSWORD_MISSING");
const verify = at("const pw = await verifyOwnPassword(actor.id, password);");
const wrongPw = at("if (!pw.ok) return { ok: false, status: 403, error: pw.error");
const read = at('.select("id, billing_mode, credit_limit_cents, net_days")');
const record = at("const recorded = await writeAuditOrRefuse({");
const refuse = at("if (!recorded.ok) return { ok: false");
const update = at('.from("eng_customer_accounts")\n    .update(');

check("a non-administrator is refused before anything else", grant >= 0 && grant < missing, `grant at ${grant}`);
check("a missing password is refused, with the panel's own sentence", missing > grant && TERMS_PASSWORD_MISSING.includes("password"));
check("the password is checked by the signed-in id through verifyOwnPassword", verify > missing && wrongPw > verify);
check("a wrong password is refused before the account is read", wrongPw >= 0 && wrongPw < read);
check("the record is written BEFORE the change", record > read && update > record, `record ${record}, update ${update}`);
check("a record that cannot be written refuses the change", refuse > record && refuse < update);
check("the record is the terms action, naming the account and both sides", body.includes("action: TERMS_AUDIT_ACTION") && body.includes("entityId: accountId") && body.includes("diff: { ...diff, confirmed_by: \"password\" }") && TERMS_AUDIT_ACTION === "account.terms_changed");
check("a change that touched no row is said, and recorded as failed", /\(touched \?\? \[\]\)\.length !== 1/.test(body) && body.includes("action: TERMS_FAILED_ACTION"));
check("no authenticator code is asked", !body.includes("verifyFreshCode"));

/* The route: one way in, and the grant at its door. */
const route = readSource("src/app/api/portal/accounts/route.ts");
/* Comments stripped, so the account of what the branch USED to do is not read as code. */
const branch = route
  .slice(route.indexOf('if (action === "set-terms")'))
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
check("set-terms sends every terms field through setAccountTerms", /const set = await setAccountTerms\(/.test(branch));
check("and writes no terms column itself", !/patch\.(credit_limit_cents|net_days|billing_mode)\s*=/.test(branch) && !/Math\.round/.test(branch));
check("the route still refuses anybody without accounts.manage", /if \(!can\(actor, "accounts\.manage"\)\)/.test(route));

/* ------------------------------------------------------------- the panel */
const client = readSource("src/app/portal/(app)/accounts/AccountsClient.tsx");
const page = readSource("src/app/portal/(app)/accounts/page.tsx");
check("the panel is drawn only when canSetTerms is true", /\{canSetTerms \? <TermsPanel row=\{r\} \/> : null\}/.test(client) && (client.match(/<TermsPanel /g) ?? []).length === 1);
check("canSetTerms defaults to false", /canSetTerms = false,/.test(client));
check("the page passes the administrator's grant", /canSetTerms=\{can\(actor, "accounts\.manage"\)\}/.test(page));
check("the panel asks for the password and sends it", /type="password"/.test(client.slice(client.indexOf("function TermsPanel("))) && /password,\n\s*\}\),/.test(client));

console.log("");
if (wrong === 0) {
  console.log("PASS: an account's terms change for an administrator only, with the password entered again, recorded first, in whole cents.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
