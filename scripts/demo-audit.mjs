// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`, so it
// cannot run under plain node or under tsx without the react-server condition.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees.

/**
 * NOTHING SEEDED IS COUNTED, PROVED ONE REPORT AT A TIME.
 *
 *   npm run demo-audit
 *
 * Phase 12 Section 2. The rule this file exists for is one sentence: a report
 * never counts a demonstration record. Every other check in this repository
 * asserts that some code does what it says; this one puts a record into the
 * database that WOULD move a figure and requires that the figure does not move.
 *
 * WHY THERE IS AN INJECTION PER REPORT AND NOT ONE FOR ALL FOUR
 * -------------------------------------------------------------
 * The first version inserted one demonstration ORDER and required that no
 * figure on any of the four reports moved. It passed, and three quarters of
 * that pass was worth nothing: the production report reads the production
 * ledger and the partner report reads partner statements, and an order cannot
 * move either of them however wrong their filters are. Both reports were
 * getting a green for a filter nobody had tested.
 *
 * That is this repository's recurring defect wearing an injection: a check
 * looking at the right thing in the wrong list. So each report now gets a
 * record of the kind IT reads, and each one carries a control proving the
 * report can see that record when it is asked to include demonstrations. A
 * figure that does not move because the query is broken is not a pass.
 *
 * THE ONE REPORT THAT CANNOT BE INJECTED, AND WHY THAT IS SAID OUT LOUD
 * ---------------------------------------------------------------------
 * Revenue reads eng_order_payments, and that table refuses deletes by design:
 * 0006 answers a delete with "Record a refund instead", because money that
 * moved is not a row somebody gets to remove. An injection there would leave a
 * demonstration payment on development after every board run, forever.
 *
 * So revenue is proved the other way, from the demonstration payments already
 * standing in the database, and the check says so rather than quietly skipping.
 * The universal check below covers it too, and covers it harder: every figure
 * on every report is expanded and no row under any of them may name a
 * demonstration record.
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
import { REPORTS, formatFigure, periodOf } from "../src/lib/ops-reports.ts";
import { FIGURE_SURFACES, allFigures } from "../src/lib/figure-surfaces.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const unmeasured = [];

console.log("");
console.log("============ NOTHING SEEDED IS COUNTED ============");
console.log("");

const db = auditClient("demo-audit", { neverProduction: true });
const PERIOD = periodOf();
const STAMP = Date.now();
const TAIL = String(STAMP).slice(-6);

/**
 * EVERY FIGURE ON EVERY SURFACE, NOT THE FOUR REPORTS.
 *
 * Operator ruling, 2026-09-09. This used to snapshot REPORTS, so an injection
 * proved four surfaces and the six dashboards were never looked at. That is how
 * the sales tile came to count a seeded client: the rule was right and the
 * enforcement was pointed at a quarter of the surfaces that obey it.
 *
 * `allFigures` is the declared inventory of everything that renders a figure,
 * derived from REPORTS and DEFAULT_ROLES rather than listed, so a fifth report
 * or an eighth role joins this sweep without anybody remembering.
 */
async function snapshot() {
  const figures = await allFigures(PERIOD);
  return figures.map((f) => `${f.surface}/${f.section}/${f.label}=${f.rendered}`);
}

function movement(before, after) {
  const was = new Map(before.map((l) => l.split("=")));
  const moved = [];
  for (const line of after) {
    const [k, v] = line.split("=");
    if (was.get(k) !== v) moved.push(`${k}: ${was.get(k)} -> ${v}`);
  }
  return moved;
}

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
      const undeclared = (orders ?? []).filter((o) => isProbeAddress(o.customer_email) && !o.is_demo);
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

  /*
   * THE SAME SWEEP ON EVERY TABLE THAT CARRIES A PROBE ADDRESS.
   *
   * An order was not the only record type a probe run makes. The staff, partner
   * and customer probes each leave a row with an unroutable address, and a run
   * that crashes leaves it behind: destroyProbes sweeps the whole domain for
   * exactly that reason.
   *
   * The production report's per-engineer breakdown made this matter. A
   * leftover probe engineer with is_demo false would appear on it by name with
   * a dollar figure beside them, and nobody would know what they were looking
   * at. portal-probe now marks all three at creation, and this is what notices
   * if that ever stops being true.
   */
  {
    const SWEPT = [
      { table: "eng_profiles", address: "email", name: "display_name" },
      { table: "eng_partners", address: "contact_email", name: "organisation" },
      { table: "eng_clients", address: "email", name: "name" },
    ];

    const found = [];
    let checked = 0;
    for (const t of SWEPT) {
      const { data, error } = await db.from(t.table).select(`${t.address}, ${t.name}, is_demo`);
      if (error) {
        unmeasured.push(`${t.table} could not be read for the probe sweep: ${error.message}`);
        continue;
      }
      checked += (data ?? []).length;
      for (const row of data ?? []) {
        if (isProbeAddress(row[t.address]) && !row.is_demo) {
          found.push(`${t.table}: ${row[t.name]} (${row[t.address]})`);
        }
      }
    }

    rec(
      `no profile, partner or client has a probe address and is not marked (${checked} checked)`,
      found.length === 0,
      found.length
        ? `${found.join(", ")}. An unroutable address can never be a real person, so these count in every figure that reaches them.`
        : "",
    );
  }

  // ------------------------------- the registry covers every surface there is

  /*
   * THE DENOMINATOR CANNOT BE A MEMORY.
   *
   * Operator ruling, 2026-09-09: every surface that renders a figure joins the
   * registry, dashboards included. This asserts the registry is that, rather
   * than a list somebody trimmed to make a check pass. Both counts are derived
   * from the modules that own them, so a fifth report or an eighth role makes
   * this red until it is swept.
   */
  {
    const reports = FIGURE_SURFACES.filter((s) => s.kind === "report");
    const dashboards = FIGURE_SURFACES.filter((s) => s.kind === "dashboard");
    const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");

    rec(
      `every report and every role's dashboard is a swept surface (${FIGURE_SURFACES.length})`,
      reports.length === REPORTS.length && dashboards.length === DEFAULT_ROLES.length,
      `${reports.length} of ${REPORTS.length} reports, ${dashboards.length} of ${DEFAULT_ROLES.length} dashboards`,
    );

    /*
     * And the honest limit, asserted rather than left in a comment: a dashboard
     * tile carries no rows, because its count comes from a head query that
     * deliberately fetches none. So the evidence sweep below can only run over
     * reports, and the movement check is what covers dashboards. Both facts are
     * true and only the first was ruled, so the second is checked here.
     */
    rec(
      "reports guarantee their rows and dashboards say plainly that they do not",
      reports.every((s) => s.expandable) && dashboards.every((s) => !s.expandable),
      "a dashboard tile's count comes from a head query that fetches no rows, so it can be proved not to MOVE but not to be free of a named record",
    );
  }

  // ------------------------- no expansion under any figure names a demonstration

  /*
   * THE CHECK THE NEW FIGURE SHAPE MADE POSSIBLE.
   *
   * Every figure now carries the rows it was computed from, so the question
   * "did this total count a demonstration" can be asked of the EVIDENCE rather
   * than inferred from the total not moving. It covers all four reports at
   * once, including revenue, which cannot be injected.
   *
   * The control below is what stops it passing because the reports returned
   * nothing at all.
   */
  {
    const DEMO_SHAPE = /-DEMO-|\bdemo\b/i;

    const real = await Promise.all(REPORTS.map((r) => r.build(PERIOD, "real")));
    const named = real.flatMap((r) =>
      r.sections.flatMap((s) =>
        s.figures.flatMap((f) =>
          (f.rows ?? [])
            .filter((row) => DEMO_SHAPE.test(row.label) || DEMO_SHAPE.test(row.detail))
            .map((row) => `${r.key}/${f.label}: ${row.label}`),
        ),
      ),
    );

    rec(
      "no row under any figure on any report names a demonstration record",
      named.length === 0,
      named.length ? named.join(", ") : `${real.length} reports expanded, every row a real record`,
    );

    const including = await Promise.all(REPORTS.map((r) => r.build(PERIOD, "including_demonstrations")));
    const visible = including.flatMap((r) =>
      r.sections.flatMap((s) =>
        s.figures.flatMap((f) =>
          (f.rows ?? []).filter((row) => DEMO_SHAPE.test(row.label)).map((row) => row.label),
        ),
      ),
    );

    rec(
      "and the same expansion DOES name them when demonstrations are included",
      visible.length > 0,
      visible.length
        ? `${new Set(visible).size} demonstration record${new Set(visible).size === 1 ? "" : "s"} reachable, so the check above was looking at something`
        : "no demonstration record appears on any report in either scope, so the check above proves nothing",
    );
  }

  // ------------------------------ and no demonstration reaches an export file

  /*
   * Phase 12 Section 3. A screen is looked at; a file is SENT. If a
   * demonstration ever leaks into an export, it leaves the building inside a
   * document somebody hands to an accountant, and no amount of fixing the
   * screen afterwards catches it back.
   *
   * The file is checked as TEXT rather than by re-reading the figures, because
   * what matters here is the bytes that leave. A filter that worked on the
   * report and a serialiser that reached back to the database would pass every
   * check above and still write a demonstration into the CSV.
   */
  {
    const { reportCsv } = await import("../src/lib/ops-report-export.ts");
    const by = { email: "demo-audit@254engineering.com", role: "admin" };

    const leaked = [];
    let realBytes = 0;
    for (const r of REPORTS) {
      const body = reportCsv(await r.build(PERIOD, "real"), by);
      realBytes += body.length;
      for (const line of body.split("\r\n")) {
        if (/-DEMO-/i.test(line)) leaked.push(`${r.key}: ${line.slice(0, 80)}`);
      }
    }

    rec(
      `every report was exported to a file to search (${realBytes} bytes)`,
      realBytes > 0,
      "a search through no bytes finds nothing, every time",
    );
    rec(
      "no demonstration record appears anywhere in an export file",
      leaked.length === 0,
      leaked.length ? leaked.join(" | ") : "checked as text, because what leaves the building is bytes",
    );

    const visible = [];
    for (const r of REPORTS) {
      const body = reportCsv(await r.build(PERIOD, "including_demonstrations"), by);
      for (const line of body.split("\r\n")) if (/-DEMO-/i.test(line)) visible.push(r.key);
    }
    rec(
      "and the same search DOES find them when demonstrations are included",
      visible.length > 0,
      visible.length
        ? `${new Set(visible).size} report(s) write them when asked, so the search above was looking at something`
        : "no export names a demonstration in either scope, so the check above proves nothing",
    );
  }

  // -------------------------------------------- one injection per report

  /**
   * A record of the kind one report reads, and the figure it should not move.
   *
   * `insert` returns a cleanup function, or throws. `control` names a figure on
   * that report which MUST have moved once demonstrations are included, which
   * is what tells a working filter apart from a broken query.
   */
  const INJECTIONS = [
    {
      report: "pipeline",
      what: "a demonstration order in fulfilment",
      async insert() {
        const reference = `254-O2026-DEMO-AUD${TAIL}`;
        const { data, error } = await db
          .from("eng_service_orders")
          .insert({
            site: "254engineering",
            reference,
            service_slug: "windstorm-wpi-8",
            order_type: "field",
            status: "in_fulfilment",
            customer_name: "Demo Audit",
            customer_email: `demo.audit.${STAMP}@example.com`,
            property_address: "1 Audit Way",
            county: "Nueces",
            twia_county: true,
            total_cents: 999_00,
            paid_at: new Date().toISOString(),
            is_demo: true,
          })
          .select("id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        const id = data?.id;
        return { label: reference, cleanup: () => db.from("eng_service_orders").delete().eq("id", id) };
      },
      control: (figures) => figures.find((f) => f.label === "in fulfilment"),
    },
    {
      report: "production",
      what: "a demonstration engineer with a priced ledger entry",
      async insert() {
        const email = `demo.engineer.${STAMP}@demo-audit.invalid`;
        const { data: user, error: uErr } = await db.auth.admin.createUser({
          email,
          password: `demo-${STAMP}-Aa1!longenough`,
          email_confirm: true,
        });
        if (uErr || !user?.user) throw new Error(`auth user: ${uErr?.message}`);
        const id = user.user.id;

        const { error: pErr } = await db.from("eng_profiles").insert({
          id,
          email,
          display_name: `Demo Engineer ${TAIL}`,
          role: "engineer",
          status: "active",
          tdi_appointment: "none",
          is_demo: true,
        });
        if (pErr) {
          await db.auth.admin.deleteUser(id).catch(() => {});
          throw new Error(`profile: ${pErr.message}`);
        }

        const { data: entry, error: lErr } = await db
          .from("eng_production_ledger")
          .insert({ engineer_id: id, amount_cents: 777_00, period: PERIOD, status: "pending", decision: "seal" })
          .select("id")
          .maybeSingle();
        if (lErr) {
          await db.from("eng_profiles").delete().eq("id", id);
          await db.auth.admin.deleteUser(id).catch(() => {});
          throw new Error(`ledger: ${lErr.message}`);
        }

        return {
          label: `Demo Engineer ${TAIL}`,
          cleanup: async () => {
            await db.from("eng_production_ledger").delete().eq("id", entry.id);
            await db.from("eng_profiles").delete().eq("id", id);
            await db.auth.admin.deleteUser(id).catch(() => {});
          },
        };
      },
      control: (figures) => figures.find((f) => f.label.startsWith("Unsigned amendment")),
    },
    {
      report: "partner",
      what: "a demonstration partner with an issued statement",
      async insert() {
        const { data: partner, error: pErr } = await db
          .from("eng_partners")
          .insert({
            organisation: `Demo Partner ${TAIL}`,
            contact_name: "Demo Audit",
            contact_email: `demo.partner.${STAMP}@example.com`,
            code: `DEMOAUD${TAIL}`,
            is_demo: true,
          })
          .select("id")
          .maybeSingle();
        if (pErr) throw new Error(`partner: ${pErr.message}`);

        const reference = `254-S-DEMO-${TAIL}`;
        const { data: statement, error: sErr } = await db
          .from("eng_partner_statements")
          .insert({
            partner_id: partner.id,
            reference,
            period: PERIOD,
            status: "issued",
            total_cents: 555_00,
            issued_at: new Date().toISOString(),
          })
          .select("id")
          .maybeSingle();
        if (sErr) {
          await db.from("eng_partners").delete().eq("id", partner.id);
          throw new Error(`statement: ${sErr.message}`);
        }

        return {
          label: reference,
          cleanup: async () => {
            await db.from("eng_partner_statements").delete().eq("id", statement.id);
            await db.from("eng_partners").delete().eq("id", partner.id);
          },
        };
      },
      control: (figures) => figures.find((f) => f.label === "Issued"),
    },
    {
      /*
       * THE INJECTION THAT GIVES THE DASHBOARDS A SUBJECT.
       *
       * The three above insert an order, a ledger entry and a statement, and no
       * dashboard counts any of them. So when the sweep was widened from four
       * reports to eleven surfaces, the seven new ones were covered by a
       * movement check that nothing could move: removing the dispatcher tile's
       * is_demo filter and re-running produced a clean pass.
       *
       * That is the vacuity trap one level out. Widening the denominator does
       * not widen the proof if the injected record touches nothing in the new
       * part of it, and the green looks identical either way.
       *
       * A FILE awaiting dispatch is what the dispatcher dashboard actually
       * counts, in its "Waiting to be placed" tile and in the county breakdown
       * beneath it. With this here, removing that filter fails the board.
       *
       * The file number carries -DEMO- because 0027's two directional check
       * refuses any other combination: a demonstration file whose number does
       * not say so is unrepresentable, which is the constraint doing the work
       * this injection would otherwise have to remember.
       */
      report: "dispatcher dashboard",
      what: "a demonstration file waiting to be dispatched",
      async insert() {
        const fileNumber = `254-DEMO-AUD${TAIL}`;

        const { data: client, error: cErr } = await db
          .from("eng_clients")
          .insert({
            kind: "organization",
            name: `Demo Audit Client ${TAIL}`,
            email: `demo.client.${STAMP}@example.com`,
            status: "active",
            is_demo: true,
          })
          .select("id")
          .maybeSingle();
        if (cErr) throw new Error(`client: ${cErr.message}`);

        const { data: file, error: fErr } = await db
          .from("eng_files")
          .insert({
            file_number: fileNumber,
            client_id: client.id,
            service_slug: "windstorm-wpi-8",
            property_address: "2 Audit Way",
            county: "Nueces",
            status: "needs_dispatch",
            /*
             * PRICED, AND THAT IS THE POINT.
             *
             * The first version of this fixture carried no money, so it could
             * not move a margin however wrong the filter was, and the
             * administrator dashboard went on reporting $175.00 of margin from
             * three seeded files while this check passed. A fixture can only
             * catch what it can touch.
             */
            client_price_cents: 450_00,
            tech_cost_cents: 150_00,
            engineer_cost_cents: 125_00,
            delivered_at: new Date().toISOString(),
            is_demo: true,
          })
          .select("id")
          .maybeSingle();
        if (fErr) {
          await db.from("eng_clients").delete().eq("id", client.id);
          throw new Error(`file: ${fErr.message}`);
        }

        return {
          label: fileNumber,
          cleanup: async () => {
            await db.from("eng_files").delete().eq("id", file.id);
            await db.from("eng_clients").delete().eq("id", client.id);
          },
        };
      },
      /*
       * The control is a DASHBOARD figure rather than a report one, because
       * this injection exists for the dashboards. There is no scope parameter
       * to ask a dashboard with, so the control is the tile read directly off
       * an unscoped query: if the record is not there to be counted, the
       * movement check above passed over nothing.
       */
      control: null,
      async proveVisible() {
        const { count } = await db
          .from("eng_files")
          .select("id", { count: "exact", head: true })
          .eq("status", "needs_dispatch")
          .is("assigned_tech_id", null);
        return { label: "files awaiting dispatch, unscoped", value: count ?? 0 };
      },
    },
  ];

  for (const injection of INJECTIONS) {
    const before = await snapshot();
    if (before.length === 0) {
      unmeasured.push(`${injection.report} produced no figure to compare, so its injection proves nothing`);
      continue;
    }

    let made;
    try {
      made = await injection.insert();
    } catch (err) {
      rec(`${injection.report}: ${injection.what} could be inserted`, false, String(err.message));
      continue;
    }

    try {
      const after = await snapshot();
      const moved = movement(before, after);
      rec(
        `${injection.report}: ${injection.what} moved no figure`,
        moved.length === 0,
        moved.length ? `MOVED: ${moved.join(" | ")}` : `${after.length} figures unchanged by ${made.label}`,
      );

      /*
       * The control. If the report cannot see the record even when ASKED to,
       * the check above passed because the query is broken rather than because
       * the filter works, which is the defect class this repository keeps
       * finding.
       */
      /*
       * A DASHBOARD HAS NO SCOPE TO ASK, SO ITS CONTROL IS AN UNSCOPED QUERY.
       *
       * A report can be built with "including_demonstrations" and asked whether
       * it can see the record. A dashboard takes an actor and has no such
       * parameter, and giving it one would be adding a way to render a
       * demonstration on a live screen in order to test that it does not. So
       * the control for a dashboard injection is the same count without the
       * filter, run here: if THAT cannot see the record either, the record was
       * never inserted where the tile looks and the movement check above passed
       * over nothing.
       */
      if (injection.proveVisible) {
        const control = await injection.proveVisible();
        rec(
          `${injection.report}: and an unscoped count CAN see it`,
          typeof control.value === "number" && control.value > 0,
          `${control.label} = ${control.value}. Without this the movement check proves nothing: a record the tile's query never reaches cannot move it however broken the filter is.`,
        );
      } else {
        const built = await Promise.all(
          REPORTS.filter((r) => r.key === injection.report).map((r) => r.build(PERIOD, "including_demonstrations")),
        );
        const figures = built.flatMap((r) => r.sections.flatMap((s) => s.figures));
        const control = injection.control(figures);

        rec(
          `${injection.report}: and the report CAN see it when asked to include demonstrations`,
          typeof control?.value === "number" && control.value > 0,
          control
            ? `${control.label} = ${formatFigure(control)} with demonstrations included`
            : "the control figure is not on the report at all",
        );
      }
    } finally {
      await made.cleanup();
    }

    const settled = await snapshot();
    rec(
      `${injection.report}: the injected record was cleaned up`,
      movement(before, settled).length === 0,
      movement(before, settled).join(" | "),
    );
  }

  // ------------------------------- revenue, which cannot be injected and says so

  /*
   * eng_order_payments refuses deletes. That is 0006's ruling and it is right:
   * money that moved is not a row somebody gets to remove. So revenue is proved
   * from the demonstration payments already standing in the database, and the
   * check fails rather than passes if there are none, because a comparison over
   * nothing passes forever.
   */
  {
    const revenue = REPORTS.find((r) => r.key === "revenue");
    const real = await revenue.build(PERIOD, "real");
    const including = await revenue.build(PERIOD, "including_demonstrations");

    const grossOf = (report) =>
      report.sections.flatMap((s) => s.figures).find((f) => f.label === "Gross")?.value ?? null;

    const realGross = grossOf(real);
    const demoGross = grossOf(including);

    rec(
      "revenue has standing demonstration payments to be proved against",
      typeof demoGross === "number" && typeof realGross === "number" && demoGross > realGross,
      typeof demoGross === "number" && typeof realGross === "number"
        ? `real ${realGross}, including demonstrations ${demoGross}. eng_order_payments refuses deletes, so revenue is proved from what is already there rather than by inserting a payment that could never be removed.`
        : "one of the two scopes could not compute gross, so nothing was compared",
    );

    const demoRows = including.sections
      .flatMap((s) => s.figures)
      .flatMap((f) => f.rows ?? [])
      .filter((row) => /-DEMO-/i.test(row.label));
    const realRows = real.sections
      .flatMap((s) => s.figures)
      .flatMap((f) => f.rows ?? [])
      .filter((row) => /-DEMO-/i.test(row.label));

    rec(
      `and none of those ${demoRows.length} demonstration payments reaches a real revenue figure`,
      demoRows.length > 0 && realRows.length === 0,
      realRows.length
        ? `${realRows.map((r) => r.label).join(", ")} are counted in a real figure`
        : "",
    );
  }
}

// ------------------------------------------------------------------ verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

if (unmeasured.length) {
  console.log("");
  for (const u of unmeasured) console.log(`  COULD NOT TELL: ${u}`);
  console.log("");
  console.log("  Part of this did not run. That is not a pass and it is not a failure.");
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
console.log(`PASS: ${out.length} checks. A demonstration moves no figure on any surface.`);
