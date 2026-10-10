/**
 * A DECIDED REVIEW CREDITS THE ENGINEER THE TIER THE JOB ATTRACTED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-decided-review-credits-its-tier.mjs
 *
 * Operator ruling 1 of 2026-10-10: src/config/engineer-pay.ts is the one home
 * of engineer pay, and the credit on a decision reads the job's tier. Before it,
 * decideReview credited whatever eng_fee_schedule held for the line, and
 * production's schedule is EMPTY, so every decision credited nothing.
 *
 * WHY THIS DOES NOT DECIDE A REAL REVIEW, which is what the ruling's words
 * describe. eng_production_ledger refuses DELETE (0032), and so do the time log
 * and the charge log a decision writes. A proof that decided three reviews would
 * leave three permanent ledger rows on development on every board, which is the
 * 2026-09-09 dashboards-audit incident exactly. So the proof splits at the one
 * seam that can be cleaned up:
 *
 *   1. THE READ, live. productionCreditFor, the function decideReview calls, is
 *      asked about real demonstration files on development, one per tier and one
 *      per way a deliverable is found (the file's own, the order's, the line's
 *      only one), plus the file whose tier cannot be read. Each figure is
 *      compared against the agreement's tier pay written here as literals, never
 *      imported from engineer-pay.ts.
 *   2. THE WRITE, in the source. The ledger insert in decideReview writes
 *      credit.cents and nothing else, from productionCreditFor(pkg.file); the
 *      package read carries the deliverable column; nothing in src reads
 *      engineer_production from the fee schedule; and the order engine records
 *      the deliverable it sold on the file it opens.
 *
 * Probes are demonstration rows (DEMO in the file number and the order
 * reference); all removed and read back.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* The executed agreement's tier pay, in cents. Literals on purpose. */
const AGREED = { 1: 17_500, 2: 35_000, 3: 52_500 };

/* ------------------------------------------------------------ 2. the write */

const engineer = readFileSync("src/lib/ops-engineer.ts", "utf8");
const decide = engineer.slice(engineer.indexOf("export async function decideReview"));
check(
  "decideReview asks productionCreditFor about the package's own file",
  /const credit = await productionCreditFor\(pkg\.file\);/.test(decide),
);
const insertAt = decide.indexOf('.from("eng_production_ledger").insert(');
const insert = insertAt >= 0 ? decide.slice(insertAt, decide.indexOf("});", insertAt)) : "";
check(
  "and its ledger insert writes credit.cents as the amount, and no other figure",
  /amount_cents: credit\.cents,/.test(insert) && (insert.match(/amount_cents:/g) ?? []).length === 1,
  insert ? "" : "no ledger insert found in decideReview",
);
check(
  "the review package reads the file's deliverable column",
  /\.from\("eng_files"\)\s*\.select\(\s*"[^"]*\bdeliverable\b[^"]*"/.test(engineer),
);

function sources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const second = sources("src").filter((p) => /["']engineer_production["']/.test(readFileSync(p, "utf8")));
check(
  "and nothing in src reads engineer pay from the fee schedule, so it has one home",
  second.length === 0,
  second.length ? `still read in ${second.join(", ")}` : "",
);
check(
  "the order engine records the deliverable it sold on the file it opens",
  /createFile\(SYSTEM_AUTHOR, \{[\s\S]{0,400}?deliverable: entry\.tier,/.test(readFileSync("src/lib/ops-intake.ts", "utf8")),
);

/* ------------------------------------------------------------- 1. the read */

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the engineer pay proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so the live read was not proved.");
  process.exit(wrong === 0 ? 0 : 1);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { productionCreditFor } = await import("../../src/lib/ops-engineer.ts");

const STAMP = Date.now();
const TAIL = String(STAMP).slice(-6);
const files = [];
const orders = [];

const CASES = [
  { tag: "T1", slug: "roof-inspections", deliverable: null, order: null, tier: 1, how: "the line's only deliverable" },
  { tag: "T2", slug: "manufactured-home-foundation-certifications", deliverable: "standard", order: null, tier: 2, how: "the file's own deliverable" },
  { tag: "T3", slug: "windstorm-wpi-8", deliverable: "ongoing", order: null, tier: 3, how: "the file's own deliverable" },
  { tag: "TO", slug: "windstorm-wpi-8", deliverable: null, order: "completed", tier: 2, how: "the deliverable of the order it is worked under" },
  { tag: "TX", slug: "windstorm-wpi-8", deliverable: null, order: null, tier: null, how: "nothing records which of two deliverables it is" },
];

try {
  const { data: client } = await db.from("eng_clients").select("id").eq("is_demo", true).limit(1).maybeSingle();
  if (!client) throw new Error("development holds no demonstration client");

  for (const c of CASES) {
    const id = randomUUID();
    const { error } = await db.from("eng_files").insert({
      id, file_number: `254-DEMO-PY${c.tag}${TAIL}`, is_demo: true, client_id: client.id,
      service_slug: c.slug, deliverable: c.deliverable, property_address: "1 Pay Proof Way",
      county: "Nueces", status: "under_review",
    });
    if (error) throw new Error(`file ${c.tag}: ${error.message}`);
    files.push(id);
    if (c.order) {
      const { data: o, error: oErr } = await db.from("eng_service_orders").insert({
        site: "254engineering", reference: `254-O2026-DEMO-PY${c.tag}${TAIL}`, service_slug: c.slug, tier: c.order,
        order_type: "field", status: "in_fulfilment", customer_name: "Pay Proof, not a real person",
        customer_email: `pay.proof.${STAMP}@audit-probe.invalid`, property_address: "1 Pay Proof Way",
        county: "Nueces", twia_county: true, total_cents: 0, file_id: id, is_demo: true,
      }).select("id").single();
      if (oErr) throw new Error(`order ${c.tag}: ${oErr.message}`);
      orders.push(o.id);
    }
    /* The row as the review package reads it: the same columns decideReview hands over. */
    const { data: row } = await db.from("eng_files").select("id, service_slug, deliverable").eq("id", id).single();
    const credit = await productionCreditFor(row);
    if (c.tier === null) {
      check(
        `a ${c.slug} file where ${c.how} credits nothing and says why, rather than a guessed tier`,
        !credit.ok && /deliverable/.test(credit.reason ?? ""),
        credit.ok ? `CREDITED ${credit.cents} at tier ${credit.tier}` : credit.reason,
      );
    } else {
      check(
        `tier ${c.tier}: a ${c.slug} file, read by ${c.how}, credits $${(AGREED[c.tier] / 100).toFixed(2)}`,
        credit.ok && credit.tier === c.tier && credit.cents === AGREED[c.tier],
        credit.ok ? `tier ${credit.tier}, ${credit.cents} cents, deliverable ${credit.deliverable}` : credit.reason,
      );
    }
  }
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  for (const id of orders) await db.from("eng_service_orders").delete().eq("id", id);
  for (const id of files) await db.from("eng_files").delete().eq("id", id);
  const { data: leftF } = files.length ? await db.from("eng_files").select("id").in("id", files) : { data: [] };
  const { data: leftO } = orders.length ? await db.from("eng_service_orders").select("id").in("id", orders) : { data: [] };
  check(
    "the demonstration files and order are removed, read back",
    (leftF ?? []).length === 0 && (leftO ?? []).length === 0,
    `${(leftF ?? []).length} file(s), ${(leftO ?? []).length} order(s) left`,
  );
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a decided review credits the engineer the tier the job attracted, from engineer-pay.ts alone.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
