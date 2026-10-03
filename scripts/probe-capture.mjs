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

  /* Jobs first, so a job naming this probe cannot outlive the rows it names. */
  const { data: jobs, error: je } = await db
    .from("eng_jobs")
    .select("id, kind, status")
    .ilike("payload", `%${EMAIL}%`);
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
    if (error) failed.push(`${label}: ${error.message}`);
    else removed.push(`${count ?? "?"} ${label}`);
  }

  /* VERIFIED BY READING BACK, against the table the delete did not read. */
  const { count: left } = await db
    .from("eng_customer_users")
    .select("id", { count: "exact", head: true })
    .eq("email", EMAIL);

  console.log("");
  console.log("=== SWEEP ===");
  for (const r of removed) console.log(`  removed  ${r}`);
  for (const f of failed) console.log(`  FAILED   ${f}`);
  console.log(`  read back: ${left ?? "?"} customer user(s) remain for that address`);
  console.log(
    "  NOT removable: any eng_audit_events row about this probe. That table refuses",
  );
  console.log("  deletes by design, which is why this made as few of them as possible.");
  return { removed, failed, left };
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
