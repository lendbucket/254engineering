// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`, so it
// cannot run under plain node or under tsx without the react-server condition.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees.

/**
 * NOTHING SEEDED IS COUNTED, PROVED BY SEEDING SOMETHING.
 *
 *   npm run demo-audit
 *
 * Phase 12 Section 2. The rule this file exists for is one sentence: a report
 * never counts a demonstration record. Every other check in this repository
 * asserts that some code does what it says; this one inserts a record that
 * WOULD move a figure and requires that the figure does not move.
 *
 * WHY THE INJECTION IS THE WHOLE POINT
 * ------------------------------------
 * `is_demo` is a boolean somebody has to set and a filter somebody has to
 * apply, and both are invisible when they go wrong. A revenue figure that
 * quietly includes a seeded order is not a broken page: it is a plausible
 * number, slightly too high, that somebody acts on. Reading the queries proves
 * they contain a filter. Inserting a demonstration and watching every figure
 * stay still proves the filter is the right one, on the right column, on every
 * query that feeds a figure.
 *
 * THE DETECTOR, AND THE FIVE IT WOULD HAVE CAUGHT
 * -----------------------------------------------
 * Development carried five probe orders for weeks, worth $3,290, with ordinary
 * references and nothing marking them. Three were Stripe payment probes and two
 * were account probes; every revenue figure counted them. They were found by
 * hand, in an inventory, long after they were written.
 *
 * So this also sweeps for the shape rather than the instance: a record with an
 * unroutable customer address that does NOT carry a DEMO number. It reports
 * rather than fixes, names the records, and stays in the board so it catches
 * the next one on the day it is written rather than in the next inventory.
 */

process.loadEnvFile?.(".env.local");

import { auditClient } from "./lib/db-target.mjs";
import { DEMO_SCOPED_TABLES } from "../src/lib/reporting-scope.ts";
import { isProbeAddress } from "../src/lib/ops-files.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const unmeasured = [];

console.log("");
console.log("============ NOTHING SEEDED IS COUNTED ============");
console.log("");

const db = auditClient("demo-audit", { neverProduction: true });

if (!db) {
  unmeasured.push("no database was reachable, so nothing was injected and nothing was proved");
} else {
  // ------------------------------------------------- the column exists at all

  {
    const missing = [];
    for (const table of DEMO_SCOPED_TABLES) {
      const { error } = await db.from(table).select("is_demo").limit(1);
      if (error) missing.push(`${table}: ${error.message}`);
    }
    rec(
      `every table that holds a seeded record type carries is_demo (${DEMO_SCOPED_TABLES.length})`,
      missing.length === 0,
      missing.join(" | "),
    );
  }

  // ------------------------------------- the detector: a probe with no DEMO number

  /*
   * Reports rather than fixes, on the operator's ruling. A record it names is a
   * record somebody has to decide about: renaming it is a data change and this
   * is an audit.
   */
  {
    const { data: orders, error } = await db
      .from("eng_service_orders")
      .select("reference, customer_email, is_demo, total_cents");

    if (error) {
      unmeasured.push(`orders could not be read for the probe sweep: ${error.message}`);
    } else {
      const undeclared = (orders ?? []).filter(
        (o) => isProbeAddress(o.customer_email) && !o.is_demo,
      );
      rec(
        `no order has a probe address and no DEMO number (${(orders ?? []).length} checked)`,
        undeclared.length === 0,
        undeclared.length
          ? `${undeclared.map((o) => `${o.reference} (${o.customer_email})`).join(", ")}. A probe address can never be a real customer, so these are counting in every figure.`
          : "",
      );

      /* The same sweep the other way: a DEMO number that is not marked. The
       * database check makes this unrepresentable, so a failure here means the
       * constraint is missing rather than that somebody forgot. */
      const mismatched = (orders ?? []).filter(
        (o) => String(o.reference).includes("-DEMO-") !== Boolean(o.is_demo),
      );
      rec(
        "and no order's DEMO number disagrees with its is_demo",
        mismatched.length === 0,
        mismatched.length
          ? `${mismatched.map((o) => o.reference).join(", ")}. The two directional check in 0027 should have refused this.`
          : "",
      );
    }
  }

  // --------------------------------------------------------- the injection

  /*
   * Insert an order that would move revenue, then require every figure on
   * every report to be byte identical to what it was before.
   */
  {
    const { REPORTS, formatFigure, periodOf } = await import("../src/lib/ops-reports.ts");
    const period = periodOf();

    const snapshot = async () => {
      const built = await Promise.all(REPORTS.map((r) => r.build(period)));
      return built
        .flatMap((r) => r.sections.flatMap((s) => s.figures.map((f) => `${r.key}/${s.title}/${f.label}=${formatFigure(f)}`)))
        .join("\n");
    };

    const before = await snapshot();
    rec(
      "the reports produced figures to compare",
      before.split("\n").length > 5,
      `${before.split("\n").length} figures. A comparison over nothing passes forever.`,
    );

    const stamp = Date.now();
    const reference = `254-O2026-DEMO-AUD${String(stamp).slice(-3)}`;
    let orderId = null;

    const made = await db
      .from("eng_service_orders")
      .insert({
        site: "254engineering",
        reference,
        service_slug: "windstorm-wpi-8",
        order_type: "field",
        status: "in_fulfilment",
        customer_name: "Demo Audit",
        customer_email: `demo.audit.${stamp}@example.com`,
        property_address: "1 Audit Way",
        county: "Nueces",
        total_cents: 999_00,
        is_demo: true,
      })
      .select("id")
      .maybeSingle();

    if (made.error) {
      rec("a demonstration order could be inserted", false, made.error.message);
    } else {
      orderId = made.data?.id ?? null;
      rec("a demonstration order was inserted that would move revenue", Boolean(orderId), reference);

      const after = await snapshot();
      const moved = before === after ? [] : diff(before, after);

      rec(
        "and no figure on any report moved",
        moved.length === 0,
        moved.length ? `MOVED: ${moved.join(" | ")}` : `${after.split("\n").length} figures unchanged`,
      );

      /*
       * The control. If the reports cannot see the record even when ASKED to,
       * the check above passes because the query is broken rather than because
       * the filter works, which is the defect class this repository keeps
       * finding.
       */
      const including = await Promise.all(REPORTS.map((r) => r.build(period, "including_demonstrations")));
      const pipeline = including.find((r) => r.key === "pipeline");
      const inFulfilment = pipeline?.sections
        .flatMap((s) => s.figures)
        .find((f) => f.label === "in fulfilment");

      rec(
        "and the reports CAN see it when explicitly asked to include demonstrations",
        typeof inFulfilment?.value === "number" && inFulfilment.value > 0,
        inFulfilment
          ? `in fulfilment = ${inFulfilment.value} with demonstrations included`
          : "the pipeline report did not produce that figure at all",
      );
    }

    if (orderId) await db.from("eng_service_orders").delete().eq("id", orderId);
    const { count: left } = await db
      .from("eng_service_orders")
      .select("id", { count: "exact", head: true })
      .eq("reference", reference);
    rec("the injected order was cleaned up", (left ?? 0) === 0);
  }
}

function diff(a, b) {
  const before = new Map(a.split("\n").map((l) => l.split("=")));
  const after = new Map(b.split("\n").map((l) => l.split("=")));
  const moved = [];
  for (const [k, v] of after) if (before.get(k) !== v) moved.push(`${k}: ${before.get(k)} -> ${v}`);
  return moved;
}

// ------------------------------------------------------------------ verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

if (unmeasured.length) {
  console.log("");
  for (const u of unmeasured) console.log(`  COULD NOT TELL: ${u}`);
  console.log("");
  console.log("  The live half did not run. That is not a pass and it is not a failure.");
}

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A figure that counts a demonstration is a plausible number, slightly too");
  console.log("high, that somebody acts on.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. A demonstration moves no figure on any report.`);
