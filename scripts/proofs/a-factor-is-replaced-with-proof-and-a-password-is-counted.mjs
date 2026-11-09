/**
 * A FACTOR IS REPLACED ONLY WITH PROOF, A SUSPENDED PARTNER STAYS SUSPENDED,
 * AND A RE-ENTERED PASSWORD IS COUNTED. Robert, 2026-11-02, audit fix Q10, auth
 * M1, M3 and M4: "replacing a second factor from a full session requires a
 * current code or the password; setPartnerPassword refuses a suspended user;
 * verifyOwnPassword goes through takeLoginAttempt."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-factor-is-replaced-with-proof-and-a-password-is-counted.mjs
 *
 * Read from the source, in order, because each property is an ordering: the
 * proof before the active secret changes, the status before the link is spent,
 * the count before Supabase is asked. The password bucket is then exercised in
 * the replayed counting function, so the limit is the real one.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const between = (src, start, end) => {
  const a = src.indexOf(start);
  const b = a < 0 ? -1 : src.indexOf(end, a + start.length);
  return a < 0 || b < 0 ? "" : src.slice(a, b);
};

/* ------------------------------------------------------------------ M1 */
const route = readFileSync("src/app/api/portal/mfa/route.ts", "utf8");
const helper = between(route, "async function factorReplacementProven(", "async function profileFor(");
check("the helper is found", helper.length > 0);
check("six digits are a code from the factor in place, spent through verifyFreshCode", /if \(\/\^\\d\{6\}\$\/\.test\(cleaned\)\) \{\s*const code = await verifyFreshCode\(userId, cleaned,/.test(helper));
check("anything else is the password, through verifyOwnPassword", /return verifyOwnPassword\(userId, proof\);/.test(helper));
check("an empty proof is refused with a sentence naming both ways", /if \(!cleaned\) \{\s*return \{\s*ok: false,/.test(helper) && /or your password/.test(helper));

const confirmBlock = between(route, 'if (action === "confirm") {', 'if (action === "codes_saved") {');
const limitAt = confirmBlock.indexOf("const limit = await takeLoginAttempt(");
const stateAt = confirmBlock.indexOf("replacing = (await mfaStateFor(profile.id)).enrolled;");
const provenAt = confirmBlock.indexOf("const proven = replacing ? await factorReplacementProven(profile.id, String(body?.proof ?? \"\")) : ({ ok: true } as const);");
const refuseAt = confirmBlock.indexOf("if (!proven.ok) {");
const changeAt = confirmBlock.indexOf("const done = await confirmEnrolment(");
check("confirm asks whether this account already has a factor", stateAt > 0);
check("and a replacement must be proven", provenAt > stateAt);
check("refused before confirmEnrolment changes the active secret", refuseAt > provenAt && changeAt > refuseAt);
check("after the attempt is counted", limitAt >= 0 && limitAt < provenAt);
check("a state that cannot be read refuses rather than letting the replacement through", /\} catch \{\s*return NextResponse\.json\(\s*\{ ok: false, error: "The second factor on this account could not be checked just now/.test(confirmBlock.slice(stateAt)));
check("a refusal is audited as mfa.replace_refused", /action: "mfa\.replace_refused"/.test(confirmBlock.slice(refuseAt, changeAt)));
check("a first enrolment needs nothing extra: no proof unless replacing", /replacing \? await factorReplacementProven/.test(confirmBlock));
check("the pending-session guard that refuses any replacement from a password alone is still there", /if \(pending && \(action === "begin" \|\| action === "confirm"\)\)/.test(route));

const page = readFileSync("src/app/portal/(public)/mfa/enrol/page.tsx", "utf8");
check("the enrolment screen asks for the proof when a full session already has a factor", /replacing = \(await mfaStateFor\(full\.sub\)\)\.enrolled;/.test(page) && /replacing=\{replacing\}/.test(page));
check("and asks when the state cannot be read", /\} catch \{\s*replacing = true;/.test(page));
const form = readFileSync("src/app/portal/(public)/mfa/enrol/EnrolForm.tsx", "utf8");
check("the form posts the proof with the confirm when replacing", /post\(replacing \? \{ action: "confirm", code, proof \} : \{ action: "confirm", code \}\)/.test(form));

/* ------------------------------------------------------------------ M3 */
const partner = readFileSync("src/lib/partner-auth.ts", "utf8");
const setBody = between(partner, "export async function setPartnerPassword(", "// ------------------------------------------------------------------ sign in");
const readAt = setBody.indexOf('.select("status")');
const refuseSuspendedAt = setBody.indexOf('if (!holder || holder.status === "suspended") return { ok: false, error: "That link is not valid." };');
const spendAt = setBody.indexOf('.from("eng_partner_tokens")');
check("setPartnerPassword reads the holder's status", readAt > 0);
check("and refuses a suspended holder with the invalid-link sentence before the link is spent", refuseSuspendedAt > readAt && spendAt > refuseSuspendedAt);
/* Since auth M2 (2026-11-02) the same write also carries the session epoch condition, named here exactly. */
check("the write excludes a suspended row, holds the epoch it read, and counts what it changed", /\.neq\("status", "suspended"\)\s*\.eq\("session_epoch", epochNow\.epoch\)\s*\.select\("id"\);/.test(setBody) && /if \(!set \|\| set\.length !== 1\) return \{ ok: false, error: "That link is not valid\." \};/.test(setBody));

/* ------------------------------------------------------------------ M4 */
const auth = readFileSync("src/lib/ops-auth.ts", "utf8");
const verifyBody = between(auth, "export async function verifyOwnPassword(", "const PASSWORD_SCOPE");
const changeBody = between(auth, "export async function changeOwnPassword(", "/** The requester's IP and agent");
for (const [name, body] of [["verifyOwnPassword", verifyBody], ["changeOwnPassword", changeBody]]) {
  const count = body.indexOf("const limited = await passwordAttemptRefusal(actorId);");
  const ask = body.indexOf("signInWithPassword(");
  const clear = body.indexOf("await passwordAttemptsClear(actorId);");
  check(`${name} takes an attempt before it asks Supabase`, count > 0 && ask > count);
  check(`${name} refuses when the count says so`, /if \(limited\) return \{ ok: false, error: limited \};/.test(body));
  check(`${name} ends this account's count only on a right password`, clear > ask);
}
const refusal = between(auth, "async function passwordAttemptRefusal(", "async function passwordAttemptsClear(");
check("the attempt is the sign in limiter, keyed on the caller's address and a password bucket for this account", /const address = clientKey\(await headers\(\)\);/.test(refusal) && refusal.includes("const limit = await takeLoginAttempt(address, `${PASSWORD_SCOPE}:${actorId}`);"));

/* The real counting function with the real limits: the ninth wrong password on one account is refused. */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
for (const f of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join("supabase/migrations", f)));
let ninth = null;
for (let i = 0; i < 9; i += 1) {
  ninth = (await db.query("select eng_take_sign_in_attempt($1, $2, 20, 8, 900) as r", ["203.0.113.60", "password:00000000-0000-4000-8000-0000000000aa"])).rows[0].r;
}
check("the ninth password guess on one account from one address is refused", ninth.allowed === false && ninth.scope === "identity", JSON.stringify(ninth));
await db.close();

console.log("");
if (wrong === 0) {
  console.log("PASS: a second factor is replaced only with the one in place or the password, a suspended partner stays suspended, and a re-entered password is counted like a sign in.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
