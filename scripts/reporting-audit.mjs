// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`.

/**
 * EVERY REPORT IS MEASURED, AND THE LIST OF REPORTS IS DERIVED.
 *
 *   npm run reporting-audit
 *
 * Phase 12 Section 2. The registry in src/lib/ops-reports.ts is the declared
 * inventory, the same idiom as scripts/lib/surfaces.mjs and for the same
 * reason: a list of things to check, maintained by hand, stops describing the
 * system the first time somebody forgets, and the forgetting is silent.
 *
 * email-audit learned this the expensive way. Three templates were written,
 * wired and shipped while its count sat at 352 and nothing failed, because the
 * fixture list was a list. So this derives the reports from the registry, and a
 * report that exists and is not measured here is a red board.
 *
 * WHAT THIS ASSERTS ABOUT A FIGURE
 * --------------------------------
 * The rule the section adds: every figure is a number a query produced, the
 * word none because the query ran and found nothing, or an absence because it
 * could not run. There is no fourth state, and in particular there is no
 * designed slot filled with a plausible value.
 *
 * So every figure must carry a note saying what its zero means, and every
 * figure must be expandable into the rows behind it. A total nobody can expand
 * is a number somebody has to trust, which the brief names as the defect class.
 */

process.loadEnvFile?.(".env.local");

import { readFileSync } from "node:fs";
import { REPORTS, formatFigure, periodOf } from "../src/lib/ops-reports.ts";
import { LICENSED_FIGURES } from "../src/lib/ops-authz.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("============ EVERY FIGURE IS ONE OF THREE THINGS ============");
console.log("");

// -------------------------------------------- the registry describes the module

{
  const source = readFileSync("src/lib/ops-reports.ts", "utf8");

  /*
   * Every exported builder must be in the registry. Read from the source rather
   * than from the registry itself, because the registry cannot report a report
   * it does not contain.
   */
  const exported = [...source.matchAll(/export async function (\w+Report)\(/g)].map((m) => m[1]);
  const registered = REPORTS.map((r) => r.build.name);
  const unmeasured = exported.filter((e) => !registered.includes(e)).sort();

  rec(
    `the module exports report builders (${exported.length})`,
    exported.length > 2,
    "a derivation over nothing passes forever",
  );
  rec(
    "every report builder that exists is in the registry",
    unmeasured.length === 0,
    unmeasured.length ? `NOT REGISTERED: ${unmeasured.join(", ")}` : `${registered.length} of ${exported.length}`,
  );

  /* And each carries the grant that gates it, so a report cannot ship ungated. */
  const ungated = REPORTS.filter((r) => !/^reports\.[a-z_]+$/.test(r.action)).map((r) => r.key);
  rec(
    "every report is gated by a reports.* action",
    ungated.length === 0,
    ungated.join(", "),
  );

  /*
   * The screen asks the same grant the registry names. Asserted on the source,
   * because the alternative is a page that renders for everybody while the
   * registry says otherwise.
   */
  const page = readFileSync("src/app/portal/(app)/reports/page.tsx", "utf8");
  rec(
    "the screen filters the registry by the actor's grants",
    /REPORTS\.filter\(\(r\) => can\(actor, r\.action\)\)/.test(page),
    "a report is a permission, and the screen has to ask",
  );
  rec(
    "and refuses outright when a role holds none of them",
    /allowed\.length === 0\) notFound\(\)/.test(page),
    "an empty reports page tells somebody what they are not allowed to see",
  );
}

// ------------------------------------------------ every figure obeys the rule

{
  const period = periodOf();
  const built = await Promise.all(REPORTS.map((r) => r.build(period)));

  const figures = built.flatMap((r) =>
    r.sections.flatMap((s) => s.figures.map((f) => ({ ...f, report: r.key, section: s.title }))),
  );

  rec(
    `the reports produced figures to check (${figures.length})`,
    figures.length > 5,
    "a check over no figures passes forever",
  );

  const noNote = figures.filter((f) => !f.note || f.note.trim().length < 10);
  rec(
    "every figure says what its zero means",
    noNote.length === 0,
    noNote.map((f) => `${f.report}/${f.label}`).join(", "),
  );

  const noRows = figures.filter((f) => f.rows === null);
  rec(
    "every figure can be expanded into the rows that produced it",
    noRows.length === 0,
    noRows.length
      ? `${noRows.map((f) => `${f.report}/${f.label}`).join(", ")}. A total nobody can expand is a number somebody has to trust.`
      : `${figures.length} figures carry their record set`,
  );

  /*
   * THE THIRD STATE IS RENDERED AS WORDS, NEVER AS A NUMBER.
   *
   * The one thing that must never happen is an absent figure rendering as 0 or
   * $0.00. formatFigure is the only thing that turns a Figure into text, so it
   * is checked directly rather than by scraping the page.
   */
  rec(
    "an absent figure renders as words rather than a zero",
    formatFigure({ label: "x", value: null, kind: "money", note: "n", rows: null }) === "not computed" &&
      formatFigure({ label: "x", value: null, kind: "count", note: "n", rows: null }) === "not computed",
    "absent must never be indistinguishable from nothing",
  );
  rec(
    "a real zero renders as a figure, not as an absence",
    formatFigure({ label: "x", value: 0, kind: "money", note: "n", rows: null }) === "$0.00" &&
      formatFigure({ label: "x", value: 0, kind: "count", note: "n", rows: null }) === "none",
    "turning a real zero into an absence is the same lie the flattering way round",
  );

  const numericAbsent = figures.filter((f) => f.value === null && /^[-–—]?\d/.test(formatFigure(f)));
  rec(
    "and no absent figure on any live report renders as a number",
    numericAbsent.length === 0,
    numericAbsent.map((f) => `${f.report}/${f.label}`).join(", "),
  );
}

// ------------------------------------- the nav reaches everybody who may read

{
  /*
   * A NAV ITEM CARRIES ONE ACTION AND THE SCREEN ALLOWS FOUR.
   *
   * So the item has to name an action every report reading role holds. If a
   * role is ever granted one report and not the nav's, the link disappears for
   * them while the page stays reachable by URL, which is how a screen becomes
   * something people find by accident rather than something they are given.
   *
   * Derived from DEFAULT_ROLES rather than from a list here, so a role added on
   * the permission screen is covered without anybody remembering.
   */
  const { DEFAULT_ROLES } = await import("../src/lib/ops-authz.ts");
  const { NAV } = await import("../src/components/portal/nav.ts");

  const item = NAV.find((n) => n.href === "/portal/reports");
  rec("the reports screen is in the navigation", Boolean(item), item ? item.action : "no nav item points at it");

  if (item) {
    const reportActions = REPORTS.map((r) => r.action);
    const stranded = DEFAULT_ROLES.filter((role) => {
      const holds = role.grants.filter((g) => reportActions.includes(g));
      return holds.length > 0 && !role.grants.includes(item.action);
    }).map((r) => r.key);

    rec(
      `every role that may read a report can see the link (${item.action})`,
      stranded.length === 0,
      stranded.length
        ? `${stranded.join(", ")} hold a report grant and not ${item.action}, so the page is reachable only by URL for them`
        : "",
    );
  }
}

// ---------------------------------------- licensed figures are not grantable

{
  /*
   * The compile proof does the real work; this asserts the list is not empty,
   * because a proof over an empty type proves nothing and would pass silently.
   */
  rec(
    `licensed figures are declared (${LICENSED_FIGURES.length})`,
    LICENSED_FIGURES.length > 0,
    "an empty list would make the compile proof vacuous",
  );

  const proof = readFileSync("scripts/proofs/licensed-actions-are-unrepresentable.ts", "utf8");
  const uncovered = LICENSED_FIGURES.filter((f) => !proof.includes(`"${f}"`));
  rec(
    "and every one of them appears in the compile proof",
    uncovered.length === 0,
    uncovered.length ? `not proved unrepresentable: ${uncovered.join(", ")}` : "",
  );
}

// ------------------------------------------------------------------ verdict

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A figure on a report is a claim the firm makes about itself.");
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. Every figure is a number, a none, or an absence with a reason.`);
