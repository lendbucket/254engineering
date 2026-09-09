// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`.

/**
 * EVERY ROLE LANDS ON ITS OWN DASHBOARD, AND NONE OF THEM INVENTS A FIGURE.
 *
 *   npm run dashboards-audit
 *
 * Phase 12 Section 2.
 *
 * THE DEFECT THIS EXISTS BECAUSE OF
 * ---------------------------------
 * `dashboardFor` routes on capability rather than on a role name, which is the
 * right design: a role an owner invents on the permission screen with review
 * grants should get the engineer's dashboard without anybody editing code.
 *
 * The cost of that design is that a ladder of capability checks can catch the
 * wrong role, silently, and it did. A dispatcher holds `offers.list_own`, which
 * was the FIELD TECHNICIAN's branch, so every dispatcher was served the
 * technician's dashboard: "Offers waiting on you", "Jobs you hold", "Owed to
 * you", every query scoped to actor.id, so every tile read none and every money
 * figure read zero. The comment directly underneath asserted that a dispatcher
 * gets null and that no dashboard exists for them. It had been wrong since the
 * day it was written, and BACKLOG.md named the exact failure it was: "a fourth
 * generic dashboard that renders empty tiles", except worse, because it was a
 * real dashboard belonging to somebody else.
 *
 * Nothing could have caught it by reading. It was found by BUILDING an actor
 * from every entry in DEFAULT_ROLES and running the ladder, which is what this
 * does on every board run.
 *
 * WHAT ELSE IT ASSERTS
 * --------------------
 * The operator's ruling of 2026-09-08: the dispatcher, sales and customer
 * service dashboards carry no firm level money figure, because none of those
 * roles holds ledger.read_all or billing.read. That is already unrepresentable
 * by type, and this checks the type is still the shape that makes it so, since
 * a `money` field added to one of them would compile and would be the ruling
 * broken quietly.
 */

process.loadEnvFile?.(".env.local");

import { readFileSync } from "node:fs";
import { DEFAULT_ROLES, can } from "../src/lib/ops-authz.ts";
import { MONEYLESS_ROLES, dashboardFor } from "../src/lib/ops-dashboard.ts";
import { standingDemo, ledgerRowCount } from "./lib/standing-demo.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("============ EVERY ROLE LANDS ON ITS OWN DASHBOARD ============");
console.log("");

// ------------------ the declaration that names this function has to check it

/*
 * THE HOLE, CLOSED AS A CHECK RATHER THAN AS A PARAGRAPH.
 *
 * This block used to walk the capability ladder itself, against its own copy of
 * the role to dashboard mapping. That worked and it was the wrong home for it.
 *
 * `scripts/lib/role-total-functions.mjs` is the declaration of every function
 * that takes a role and must be total over the seven that ship. Its own
 * docstring listed `dashboardFor` among the six defects a September sweep
 * found, and its array did not contain it, so the function regressed to a
 * seventh instance and stayed there. Keeping the walk here would have left that
 * exact hole open: a file naming a defect it does not check, with a second copy
 * of the mapping in a different file to disagree with it.
 *
 * Operator ruling, 2026-09-09: fix the file, not the comment. So the walk lives
 * in the registry, roles-audit runs it over every role and every function, and
 * what is asserted HERE is that the registry covers this function at all. A
 * dashboardFor quietly dropped from that list is now a red board, which is the
 * failure that actually happened.
 */
{
  const { ROLE_TOTAL_FUNCTIONS, DASHBOARD_FOR_ROLE } = await import("./lib/role-total-functions.mjs");

  const registered = ROLE_TOTAL_FUNCTIONS.map((f) => f.name);
  rec(
    `the role total registry is populated (${registered.length} functions)`,
    registered.length > 3,
    "a check over an empty registry passes forever",
  );
  rec(
    "and it covers dashboardFor, which is the one it named and did not check",
    registered.includes("dashboardFor"),
    registered.includes("dashboardFor")
      ? registered.join(", ")
      : "role-total-functions.mjs lists dashboardFor among the six defects in its own docstring. A file that names a defect and does not check it is the defect.",
  );

  /*
   * And every shipped role has an answer decided for it. The mapping is in the
   * registry rather than here, so there is one copy; this asserts it is total
   * over DEFAULT_ROLES, which is the property that stops being true when
   * somebody adds a role on the permission screen.
   */
  const undecided = DEFAULT_ROLES.filter((r) => !DASHBOARD_FOR_ROLE[r.key]).map((r) => r.key);
  rec(
    `every shipped role has a dashboard decided for it (${DEFAULT_ROLES.length})`,
    undecided.length === 0,
    undecided.length
      ? `${undecided.join(", ")} has no entry in DASHBOARD_FOR_ROLE, so nobody decided what they see`
      : "",
  );
}

// ------------------------------- and no dashboard shows a figure it cannot hold

{
  const source = readFileSync("src/lib/ops-dashboard.ts", "utf8");

  /*
   * The ruling as a shape check. A `money` field on any of the three would
   * compile, and the screen would render it, and nothing else would notice.
   */
  const withMoney = MONEYLESS_ROLES.filter((role) => {
    const name = role.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
    const block = source.match(new RegExp(`export type ${name}Dashboard = \\{[^}]*\\}`, "s"));
    return block ? /\bmoney\b/.test(block[0]) : false;
  });

  rec(
    `the three moneyless dashboards are declared (${MONEYLESS_ROLES.join(", ")})`,
    MONEYLESS_ROLES.length === 3,
    "an empty list would make the check below vacuous",
  );
  rec(
    "and none of them has a money field to put a firm figure in",
    withMoney.length === 0,
    withMoney.length
      ? `${withMoney.join(", ")} carries a money field. None of those roles holds ledger.read_all or billing.read, and the operator ruled that no dashboard for them carries a firm level money figure.`
      : "unrepresentable by type rather than by discipline",
  );

  /*
   * And the reverse, so the check above cannot pass because the types were
   * renamed out from under it.
   */
  const admin = source.match(/export type AdminDashboard = \{[^}]*\}/s);
  rec(
    "the check can tell a money field when it sees one",
    Boolean(admin) && /\bmoney\b/.test(admin[0]),
    "the administrator's dashboard has one, so a check that found none anywhere would be looking at nothing",
  );
}

// ------------- a role sees firm money only if its grants already say it may

{
  /*
   * OPERATOR RULING, 2026-09-09, ON read_only SEEING THE FIRM'S MONEY.
   *
   * "Accepted only if read_only's existing grants already include the money
   * permission. If they do, the grants decide. If the dashboard is showing
   * read_only a figure its grants do not name, that is a widened grant and it
   * is refused."
   *
   * They do. `read_only` holds `billing.read`, `ledger.read_all` and
   * `pricing.read` in DEFAULT_ROLES, `can()` returns true for all three, and
   * 0018 seeds ('read_only', 'billing.read') and ('read_only', 'ledger.read_all')
   * into eng_role_grants, so it is true in the database and not only in the
   * TypeScript. The dashboard widens nothing: it shows a role the money its
   * grants already name, which is the role's whole purpose, a buyer's
   * accountant or an auditor evaluating the business.
   *
   * This is the check that keeps that true. It reads the ADMINISTRATOR's
   * dashboard specifically, because that is the one carrying FIRM figures.
   * The engineer's and the technician's also have money and it is their OWN
   * pay, which no firm level grant governs and which the ruling above scopes
   * separately.
   */
  const { DASHBOARD_FOR_ROLE } = await import("./lib/role-total-functions.mjs");

  const onFirmMoney = DEFAULT_ROLES.filter((r) => DASHBOARD_FOR_ROLE[r.key] === "admin");
  const FIRM_MONEY_GRANTS = ["ledger.read_all", "billing.read"];

  const widened = onFirmMoney
    .filter((r) => !FIRM_MONEY_GRANTS.every((g) => can({ id: "x", role: r.key, status: "active", grants: new Set(r.grants) }, g)))
    .map((r) => r.key);

  rec(
    `more than one role is served the firm's money dashboard (${onFirmMoney.map((r) => r.key).join(", ")})`,
    onFirmMoney.length > 1,
    "if only the administrator reached it, this check would pass over the one role nobody worried about",
  );
  rec(
    "and every one of them already holds the grants that name that money",
    widened.length === 0,
    widened.length
      ? `${widened.join(", ")} is served firm level money by a dashboard and does not hold ${FIRM_MONEY_GRANTS.join(" and ")}. That is a widened grant, which the operator refused.`
      : `${FIRM_MONEY_GRANTS.join(", ")}, seeded by 0018 rather than only declared in TypeScript`,
  );
}

// ----------------------------- a dashboard tile counts no demonstration either

{
  /*
   * THE RULE IS NOT ONLY ABOUT REPORTS, AND A TILE PROVED IT.
   *
   * Section 2's law is that a figure never counts a demonstration record, and
   * every check written for it pointed at the four reports. The sales dashboard
   * is not a report, so nothing was looking, and its "Accounts on the books"
   * tile read 1 on a development database whose only account belongs to a
   * seeded client. Found by looking at a screenshot.
   *
   * The count is recomputed here from an INDEPENDENT query rather than read
   * back from the module, which is the distinction CLAUDE.md section 6 draws:
   * comparing the dashboard's answer to the dashboard's own query would compare
   * a value to itself and pass on the day the scope goes missing.
   */
  const { auditClient } = await import("./lib/db-target.mjs");
  const db = auditClient("dashboards-audit", { neverProduction: true });

  if (!db) {
    console.log("  COULD NOT TELL: no database, so the accounts tile was not checked against one.");
  } else {
    const { count: real } = await db
      .from("eng_customer_accounts")
      .select("id, eng_clients!inner(is_demo)", { count: "exact", head: true })
      .eq("eng_clients.is_demo", false);
    const { count: everything } = await db
      .from("eng_customer_accounts")
      .select("id", { count: "exact", head: true });

    const sales = await dashboardFor({
      id: "00000000-0000-4000-8000-000000000000",
      role: "sales",
      status: "active",
      grants: new Set(DEFAULT_ROLES.find((r) => r.key === "sales").grants),
    });
    const tile = sales?.tiles.find((t) => t.label === "Accounts on the books");

    rec(
      `the accounts tile can be told apart from an unscoped count (${real} real of ${everything})`,
      real !== everything,
      real === everything
        ? "every account on this database is real, so a tile that counted demonstrations would look identical and this check proves nothing today"
        : `${everything - real} account(s) belong to a demonstration client`,
    );
    rec(
      "and the sales dashboard counts only the real ones",
      tile?.count === real,
      `tile says ${tile?.count}, an independent query says ${real}. A dashboard is not a report, which is exactly why nothing was looking at this one.`,
    );
  }
}

// ------------- a personal dashboard shows demonstration WORK and never its MONEY

{
  /*
   * THE SPLIT, ASSERTED PER FIGURE RATHER THAN PER DASHBOARD.
   *
   * Operator ruling, 2026-09-09: "work lists may show demonstration work when a
   * person is being walked through the platform; that is what the seed is for.
   * Money never does. A technician shown a figure they will not be paid is the
   * defect class with a person attached."
   *
   * So this builds a real fixture rather than reading the source: a
   * demonstration engineer, a demonstration file, and a priced ledger entry
   * joining them. The engineer's own dashboard must then show the work and not
   * the money, and BOTH halves are checked, because a scope that removed the
   * job as well would satisfy a check that only looked at the dollar figure and
   * would break the walkthrough the seed exists for.
   *
   * The control is the same ledger read WITHOUT the scope. If that cannot see
   * the entry either, the fixture never landed where the tile looks and the
   * assertion proves nothing.
   */
  const { auditClient } = await import("./lib/db-target.mjs");
  const db = auditClient("dashboards-audit", { neverProduction: true });
  const { periodOf } = await import("../src/lib/ops-review.ts");

  if (!db) {
    console.log("  COULD NOT TELL: no database, so the money split was not exercised.");
  } else {
    /*
     * A STANDING FIXTURE, NOT A DISPOSABLE ONE, AND 0032 IS WHY.
     *
     * This built an engineer, a client, a priced file and a ledger entry per
     * run and deleted them afterwards. 0032 attached a delete refusal to
     * eng_production_ledger, so the teardown stopped working, AND THIS AUDIT
     * WENT ON PASSING: the client hands a delete error back rather than
     * throwing, the cleanup never looked at it, and development quietly
     * gained an orphaned ledger entry and its profile and file on every run.
     *
     * scripts/lib/standing-demo.mjs keeps ONE of each, forever, and moves its
     * period forward with an UPDATE. Every assertion below is absolute rather
     * than a before-and-after, so a permanent fixture proves the same thing:
     * the unscoped read CAN see the entry, and the dashboard's money reads
     * zero anyway.
     */
    const period = periodOf(new Date());
    const ledgerBefore = await ledgerRowCount(db);

    try {
      const made = await standingDemo(db, period);
      if (made.notes.length) console.log(`  (standing fixture: ${made.notes.join("; ")})`);

      /* The control: unscoped, the entry is plainly there. */
      const { data: unscoped } = await db
        .from("eng_production_ledger")
        .select("amount_cents")
        .eq("engineer_id", made.userId)
        .eq("period", period);
      const wouldBe = (unscoped ?? []).reduce((n, r) => n + Number(r.amount_cents ?? 0), 0);

      rec(
        `an unscoped read of this engineer's ledger CAN see the demonstration entry (${wouldBe})`,
        wouldBe > 0,
        "without this the money assertion below passes over a fixture that never landed",
      );

      const user = { user: { id: made.userId } };
      const dashboard = await dashboardFor({
        id: user.user.id,
        role: "engineer",
        status: "active",
        grants: new Set(DEFAULT_ROLES.find((r) => r.key === "engineer").grants),
      });

      const moneyOn = (dashboard?.money ?? []).map((m) => m.value ?? 0);
      rec(
        `no money figure on a personal dashboard counts demonstration work (${moneyOn.length} figures)`,
        moneyOn.length > 0 && moneyOn.every((v) => v === 0),
        moneyOn.length === 0
          ? "the engineer dashboard produced no money figure, so this checked nothing"
          : `figures read ${moneyOn.join(", ")} against an unscoped ${wouldBe}. A person shown money they will not be paid is the defect class with a person attached.`,
      );

      /*
       * AND THE WORK IS STILL THERE. Half the ruling, and the half a careless
       * fix would break: scoping the whole dashboard would pass the check above
       * and empty the walkthrough the seeded records exist for.
       */
      /* The fixture file is under_review, so "Open in review" is the tile that
       * should have moved. Both review tiles are firm wide rather than scoped to
       * actor.id, which is correct: the review queue is shared and any engineer
       * may take a file from it, so it is a work list in the ruling's sense. */
      const queue = (dashboard?.tiles ?? []).find((t) => t.label === "Open in review");
      rec(
        "and the work list still shows the demonstration file",
        typeof queue?.count === "number" && queue.count > 0,
        queue
          ? `${queue.label} = ${queue.count}. A walkthrough where the jobs do not appear is not a walkthrough.`
          : "no review queue tile was found to check",
      );
    } catch (err) {
      rec("the money split fixture could be built", false, String(err.message));
    } finally {
      /*
       * NOTHING IS TORN DOWN, AND THAT IS ASSERTED RATHER THAN ASSUMED.
       *
       * The fixture is standing by design. What must not happen is it
       * MULTIPLYING, which is what the old per-run fixture started doing the
       * moment its delete stopped working. The count is the check.
       */
      const ledgerAfter = await ledgerRowCount(db);
      /*
       * THE TOLERANCE WAS THE DEFECT. This read `<= ledgerBefore + 1`, which
       * permits exactly one new row per run, which is precisely what a
       * fixture that stopped being reused would do. An injection making the
       * fixture rebuild itself every run PASSED.
       *
       * The fixture itself says whether it created anything, so the expected
       * growth is known rather than guessed: nothing, unless this run built
       * the standing entry for the first time.
       */
      const built = made.notes.some((n) => n.includes("ledger entry")) ? 1 : 0;
      rec(
        "the money fixture did not multiply",
        ledgerAfter === ledgerBefore + built,
        `${ledgerBefore} production ledger row(s) before, ${ledgerAfter} after, ${built} expected. The standing fixture is created once and reused; eng_production_ledger refuses DELETE since 0032, so a fixture that grew would grow forever.`,
      );
    }
  }
}

// ------------- a firm that has delivered nothing has revenue of nothing

{
  /*
   * OPERATOR RULING, 2026-09-09. "With demonstrations excluded and zero real
   * files, the query ran and found nothing. That is zero, not absent. Revenue
   * this period is $0.00 over 0 files. 'Not set' is reserved for a figure whose
   * input is missing, a file with no price, a read that failed."
   *
   * The three cases could not be told apart before, because fileMargins
   * returned [] for a failed read and for an empty firm alike. It returns null
   * on failure now, which is what makes this assertable at all.
   *
   * Both directions are checked. A fix that made every empty figure a zero
   * would satisfy the first half and destroy the distinction the whole of
   * Section 2 exists for.
   */
  const { fileMargins } = await import("../src/lib/ops-docs.ts");
  const { DEFAULT_ROLES: ROLES } = await import("../src/lib/ops-authz.ts");

  const adminActor = {
    id: "00000000-0000-4000-8000-000000000000",
    role: "admin",
    status: "active",
    grants: new Set(ROLES.find((r) => r.key === "admin").grants),
  };

  const files = await fileMargins(adminActor);
  const dashboard = await dashboardFor(adminActor);
  const moneyBy = (label) => dashboard?.money.find((m) => m.label === label);

  rec(
    `fileMargins can say "no files" and "could not read" apart (${files === null ? "read failed" : `${files.length} files`})`,
    files !== null,
    files === null
      ? "the read failed on this run, so the zero assertion below is not the one being exercised"
      : "null means the read failed, an empty array means the firm has no real files",
  );

  if (files !== null && files.length === 0) {
    const revenue = moneyBy("Revenue this period");
    const margin = moneyBy("Margin this period");
    rec(
      "with no real files, revenue and margin are zero rather than absent",
      revenue?.value === 0 && margin?.value === 0,
      `revenue ${JSON.stringify(revenue?.value)}, margin ${JSON.stringify(margin?.value)}. A firm that has delivered nothing has revenue of nothing, and it should say so in numbers.`,
    );
  } else {
    console.log("  COULD NOT TELL: this database has real files, so the empty firm case was not exercised.");
  }

  /*
   * AND THE OTHER DIRECTION, which is the half a careless fix breaks: a figure
   * whose INPUT is missing stays absent. Checked on periodTotals directly,
   * because it is the function that draws the line and it needs no database.
   */
  const { periodTotals } = await import("../src/lib/ops-money.ts");
  const noPrice = periodTotals("2026-09", [
    {
      id: "x",
      clientPriceCents: null,
      techCostCents: 100,
      engineerCostCents: 100,
      partnerCostCents: 0,
    },
  ]);
  rec(
    "and a file with no price still makes the figure absent, not zero",
    noPrice.revenue === null && noPrice.margin === null,
    `revenue ${JSON.stringify(noPrice.revenue)}, margin ${JSON.stringify(noPrice.margin)}. Turning a missing input into a zero is the same lie the other way round.`,
  );
}

// -------------------------------- what could not be counted is on the screen

{
  const page = readFileSync("src/app/portal/(app)/page.tsx", "utf8");

  rec(
    "the screen renders what a dashboard could not compute",
    /NotComputable/.test(page) && /notComputable/.test(page),
    "the ruling says a figure the grants do not cover is reported rather than fixed by widening one, and a reason nobody can see is not reported",
  );
  rec(
    "and renders the grouped answers",
    /BreakdownList/.test(page) && /breakdowns/.test(page),
    "a dispatcher acts on the queue by county and age, which is not a number",
  );
}

// ------------------------------------------------------------------ verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A role served somebody else's dashboard reads every tile as none,");
  console.log("which looks like a quiet day rather than a defect.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. Every role lands on its own dashboard.`);
