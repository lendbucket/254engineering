/**
 * CAPTURE THE SIGNED IN CUSTOMER SCREENS, AGAINST A PROBE THAT CANNOT REACH
 * ANYBODY.
 *
 * Operator order, 2026-09-30. Development only, no Stripe, no email, no SMS.
 *
 * THREE INDEPENDENT REASONS NOTHING CAN BE DELIVERED, because one would be an
 * argument and three is a design:
 *
 *   1. The address is under `.invalid`, which RFC 2606 reserves precisely so it
 *      can never resolve. Operator's instruction, and it holds whatever drains.
 *   2. The probe carries NO PHONE, so no SMS has a destination at all.
 *   3. NOTHING IS QUEUED. The rows are inserted directly rather than through
 *      /api/account/sign-up, which is the route that hands an email to the job
 *      queue. A job that is never written cannot be drained by anything.
 *
 * The third is the one that makes this safe rather than merely unlikely, and it
 * is why this file does the chain by hand instead of driving the product's own
 * door. The operator's ruling that Vercel crons run on production deployments
 * only is recorded in credential-inventory.ts; this does not lean on it.
 *
 * THE PASSWORD IS HASHED THE WAY customer-auth.ts HASHES IT, with the same
 * scrypt parameters, because that file carries `server-only` and cannot be
 * imported here. The parameters are duplicated deliberately and would break
 * loudly: a wrong hash means the sign in below refuses and nothing is captured.
 *
 * IT SWEEPS WHAT IT MADE, and reports what it removed and what it could not.
 * eng_audit_events refuses deletes by design, so any row the platform wrote
 * about this probe stays for ever; that is stated rather than hidden.
 */
process.loadEnvFile?.(".env.local");

import { randomBytes, scryptSync } from "node:crypto";
import { chromium } from "playwright";

import { auditClient, describeTarget } from "./lib/db-target.mjs";
import { readEveryRow } from "./lib/read-every-row.mjs";
import { startNextServer } from "./lib/dev-server.mjs";
import { takeLock } from "./lib/machine-lock.mjs";
import { PORTS } from "./lib/ports.mjs";

const OUT = process.env.SHOTS_OUT ?? "docs/design-v10/screens/captured";

/** Exactly customer-auth.ts's parameters. A mismatch fails the sign in below. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };
const PASSWORD = "probe-" + randomBytes(12).toString("base64url");

const stamp = Date.now();
const EMAIL = `probe-${stamp}@example.invalid`;
const NAME = "Probe Capture";

const SCREENS = [
  { route: "/account", design: null, name: "account-home" },
  { route: "/account/settings", design: null, name: "account-settings" },
  { route: "/account/statements", design: null, name: "account-statements" },
  { route: "/account/order", design: null, name: "account-bulk-order" },
  /*
   * The orders list, built 2026-10-01 and not captured until now, which is the
   * same omission in a second place: a screen was added to the design
   * declaration and to the token audit's customer list, and the thing that
   * actually LOOKS at it was left alone.
   *
   * A FRESH PROBE HAS NO ORDERS, so this captures the empty state and says so.
   * Showing a populated list would mean writing a service order on development,
   * and eng_service_orders is append only, so the row could never be swept and
   * a probe's purchase would sit in the firm's records for ever. The empty state
   * is a real state a real customer meets on their first visit, and it is the
   * one this screen most needs to get right.
   */
  { route: "/account/orders", design: null, name: "account-orders" },
];
const WIDTHS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

const db = auditClient("capturing the signed in customer screens");
console.log(describeTarget(process.env.SUPABASE_URL));
console.log(`probe address ${EMAIL} (reserved .invalid, cannot resolve)`);
console.log("probe phone   none");
console.log("");

const made = { clientId: null, accountId: null, userId: null };

function hash(password, salt) {
  return scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  }).toString("base64");
}

async function build() {
  const { data: client, error: ce } = await db
    .from("eng_clients")
    .insert({ kind: "individual", name: NAME, status: "active" })
    .select("id")
    .single();
  if (ce) throw new Error("client insert: " + ce.message);
  made.clientId = client.id;

  const { data: account, error: ae } = await db
    .from("eng_customer_accounts")
    .insert({ site: "254", client_id: client.id, status: "active" })
    .select("id")
    .single();
  if (ae) throw new Error("account insert: " + ae.message);
  made.accountId = account.id;

  const salt = randomBytes(16).toString("base64");
  const { data: user, error: ue } = await db
    .from("eng_customer_users")
    .insert({
      account_id: account.id,
      email: EMAIL,
      display_name: NAME,
      phone: null,
      status: "active",
      account_role: "owner",
      origin: "operator_created",
      email_verified_at: new Date().toISOString(),
      password_hash: hash(PASSWORD, salt),
      password_salt: salt,
    })
    .select("id")
    .single();
  if (ue) throw new Error("user insert: " + ue.message);
  made.userId = user.id;

  console.log(`built client ${made.clientId}`);
  console.log(`      account ${made.accountId}`);
  console.log(`      user    ${made.userId}`);
  console.log("");
}

async function sweep() {
  const removed = [];
  const failed = [];
  /*
   * A THIRD OUTCOME, AND IT IS "unreachable is not failed" APPLIED TO TEARDOWN.
   *
   * Two of the four rows here CANNOT be deleted, by deliberate design.
   * eng_customer_accounts refuses it outright with its own sentence, "an account
   * is superseded, never deleted", and eng_clients then refuses because that
   * account still references it. Reporting those as FAILED said the sweep tried
   * and something went wrong, when the truth is the schema answered exactly as
   * it was built to.
   *
   * It matters because of what it buried. The run of 2026-10-03 printed three
   * FAILED lines, two of them designed-in refusals, and the third was a real
   * defect that had been there since the file was written. A verdict everybody
   * learns to skim is where the next real one hides, which is the same argument
   * COULD NOT TELL exists for at the level of a whole audit.
   */
  const byDesign = [];

  /*
   * Jobs first, so a job naming this probe cannot outlive the rows it names.
   *
   * THE MATCH IS DONE HERE RATHER THAN IN THE DATABASE, and the two attempts
   * before it are why.
   *
   * It read `.ilike("payload", ...)` against a JSONB column. Postgres has no
   * ILIKE for jsonb, so every run since this file was written answered
   *
   *     operator does not exist: jsonb ~~* unknown
   *
   * and the check never once executed. The obvious repair, casting with
   * `.filter("payload::text", "ilike", ...)`, was tried against development and
   * answers with the SAME ERROR: PostgREST does not honour the cast there. That
   * was established by running it, not by reasoning about it, which is the only
   * reason this file does not now carry a second query that never runs.
   *
   * So the queue is read whole and matched in JS. `readEveryRow` refuses to
   * return unless what it assembled equals an exact count taken first, so a
   * silent 1000 row ceiling cannot make this pass over a short list. 784 rows on
   * development today, and the payload shape differs per job kind, which is the
   * other reason a field-path filter was the wrong answer.
   *
   * WHICH CHECK THIS IS, AND IT IS THE PART THAT MATTERS. The header of this
   * file gives three independent reasons nothing can be delivered to the probe,
   * and says of the third, "nothing is queued", that it "is the one that makes
   * this safe rather than merely unlikely". This is the read that confirms it.
   * The load bearing half of the safety argument was asserted by a query that
   * errored every time, printed beside two refusals that are supposed to happen.
   */
  let jobs = null;
  let je = null;
  try {
    const all = await readEveryRow(db, "eng_jobs", "id, kind, status, payload");
    const needle = EMAIL.toLowerCase();
    jobs = all.filter((j) => JSON.stringify(j.payload ?? "").toLowerCase().includes(needle));
  } catch (e) {
    je = { message: e instanceof Error ? e.message : String(e) };
  }
  if (je) {
    failed.push(`could not read the job queue: ${je.message}`);
  } else if ((jobs ?? []).length === 0) {
    removed.push("0 queued jobs, because nothing queued one");
  } else {
    const ids = jobs.map((j) => j.id);
    const { error } = await db.from("eng_jobs").delete().in("id", ids);
    if (error) failed.push(`jobs: ${error.message}`);
    else removed.push(`${ids.length} job(s): ${jobs.map((j) => `${j.kind}/${j.status}`).join(", ")}`);
  }

  for (const [table, id, label] of [
    ["eng_customer_auth_tokens", made.userId, "auth token(s)"],
    ["eng_customer_users", made.userId, "customer user"],
    ["eng_customer_accounts", made.accountId, "customer account"],
    ["eng_clients", made.clientId, "client"],
  ]) {
    if (!id) continue;
    const column = table === "eng_customer_auth_tokens" ? "customer_user_id" : "id";
    const { error, count } = await db
      .from(table)
      .delete({ count: "exact" })
      .eq(column, id);
    if (!error) {
      removed.push(`${count ?? "?"} ${label}`);
      continue;
    }
    /*
     * The two designed-in refusals, matched on what the database actually said
     * rather than on the table name. A rule keyed on the table would go on
     * excusing it after somebody made the row deletable, which is the quiet
     * version of this going wrong.
     */
    const supersededNotDeleted = /superseded, never deleted/i.test(error.message);
    const heldByTheAccount =
      table === "eng_clients" && /eng_customer_accounts_client_id_fkey/.test(error.message);
    if (supersededNotDeleted || heldByTheAccount) {
      byDesign.push(
        `${label}: ${
          supersededNotDeleted
            ? "the schema refuses it, because an account is the record of what somebody was charged"
            : "its account still references it, which follows from the line above"
        }`,
      );
    } else {
      failed.push(`${label}: ${error.message}`);
    }
  }

  /* VERIFIED BY READING BACK, against the table the delete did not read. */
  const { count: left } = await db
    .from("eng_customer_users")
    .select("id", { count: "exact", head: true })
    .eq("email", EMAIL);

  console.log("");
  console.log("=== SWEEP ===");
  for (const r of removed) console.log(`  removed  ${r}`);
  for (const b of byDesign) console.log(`  KEPT     ${b}`);
  for (const f of failed) console.log(`  FAILED   ${f}`);
  console.log(`  read back: ${left ?? "?"} customer user(s) remain for that address`);
  /*
   * AND THE READ BACK IS THE ONE THAT MATTERS, said out loud rather than left to
   * be inferred from a zero. What is kept is a client and a superseded account,
   * neither of which can sign in to anything. What had to go is the credential,
   * and this is the line that proves it did.
   */
  console.log(
    "  The kept rows hold no credential. A client and a superseded account cannot",
  );
  console.log(
    "  sign in; the customer user is the thing that can, and the count above is it.",
  );
  console.log(
    "  NOT removable: any eng_audit_events row about this probe. That table refuses",
  );
  console.log("  deletes by design, which is why this made as few of them as possible.");
  return { removed, byDesign, failed, left };
}

const release = await takeLock({
  project: "254engineering",
  label: "signed in captures",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

let server = null;
try {
  await build();
  server = await startNextServer({ port: PORTS.probeCapture });

  /* Sign in through the product's own route, so the cookie is a real one. */
  const res = await fetch(server.base + "/api/account/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.headers.get("set-cookie");
  if (!res.ok || !setCookie) {
    console.log(`COULD NOT TELL: sign in returned ${res.status} and ${setCookie ? "a cookie" : "no cookie"}.`);
    console.log("Nothing was captured. The probe is swept below regardless.");
  } else {
    const [pair] = setCookie.split(";");
    const [cname, cvalue] = pair.split("=");
    const browser = await chromium.launch();
    for (const w of WIDTHS) {
      const context = await browser.newContext({ viewport: { width: w.width, height: w.height } });
      await context.addCookies([
        { name: cname.trim(), value: cvalue, domain: "localhost", path: "/" },
      ]);
      const page = await context.newPage();
      for (const s of SCREENS) {
        let status = 0;
        try {
          const r = await page.goto(server.base + s.route, { waitUntil: "networkidle", timeout: 45_000 });
          status = r?.status() ?? 0;
        } catch (e) {
          console.log(`  ${s.name} ${w.name}: NAVIGATION FAILED ${String(e).slice(0, 80)}`);
          continue;
        }
        const file = `${OUT}/${s.name}-${w.name}.png`;
        await page.screenshot({ path: file, fullPage: true });
        console.log(
          `  ${s.name.padEnd(20)} ${w.name.padEnd(5)} HTTP ${status}${status === 200 ? "" : "  <-- NOT 200"}  ->  ${file}`,
        );
      }
      await context.close();
    }
    await browser.close();
  }
} catch (e) {
  console.log("BUILD OR CAPTURE FAILED: " + String(e).slice(0, 200));
} finally {
  if (server) await server.stop();
  await sweep();
  release();
  console.log("server stopped, lock released");
}
