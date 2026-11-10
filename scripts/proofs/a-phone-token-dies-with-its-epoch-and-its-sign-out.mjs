/**
 * PROOF: A PHONE'S KEPT SIGN IN DIES WITH ITS EPOCH AND WITH ITS SIGN OUT.
 *
 * Robert's answer of 2026-11-10, 06:11 Central, relayed on issue #1
 * (6766967932): the store app's sign in token in the phone's keystore, "stored
 * server side so sign out revokes it". Migration 0125; the design is in the
 * morning post, 6767214731.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-phone-token-dies-with-its-epoch-and-its-sign-out.mjs
 *
 *   A  the token: 32 random bytes behind a fixed prefix; only its sha256 is
 *      kept; anything not shaped like one is refused before the database.
 *   B  the ruled figures, pinned as literals: thirty days, field technicians
 *      only (questions 1 and 5 of 6767214731).
 *   C  the exchange's verdict: a live row under the profile's own epoch is a
 *      session; a moved epoch, a suspended or invited account, another role, a
 *      missing profile, a revoked row and an expired row are each refused, and
 *      the first four stamp the row revoked so it is never asked about again.
 *   D  the code around it: the exchange asks exchangeVerdict and nothing else,
 *      stamps what it says, asks the database's clock whether the row is live,
 *      and issues a FULL session under the profile's epoch; issuing needs a
 *      full session and is audited before the row exists; sign out stamps the
 *      row and the keystore forgets it, before the session cookie is cleared,
 *      on both sign out controls; the perimeter opens the exchange and not the
 *      issue.
 *   E  the table, replayed: row level security, thirty days by default and no
 *      longer, one row per hash, a hash of the right shape, a known platform,
 *      and a revocation that says why.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/device-token-rules.ts");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------------ A, the token */

const a = rules.mintDeviceToken();
const b = rules.mintDeviceToken();
check("A: a token is the prefix and 43 base64url characters", /^254d1\.[A-Za-z0-9_-]{43}$/.test(a), a.slice(0, 6));
check("A: two tokens are never the same", a !== b);
check("A: a minted token is well formed", rules.wellFormedDeviceToken(a));
check(
  "A: a session cookie, an empty string, a number and a near miss are not tokens",
  !rules.wellFormedDeviceToken("u.field_tech.full.0.1.mac") &&
    !rules.wellFormedDeviceToken("") &&
    !rules.wellFormedDeviceToken(42) &&
    !rules.wellFormedDeviceToken(`${a}x`),
);
const h = rules.hashDeviceToken(a);
check("A: what is kept is 64 lowercase hex characters, 0125's own shape", /^[0-9a-f]{64}$/.test(h));
check("A: and it is not the token", !h.includes(a.slice(6, 20)));
check("A: the same token always hashes the same, so a lookup finds it", rules.hashDeviceToken(a) === h);

/* ------------------------------------------------------------ B, the ruled figures */

check("B: a token lives thirty days", rules.DEVICE_TOKEN_DAYS === 30, String(rules.DEVICE_TOKEN_DAYS));
check("B: only a field technician may hold one", JSON.stringify(rules.DEVICE_TOKEN_ROLES) === JSON.stringify(["field_tech"]));
check("B: the two phones are android and ios", JSON.stringify(rules.DEVICE_PLATFORMS) === JSON.stringify(["android", "ios"]));
check("B: an engineer and an administrator may not hold one", !rules.mayHoldDeviceToken("engineer") && !rules.mayHoldDeviceToken("admin"));

/* ----------------------------------------------------------- C, the verdict */

const live = { revoked_at: null, live: true, epoch_at_issue: 3 };
const tech = { role: "field_tech", status: "active", session_epoch: 3 };
const v = (row, profile) => rules.exchangeVerdict(row, profile);
const ok = v(live, tech);
check("C: a live token under the profile's own epoch becomes a session under that epoch", ok.ok === true && ok.epoch === 3);
const moved = v(live, { ...tech, session_epoch: 4 });
check("C: once the epoch moves (a password change, a reset, a suspension, a replaced factor) it is refused", moved.ok === false && moved.why === "epoch");
check("C: and the row is stamped, so it is never asked about again", moved.ok === false && typeof moved.revoke === "string" && moved.revoke.length > 0);
const behind = v({ ...live, epoch_at_issue: 4 }, tech);
check("C: an epoch at issue AHEAD of the profile's is refused too: equal, not at least", behind.ok === false && behind.why === "epoch");
check("C: an epoch that is not a whole number is refused", v({ ...live, epoch_at_issue: "3" }, tech).ok === false && v(live, { ...tech, session_epoch: null }).ok === false);
const susp = v(live, { ...tech, status: "suspended" });
check("C: a suspended account is refused and stamped", susp.ok === false && susp.why === "suspended" && Boolean(susp.revoke));
check("C: an invited account, never active, is refused", v(live, { ...tech, status: "invited" }).ok === false);
const role = v(live, { ...tech, role: "engineer" });
check("C: an account that is no longer a field technician is refused and stamped", role.ok === false && role.why === "role" && Boolean(role.revoke));
const gone = v(live, null);
check("C: a token whose account is gone is refused and stamped", gone.ok === false && gone.why === "no_profile" && Boolean(gone.revoke));
const rev = v({ ...live, revoked_at: "2026-11-10T12:00:00Z" }, tech);
check("C: a revoked token is refused, with nothing more to stamp", rev.ok === false && rev.why === "revoked" && rev.revoke === null);
const exp = v({ ...live, live: false }, tech);
check("C: an expired token is refused, with nothing more to stamp", exp.ok === false && exp.why === "expired" && exp.revoke === null);
check("C: no row at all is refused", v(null, tech).ok === false);
check("C: a revoked row stays refused even under the right epoch", v({ ...live, revoked_at: "x" }, tech).ok === false);

/* ------------------------------------------------------------- D, the code */

const lib = readSource("src/lib/device-token.ts");
const fnBody = (src, name) => {
  const at = src.indexOf(`export async function ${name}(`);
  const next = src.indexOf("\nexport ", at + 1);
  return at === -1 ? "" : src.slice(at, next === -1 ? undefined : next);
};
const exchange = fnBody(lib, "exchangeDeviceToken");
const issue = fnBody(lib, "issueDeviceToken");
const revoke = fnBody(lib, "revokeDeviceToken");
check("D: the exchange decides by exchangeVerdict and by nothing else", /const verdict = exchangeVerdict\(/.test(exchange) && !/session_epoch\s*[!=]==/.test(exchange));
check("D: it stamps the row revoked with the verdict's reason, only while the row is still live", /update\(\{ revoked_at: DB_NOW, revoked_reason: verdict\.revoke \}\)/.test(exchange) && /\.is\("revoked_at", null\)/.test(exchange));
check("D: whether the row is live is the database's clock, never this process's", /\.gt\("expires_at", DB_NOW\)/.test(exchange) && !/expires_at[^\n]*Date\.now|new Date\([^)]*expires/.test(exchange));
check("D: it issues a FULL session under the verdict's epoch", /issueOpsSession\(profile!\.id, profile!\.role, "full", Date\.now\(\), verdict\.epoch\)/.test(exchange));
check("D: it reads a token's row by its hash, never by the token", /\.eq\("token_hash", hash\)/.test(exchange) && !/\.eq\("token_hash", presented\)/.test(exchange));
check("D: a refusal tells the caller only to sign in again", /error: "Sign in again\."/.test(exchange));
check("D: issuing refuses every role but field technician", /if \(!mayHoldDeviceToken\(who\.role\)\)/.test(issue));
const auditAt = issue.indexOf("writeAuditOrRefuse(");
const insertAt = issue.indexOf('.from("eng_device_sessions").insert(');
check("D: issuing is audited BEFORE the row is written, and a failed audit issues nothing", auditAt !== -1 && insertAt > auditAt && /if \(!audited\.ok\) return/.test(issue));
check("D: what is stored is the hash and the epoch at issue, never the token", /token_hash: hash,/.test(issue) && /epoch_at_issue: epoch\.epoch,/.test(issue) && !/token_hash: token/.test(issue));
check("D: sign out stamps the row revoked with its reason", /update\(\{ revoked_at: DB_NOW, revoked_reason: SIGNED_OUT \}\)/.test(revoke) && /\.is\("revoked_at", null\)/.test(revoke));
check(
  "D: and answers the same whether or not anything matched: ok for a malformed token and ok after the update, with no branch on the match",
  (revoke.match(/return \{ ok: true \};/g) ?? []).length === 2 && !/if \(!ended\.length\)/.test(revoke) && !/ended\.length === 0/.test(revoke),
);
const issueRoute = readSource("src/app/api/portal/device-token/route.ts");
check("D: the issue route needs a full session: currentActor reads no other", /const actor = await currentActor\(\);\s*if \(!actor\) return/.test(issueRoute));
const exchangeRoute = readSource("src/app/api/portal/device-token/exchange/route.ts");
check("D: the exchange route is counted by the sign in limiter before anything is read", exchangeRoute.indexOf("takeLoginAttempt(") !== -1 && exchangeRoute.indexOf("takeLoginAttempt(") < exchangeRoute.indexOf("exchangeDeviceToken("));
const proxy = readSource("src/proxy.ts");
const open = proxy.slice(proxy.indexOf("const OPEN_PATHS = new Set(["), proxy.indexOf("]);", proxy.indexOf("const OPEN_PATHS = new Set([")));
check("D: the perimeter opens the exchange", open.includes('"/api/portal/device-token/exchange"'));
check("D: and not the issue", !open.includes('"/api/portal/device-token",'));
const shell = readSource("src/lib/native-shell.ts");
const end = shell.slice(shell.indexOf("export async function endKeptSignIn("));
check("D: sign out on the phone tells the server, then the keystore forgets, whatever the server said", end.indexOf('method: "DELETE"') !== -1 && end.indexOf("await forgetKept();") > end.indexOf('method: "DELETE"'));
check("D: the keystore item stays on this phone: past the lock screen only, never synced, never backed up", /internalSetItem\(\{ prefixedKey: KEPT_SIGN_IN, data: body\.token, sync: false, access: 1 \}\)/.test(shell));
const resume = shell.slice(shell.indexOf("export async function resumeKeptSignIn("), shell.indexOf("export async function endKeptSignIn("));
check("D: a token the server refuses for good is forgotten by the phone", /if \(res\.status === 401\) await forgetKept\(\);/.test(resume));
for (const file of ["src/components/portal/PortalChrome.tsx", "src/components/portal/SignOutControl.tsx"]) {
  const src = readSource(file);
  const at = src.indexOf("await endKeptSignIn();");
  const ends = src.indexOf('fetch("/api/portal/session", { method: "DELETE" })');
  check(`D: ${file.split("/").pop()} ends the phone's kept sign in before the session ends`, at !== -1 && ends !== -1 && at < ends, `${at} before ${ends}`);
}

/* -------------------------------------------------------------- E, the table */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));
const rls = (await db.query(`select relrowsecurity from pg_class where oid = 'public.eng_device_sessions'::regclass`)).rows[0]?.relrowsecurity;
check("E: row level security is on", rls === true);
const PROFILE = "00000000-0000-4000-8000-0000000000ab";
await db.exec(`insert into auth.users (id) values ('${PROFILE}');
  insert into eng_profiles (id, email, display_name, role, status) values ('${PROFILE}', 'device-proof@audit-probe.invalid', 'Device proof, not a real person', 'field_tech', 'active');`);
const refused = async (sql) => {
  try {
    await db.query(sql);
    return "";
  } catch (e) {
    return String(e?.message ?? e);
  }
};
const hx = (c) => c.repeat(64);
check("E: a row with a hash, a platform and an epoch is taken", (await refused(`insert into eng_device_sessions (profile_id, platform, token_hash, epoch_at_issue) values ('${PROFILE}', 'android', '${hx("a")}', 0)`)) === "");
const life = (await db.query(`select extract(epoch from (expires_at - created_at)) / 86400 as days from eng_device_sessions where token_hash = '${hx("a")}'`)).rows[0]?.days;
check("E: by default it lives thirty days, the database's arithmetic", Number(life) === 30, String(life));
check("E: thirty one days is refused", (await refused(`insert into eng_device_sessions (profile_id, platform, token_hash, epoch_at_issue, expires_at) values ('${PROFILE}', 'ios', '${hx("b")}', 0, now() + interval '31 days')`)).includes("eng_device_sessions_life_is_thirty_days"));
check("E: the same hash twice is refused", (await refused(`insert into eng_device_sessions (profile_id, platform, token_hash, epoch_at_issue) values ('${PROFILE}', 'ios', '${hx("a")}', 0)`)).includes("eng_device_sessions_hash_once"));
check("E: a raw token in the hash column is refused", (await refused(`insert into eng_device_sessions (profile_id, platform, token_hash, epoch_at_issue) values ('${PROFILE}', 'ios', '${a}', 0)`)).includes("eng_device_sessions_hash_shape"));
check("E: an unknown platform is refused", (await refused(`insert into eng_device_sessions (profile_id, platform, token_hash, epoch_at_issue) values ('${PROFILE}', 'web', '${hx("c")}', 0)`)).includes("eng_device_sessions_platform_known"));
check("E: a revocation with no reason is refused", (await refused(`update eng_device_sessions set revoked_at = now() where token_hash = '${hx("a")}'`)).includes("eng_device_sessions_revocation_says_why"));
check("E: a revocation with its reason is taken", (await refused(`update eng_device_sessions set revoked_at = now(), revoked_reason = '${rules.SIGNED_OUT}' where token_hash = '${hx("a")}'`)) === "");

console.log(wrong === 0 ? "PASS: a phone's kept sign in dies with its epoch and with its sign out." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
