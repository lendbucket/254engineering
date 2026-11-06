/**
 * A SESSION ENDS WHEN ITS EPOCH MOVES. Auth M2, Robert's ruling on issue #1
 * (answer to 6586517364): "option A, rollout 1, built after Q14".
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-session-ends-when-its-epoch-moves.mjs
 *
 * WHAT IT PROVES, one heading per clause of the ruling:
 *
 *   A. each of the three cookies carries the epoch it was issued under, and an
 *      edited epoch breaks the signature;
 *   B. a stale epoch reads as signed out, on every read that builds a principal;
 *   C. a cookie of the old shape is refused (rollout 1), proved with old shape
 *      payloads SIGNED WITH THE RIGHT KEY, each beside a control in the new
 *      shape that is accepted, so only the length check can be what refuses;
 *   D. every bump site bumps, read from the source, and the bump itself is
 *      exercised against a scripted client, races included;
 *   E. the person who changed their own password keeps their session;
 *   F. a suspension still bites;
 *   G. every product issue site passes an epoch explicitly, so the default of 0
 *      kept for older callers cannot quietly become the product's.
 *
 * WHAT IT CANNOT SEE. It opens no database, so it cannot prove PostgreSQL holds
 * the column; that is migration-audit's replay of 0119. It reads the routes'
 * source rather than calling them, so a second password route written tomorrow
 * that does not bump is invisible until it is added to section D; the scan in G
 * is the part that derives its own subject.
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const read = (p) => readFileSync(p, "utf8");
/** Comments stripped, so a rule quoted in prose is never mistaken for code. */
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
const between = (src, start, end) => {
  const a = src.indexOf(start);
  const b = a < 0 ? -1 : src.indexOf(end, a + start.length);
  return a < 0 || b < 0 ? "" : src.slice(a, b);
};

const OPS_SECRET = "an-ops-secret-long-enough-for-this-proof";
const CUS_SECRET = "a-customer-secret-long-enough-for-this";
const PAR_SECRET = "a-partner-secret-long-enough-for-this-x";
process.env.OPS_SESSION_SECRET = OPS_SECRET;
process.env.CUSTOMER_SESSION_SECRET = CUS_SECRET;
process.env.PARTNER_SESSION_SECRET = PAR_SECRET;

const ops = await import("../../src/lib/ops-session.ts");
const cus = await import("../../src/lib/customer-session.ts");
const par = await import("../../src/lib/partner-session.ts");
const rules = await import("../../src/lib/session-epoch-rules.ts");
const { bumpSessionEpoch } = await import("../../src/lib/session-epoch.ts");

const SUB = "11111111-1111-4111-8111-111111111111";
const ACCT = "22222222-2222-4222-8222-222222222222";
const NOW = Date.now();

/* ================================================== A. the epoch is carried */

console.log("A. each cookie carries the epoch it was issued under");
{
  const full = ops.issueOpsSession(SUB, "admin", "full", NOW, 7);
  const fp = full?.value.split(".") ?? [];
  check("a staff cookie is sub.role.factor.epoch.exp.mac, six segments, epoch in the fourth", fp.length === 6 && fp[3] === "7", fp.length);
  check("and reads back with its epoch", ops.readOpsSession(full?.value)?.epoch === 7);

  const pending = ops.issueOpsSession(SUB, "admin", "pending", NOW, 7);
  check("a pending staff cookie carries it too, and only the pending reader takes it", ops.readPendingSession(pending?.value)?.epoch === 7 && ops.readOpsSession(pending?.value) === null);

  const c = cus.issueCustomerSession(SUB, ACCT, NOW, 7);
  const cp = c?.value.split(".") ?? [];
  check("a customer cookie is sub.account.epoch.exp.mac, five segments, epoch in the third", cp.length === 5 && cp[2] === "7", cp.length);
  check("and reads back with its epoch", cus.readCustomerSession(c?.value)?.epoch === 7);

  const p = par.issuePartnerSession(SUB, ACCT, NOW, 7);
  const pp = p?.value.split(".") ?? [];
  check("a partner cookie is sub.partner.p.epoch.exp.mac, six segments, marker then epoch", pp.length === 6 && pp[2] === "p" && pp[3] === "7", pp.length);
  check("and reads back with its epoch", par.readPartnerSession(p?.value)?.epoch === 7);

  for (const bad of [-1, 1.5, Number.NaN, 2e9]) {
    check(
      `an epoch of ${bad} is never minted, by any of the three`,
      ops.issueOpsSession(SUB, "admin", "full", NOW, bad) === null &&
        cus.issueCustomerSession(SUB, ACCT, NOW, bad) === null &&
        par.issuePartnerSession(SUB, ACCT, NOW, bad) === null,
    );
  }

  const bump = (value, at) => value.split(".").map((s, i) => (i === at ? "8" : s)).join(".");
  check(
    "an epoch edited in any of the three cookies breaks its signature",
    ops.readOpsSession(bump(full.value, 3)) === null &&
      cus.readCustomerSession(bump(c.value, 2)) === null &&
      par.readPartnerSession(bump(p.value, 3)) === null,
  );

  const done = ops.issueEnrolmentCompletion(SUB, NOW);
  check("the enrolment completion token is unchanged, three segments", typeof done === "string" && done.split(".").length === 3);
}

/* =========================================== B. a stale epoch is signed out */

console.log("B. a stale epoch reads as signed out");
{
  check("an epoch equal to the row's stands", rules.epochStands(7, 7) === true);
  check("an older epoch does not", rules.epochStands(7, 8) === false);
  check("nor a newer one, which no row has issued", rules.epochStands(8, 7) === false);
  check("nor a row whose epoch could not be read", rules.epochStands(7, undefined) === false && rules.epochStands(7, null) === false && rules.epochStands(7, "7") === false);

  const auth = codeOnly(read("src/lib/ops-auth.ts"));
  const actor = between(auth, "async function readActor(", "\nexport ");
  check(
    "readActor selects session_epoch and refuses a cookie whose epoch is not the profile's, before building the actor",
    /session_epoch"/.test(actor) &&
      actor.indexOf("epochStands(claims.epoch,") > 0 &&
      actor.indexOf("epochStands(claims.epoch,") < actor.indexOf("const profile = rest as ProfileRow"),
  );

  const ca = codeOnly(read("src/lib/customer-auth.ts"));
  const curC = between(ca, "export async function currentCustomer(", "\nexport ");
  check(
    "currentCustomer refuses a cookie whose epoch is not the user's",
    /if \(!epochStands\(claims\.epoch, principal\.sessionEpoch\)\) return null;/.test(curC),
  );
  check("and the principal it compares is read with session_epoch", /\.select\("id, account_id, email, display_name, account_role, status, session_epoch"\)/.test(ca));

  const pa = codeOnly(read("src/lib/partner-auth.ts"));
  const curP = between(pa, "export async function currentPartner(", "\nexport ");
  check(
    "currentPartner refuses a cookie whose epoch is not the user's",
    /if \(!epochStands\(claims\.epoch, principal\.sessionEpoch\)\) return null;/.test(curP),
  );
  check("and the principal it compares is read with session_epoch", /\.select\("id, partner_id, email, display_name, status, session_epoch"\)/.test(pa));

  const mfa = codeOnly(read("src/app/api/portal/mfa/route.ts"));
  check(
    "the second factor route, which reads the cookie itself, compares the epoch in POST and in GET",
    /select\("id, email, display_name, role, session_epoch"\)/.test(mfa) &&
      (mfa.match(/epochStands\(claims\.epoch, (profile|who)\.session_epoch\)/g) ?? []).length === 2,
    `${(mfa.match(/epochStands\(claims\.epoch,/g) ?? []).length} comparisons`,
  );
}

/* ======================================== C. the old shapes are refused */

console.log("C. rollout 1: a cookie of the old shape is refused, never read as epoch 0");
{
  const exp = Math.floor(NOW / 1000) + 3600;
  const signed = (secret, label, payload) => {
    const key = createHmac("sha256", secret).update(label).digest();
    return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
  };
  const OPS_L = "eng-ops-session-v1";
  const CUS_L = "eng-customer-session-v1";
  const PAR_L = "eng-partner-session-v1";

  check("control: a hand signed six segment staff cookie is accepted", ops.readOpsSession(signed(OPS_SECRET, OPS_L, `${SUB}.admin.full.0.${exp}`))?.epoch === 0);
  check(
    "a correctly signed pre M2 staff cookie, sub.role.factor.exp, is refused by both staff readers",
    ops.readOpsSession(signed(OPS_SECRET, OPS_L, `${SUB}.admin.full.${exp}`)) === null &&
      ops.readPendingSession(signed(OPS_SECRET, OPS_L, `${SUB}.admin.pending.${exp}`)) === null,
  );
  check("control: a hand signed five segment customer cookie is accepted", cus.readCustomerSession(signed(CUS_SECRET, CUS_L, `${SUB}.${ACCT}.0.${exp}`))?.epoch === 0);
  check("a correctly signed pre M2 customer cookie, sub.account.exp, is refused", cus.readCustomerSession(signed(CUS_SECRET, CUS_L, `${SUB}.${ACCT}.${exp}`)) === null);
  check("control: a hand signed six segment partner cookie is accepted", par.readPartnerSession(signed(PAR_SECRET, PAR_L, `${SUB}.${ACCT}.p.0.${exp}`))?.epoch === 0);
  check("a correctly signed pre M2 partner cookie, sub.partner.p.exp, is refused", par.readPartnerSession(signed(PAR_SECRET, PAR_L, `${SUB}.${ACCT}.p.${exp}`)) === null);
  check(
    "an epoch that is not digits is refused even when correctly signed",
    ops.readOpsSession(signed(OPS_SECRET, OPS_L, `${SUB}.admin.full.-1.${exp}`)) === null &&
      cus.readCustomerSession(signed(CUS_SECRET, CUS_L, `${SUB}.${ACCT}.x.${exp}`)) === null &&
      par.readPartnerSession(signed(PAR_SECRET, PAR_L, `${SUB}.${ACCT}.p.1e3.${exp}`)) === null,
  );
}

/* ================================================== D. every bump site bumps */

console.log("D. every bump site moves the epoch");
{
  const auth = codeOnly(read("src/lib/ops-auth.ts"));
  const fns = {
    consumeTokenAndSetPassword: between(auth, "export async function consumeTokenAndSetPassword(", "\nexport "),
    changeOwnPassword: between(auth, "export async function changeOwnPassword(", "\nexport "),
    signOutEverywhere: between(auth, "export async function signOutEverywhere(", "\nexport "),
  };
  check(
    "the staff set password link bumps after the password is set, and a failed bump is not reported as success",
    /bumpSessionEpoch\(db, "eng_profiles", inspected\.profile\.id\)/.test(fns.consumeTokenAndSetPassword) &&
      fns.consumeTokenAndSetPassword.indexOf("updateUserById") < fns.consumeTokenAndSetPassword.indexOf("bumpSessionEpoch(") &&
      /if \(!bumped\.ok\) \{\s*return \{\s*ok: false/.test(fns.consumeTokenAndSetPassword),
  );
  check(
    "changeOwnPassword bumps after the password changes and returns the new epoch",
    /bumpSessionEpoch\(db, "eng_profiles", actorId\)/.test(fns.changeOwnPassword) &&
      fns.changeOwnPassword.indexOf("updateUserById") < fns.changeOwnPassword.indexOf("bumpSessionEpoch(") &&
      /return \{ ok: true, epoch: bumped\.epoch \};/.test(fns.changeOwnPassword),
  );
  check("staff sign out everywhere bumps", /bumpSessionEpoch\(db, "eng_profiles", actorId\)/.test(fns.signOutEverywhere));

  const people = codeOnly(read("src/app/api/portal/people/route.ts"));
  const reset = between(people, 'if (action === "force_reset") {', "const issued = await issueSetPasswordToken(");
  check(
    "a forced reset bumps before the link is issued, and refuses when it cannot",
    /bumpSessionEpoch\(db, "eng_profiles", profileId\)/.test(reset) && /if \(!ended\.ok\)/.test(reset),
  );
  const suspend = between(people, 'if (action === "suspend" || action === "restore") {', "await writeAudit(");
  check(
    "a staff suspension moves the epoch in the same update, conditional on the epoch it read, with the row count checked",
    /\.select\("id, display_name, status, session_epoch"\)/.test(suspend) &&
      /session_epoch: \(readEpoch as number\) \+ 1/.test(suspend) &&
      /write = write\.eq\("session_epoch", readEpoch as number\)/.test(suspend) &&
      /\(moved \?\? \[\]\)\.length !== 1/.test(suspend),
  );

  const mfa = codeOnly(read("src/app/api/portal/mfa/route.ts"));
  const confirm = between(mfa, 'if (action === "confirm") {', 'if (action === "codes_saved") {');
  check(
    "a replaced second factor bumps after the new factor is confirmed, and a first enrolment does not",
    /if \(replacing\) \{[\s\S]{0,200}bumpSessionEpoch\(db, "eng_profiles", profile\.id\)/.test(confirm) &&
      confirm.indexOf("confirmEnrolment(") < confirm.indexOf("bumpSessionEpoch("),
  );

  const ca = codeOnly(read("src/lib/customer-auth.ts"));
  const setC = between(ca, "export async function setCustomerPassword(", "\nexport ");
  check(
    "the customer set password link moves the epoch in the same update, conditional on the epoch it read",
    /\.update\(\{ password_hash: hash, password_salt: salt, status: "active", session_epoch: epochNow\.epoch \+ 1 \}\)[\s\S]{0,160}\.eq\("session_epoch", epochNow\.epoch\)/.test(setC),
  );
  check(
    "customer sign out everywhere bumps",
    /bumpSessionEpoch\(db, "eng_customer_users", userId\)/.test(between(ca, "export async function signOutCustomerEverywhere(", "\nexport ")),
  );
  const accountRoute = codeOnly(read("src/app/api/account/session/route.ts"));
  check(
    "and the account screen reaches it, clearing this cookie too",
    /searchParams\.get\("scope"\) === "everywhere"/.test(accountRoute) && /signOutCustomerEverywhere\(me\.id\)/.test(accountRoute),
  );

  const pa = codeOnly(read("src/lib/partner-auth.ts"));
  const setP = between(pa, "export async function setPartnerPassword(", "\nexport ");
  check(
    "the partner set password link moves the epoch in the same update, conditional on the epoch it read",
    /\.update\(\{ password_hash: hash, password_salt: salt, status: "active", session_epoch: epochNow\.epoch \+ 1 \}\)[\s\S]{0,160}\.eq\("session_epoch", epochNow\.epoch\)/.test(setP),
  );

  /* The bump itself, against a scripted client: read, conditional write, row count. */
  const fakeDb = (rows, { races = 0, readError = null } = {}) => {
    let left = races;
    return {
      from(table) {
        const q = { table, filters: [], patch: null };
        const b = {
          select: () => b,
          update: (p) => ((q.patch = p), b),
          eq: (col, val) => (q.filters.push([col, val]), b),
          maybeSingle: async () => {
            if (readError) return { data: null, error: { message: readError } };
            const id = q.filters.find(([c]) => c === "id")?.[1];
            return { data: id in rows ? { session_epoch: rows[id] } : null, error: null };
          },
          then: (resolve) => {
            const id = q.filters.find(([c]) => c === "id")?.[1];
            if (left > 0) {
              left -= 1;
              rows[id] += 1;
            }
            const cond = q.filters.find(([c]) => c === "session_epoch");
            const match = id in rows && (!cond || rows[id] === cond[1]);
            if (match) rows[id] = q.patch.session_epoch;
            resolve({ data: match ? [{ id }] : [], error: null });
          },
        };
        return b;
      },
    };
  };
  {
    const rows = { [SUB]: 4 };
    const r = await bumpSessionEpoch(fakeDb(rows), "eng_profiles", SUB);
    check("a bump moves the epoch by one and returns it", r.ok && r.epoch === 5 && rows[SUB] === 5, JSON.stringify(r));
  }
  {
    const rows = { [SUB]: 4 };
    const r = await bumpSessionEpoch(fakeDb(rows, { races: 2 }), "eng_customer_users", SUB);
    check("a bump that loses two races re-reads and lands, never moving the epoch backwards", r.ok && r.epoch === 7 && rows[SUB] === 7, JSON.stringify(r));
  }
  {
    const rows = { [SUB]: 4 };
    const r = await bumpSessionEpoch(fakeDb(rows, { races: 3 }), "eng_partner_users", SUB);
    check("a bump that cannot land in three tries says so rather than reporting success", r.ok === false, JSON.stringify(r));
  }
  {
    const r = await bumpSessionEpoch(fakeDb({ [SUB]: 4 }, { readError: "down" }), "eng_profiles", SUB);
    check("a bump whose read fails says so", r.ok === false && /could not be read/.test(r.error));
  }
  {
    const r = await bumpSessionEpoch(fakeDb({ [SUB]: 4 }), "eng_clients", SUB);
    check("a table with no sessions is refused", r.ok === false);
  }
}

/* ===================================== E. the changer keeps their session */

console.log("E. the person who changed their own password keeps their own session");
{
  const pw = codeOnly(read("src/app/api/portal/password/route.ts"));
  const after = pw.slice(pw.indexOf("const result = await changeOwnPassword("));
  check(
    "after a successful change, the response carries a fresh full cookie under the epoch the change returned",
    /const fresh = issueOpsSession\(actor!\.id, actor!\.role, "full", Date\.now\(\), result\.epoch\);/.test(after) &&
      /res\.cookies\.set\(OPS_COOKIE, fresh\.value, opsCookieOptions\(fresh\.expiresAt\)\)/.test(after),
  );
  check(
    "sign out everywhere clears this cookie as well",
    /if \(body\?\.action === "sign_out_everywhere"\)[\s\S]{0,900}res\.cookies\.set\(OPS_COOKIE, "", opsCookieOptions\(\)\)/.test(pw),
  );
  const mfa = codeOnly(read("src/app/api/portal/mfa/route.ts"));
  check(
    "a replaced factor reissues the replacer's cookie under the new epoch in the same response",
    /freshCookie = issueOpsSession\(profile\.id, profile\.role, full \? "full" : "pending", Date\.now\(\), ended\.epoch\);/.test(mfa) &&
      /confirmed\.cookies\.set\(OPS_COOKIE, freshCookie\.value/.test(mfa),
  );
  const old = ops.readOpsSession(ops.issueOpsSession(SUB, "admin", "full", NOW, 4)?.value);
  const fresh = ops.readOpsSession(ops.issueOpsSession(SUB, "admin", "full", NOW, 5)?.value);
  check(
    "against a row bumped from 4 to 5, the reissued cookie stands and the one before it does not",
    rules.epochStands(fresh?.epoch, 5) && !rules.epochStands(old?.epoch, 5),
  );
}

/* ================================================ F. suspension still bites */

console.log("F. a suspension still bites");
{
  const authz = codeOnly(read("src/lib/ops-authz.ts"));
  check("can() still refuses an actor whose status is not active", (authz.match(/if \(actor\.status !== "active"\) return false;/g) ?? []).length >= 1);
  const ca = codeOnly(read("src/lib/customer-auth.ts"));
  const pa = codeOnly(read("src/lib/partner-auth.ts"));
  check(
    "currentCustomer still refuses a suspended user and a suspended account",
    /if \(principal\.status !== "active"\) return null;\s*if \(principal\.account\.status !== "active"\) return null;/.test(between(ca, "export async function currentCustomer(", "\nexport ")),
  );
  check(
    "currentPartner still refuses a suspended user and a suspended partner",
    /if \(principal\.status !== "active"\) return null;\s*if \(principal\.partner\.status !== "active"\) return null;/.test(between(pa, "export async function currentPartner(", "\nexport ")),
  );
  const people = codeOnly(read("src/app/api/portal/people/route.ts"));
  check("and a staff suspension still writes the status", /status: nextStatus,/.test(people) && /const nextStatus = action === "suspend" \? "suspended" : "active";/.test(people));
}

/* ============================== G. every product issue site passes an epoch */

console.log("G. every product issue site passes an epoch explicitly");
{
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir, acc = []) => {
    for (const n of readdirSync(dir)) {
      const f = `${dir}/${n}`;
      if (statSync(f).isDirectory()) walk(f, acc);
      else if (/\.tsx?$/.test(n)) acc.push(f);
    }
    return acc;
  };
  const LIBS = new Set(["src/lib/ops-session.ts", "src/lib/customer-session.ts", "src/lib/partner-session.ts"]);
  const WANT = { issueOpsSession: 5, issueCustomerSession: 4, issuePartnerSession: 4 };
  /** The argument count of the call starting at `at`, splitting on top level commas. */
  const argCount = (src, at) => {
    let i = src.indexOf("(", at) + 1;
    let depth = 0;
    let n = 1;
    let any = false;
    for (; i < src.length; i++) {
      const ch = src[i];
      if ("([{".includes(ch)) depth += 1;
      else if (")]}".includes(ch)) {
        if (depth === 0) break;
        depth -= 1;
      } else if (ch === "," && depth === 0) n += 1;
      else if (!/\s/.test(ch)) any = true;
    }
    return any ? n : 0;
  };
  const sites = [];
  for (const f of walk("src")) {
    if (LIBS.has(f)) continue;
    const src = codeOnly(read(f));
    for (const m of src.matchAll(/\b(issueOpsSession|issueCustomerSession|issuePartnerSession)\(/g)) {
      sites.push({ f, fn: m[1], n: argCount(src, m.index), want: WANT[m[1]] });
    }
  }
  check("the scan found the issue sites, so the check below is not over an empty set", sites.length >= 7, `${sites.length} sites`);
  const short = sites.filter((s) => s.n !== s.want);
  check(
    "each one passes every argument up to and including the epoch",
    short.length === 0,
    short.map((s) => `${s.f}: ${s.fn} with ${s.n} of ${s.want}`).join("; ") || sites.map((s) => s.fn.replace("issue", "").replace("Session", "")).join(", "),
  );
}

console.log("");
console.log(wrong === 0 ? "a session ends when its epoch moves: every check holds" : `${wrong} check(s) failed`);
process.exit(wrong === 0 ? 0 : 1);
