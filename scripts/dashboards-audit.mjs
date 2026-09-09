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
