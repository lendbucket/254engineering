/**
 * IS THE INVENTORY THE INVENTORY.
 *
 *   npx tsx scripts/surface-audit.mjs
 *
 * Pure. No server, no database, no network, so it runs in phase zero beside
 * db-guard-audit and backlog-audit.
 *
 * WHY THIS EXISTS
 * ---------------
 * Operator ruling, 2026-09-07. Until that day every browser audit carried its
 * own hand written list of what to measure and there was no list of what
 * exists, so a surface entered the harness only where somebody remembered. The
 * partner portal shipped in Phase 9 Section 4 and reached two audits out of
 * eight: five signed in pages, two credential forms and four APIs were measured
 * for contrast by nothing, for tap targets by nothing, for overflow by nothing,
 * for form behaviour by nothing, and for the perimeter by nothing. The customer
 * account surface was in fewer still.
 *
 * `scripts/lib/surfaces.mjs` is the declaration. This is the part that makes it
 * binding: a directory that renders pages and belongs to no declared surface
 * fails here, and so does an audit that has stopped deriving from it.
 *
 * WHAT IT CANNOT DO, STATED PLAINLY
 * ---------------------------------
 * It cannot tell whether an audit that imports the inventory then measures
 * everything the inventory gave it. An audit could import the list and filter it
 * down to one route. What it can do is make the list exist, make it complete,
 * and make dropping it visible, which is three of the four things that were
 * missing. The fourth is each audit's own vacuity check, and those live in the
 * audits.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SESSIONS,
  SURFACES,
  allPages,
  guardedSurfaces,
  measurableSurfaces,
  routesOf,
  shellSurfaces,
  surfaces,
} from "./lib/surfaces.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ THE SURFACE INVENTORY ================");
console.log("");

// =========================================================================
// 1. THE CANARY. An inventory that matched nothing would turn every audit
//    deriving from it into an audit measuring nothing, and every one of them
//    would report green.
// =========================================================================

rec("the inventory declares surfaces", surfaces().length >= 4, `${SURFACES.length} declared`);

const pages = allPages();
rec(
  "and they resolve to pages an audit can open",
  pages.length >= 30,
  `${pages.length} pages across ${new Set(pages.map((p) => p.surface)).size} surfaces`,
);

for (const surface of measurableSurfaces()) {
  const routes = routesOf(surface, { include: "all" });
  rec(
    `${surface.key} resolves to at least one route`,
    routes.length > 0,
    routes.length ? `${routes.length} route(s)` : "the walk found nothing, so every audit deriving from it measures nothing",
  );
}

/*
 * The helpers refuse rather than return nothing, which is the canary as a
 * property of the module rather than as a check somebody has to remember to
 * write. Asserted by asking for something that cannot match.
 */
{
  let threw = false;
  try {
    const { surfacesWhere } = await import("./lib/surfaces.mjs");
    surfacesWhere(() => false, "a deliberately impossible filter");
  } catch {
    threw = true;
  }
  rec(
    "and asking the inventory for an empty set is an error rather than an empty array",
    threw,
    "a filter that matches nothing must not read as a surface with nothing in it",
  );
}

// =========================================================================
// 2. COMPLETENESS. Adding a surface without declaring it fails here.
// =========================================================================

/**
 * Directories under src/app that render pages and are not their own surface.
 *
 * Each one names the audit that measures it, and the check below asserts that
 * audit exists and mentions the path. An exemption whose owner does not
 * reference it is an exemption that has quietly become a gap.
 */
const PAGES_MEASURED_ELSEWHERE = {};

/** Route handler trees that are not a surface's API, with their owner. */
const APIS_MEASURED_ELSEWHERE = {
  apply: ["scripts/lib/careers-audit.mjs", "the careers application flow"],
  cron: ["scripts/security-audit.mjs", "every scheduled route, refused without CRON_SECRET"],
  lead: ["scripts/forms-audit.mjs", "the marketing intake"],
  onboarding: ["scripts/jobs-audit.mjs", "the invite and reminder mail the flow queues"],
  "order-flow": ["scripts/security-audit.mjs", "the one write path a visitor can reach, checked for what it refuses"],
  orders: ["scripts/security-audit.mjs", "the customer facing order lookup"],
  referral: ["scripts/partner-audit.mjs", "partner attribution"],
  stripe: ["scripts/order-audit.mjs", "the payment webhook"],
  upload: ["scripts/lib/careers-audit.mjs", "signed upload urls for an application"],
  v1: ["scripts/accounts-audit.mjs", "the account API, keyed rather than sessioned"],
};

{
  const root = process.cwd();
  const claimed = new Map();
  for (const surface of surfaces()) {
    for (const dir of [...(surface.dirs ?? []), ...(surface.publicDirs ?? [])]) {
      claimed.set(dir.split("/")[2], surface.key);
    }
  }

  const unclaimed = [];
  for (const entry of readdirSync(join(root, "src", "app"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "api") continue;

    // A directory with no page anywhere under it renders no screen.
    const hasPage = (dir) => {
      if (existsSync(join(dir, "page.tsx"))) return true;
      for (const child of readdirSync(dir, { withFileTypes: true })) {
        if (child.isDirectory() && hasPage(join(dir, child.name))) return true;
      }
      return false;
    };
    if (!hasPage(join(root, "src", "app", entry.name))) continue;

    if (claimed.has(entry.name)) continue;
    if (PAGES_MEASURED_ELSEWHERE[entry.name]) continue;
    unclaimed.push(entry.name);
  }

  rec(
    "every directory that renders pages belongs to a declared surface",
    unclaimed.length === 0,
    unclaimed.length
      ? `not declared: ${unclaimed.join(", ")}. Add it to scripts/lib/surfaces.mjs, or exempt it there with the audit that measures it.`
      : `${claimed.size} directories claimed`,
  );

  const apiRoot = join(root, "src", "app", "api");
  const apiClaimed = new Set();
  for (const surface of surfaces()) {
    for (const dir of surface.apiDirs ?? []) apiClaimed.add(dir.split("/")[3]);
  }

  const unclaimedApis = [];
  const staleExemptions = [];
  for (const entry of readdirSync(apiRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (apiClaimed.has(entry.name)) continue;
    const exemption = APIS_MEASURED_ELSEWHERE[entry.name];
    if (!exemption) {
      unclaimedApis.push(entry.name);
      continue;
    }
    const [owner] = exemption;
    const covered =
      existsSync(join(root, owner)) && readFileSync(join(root, owner), "utf8").includes(`/api/${entry.name}`);
    if (!covered) staleExemptions.push(`${entry.name} -> ${owner}`);
  }

  rec(
    "every route handler tree belongs to a surface or names the audit that measures it",
    unclaimedApis.length === 0,
    unclaimedApis.length ? `unclaimed: ${unclaimedApis.join(", ")}` : `${apiClaimed.size} surface trees, ${Object.keys(APIS_MEASURED_ELSEWHERE).length} named elsewhere`,
  );

  rec(
    "and each of those named audits actually references the path it claims",
    staleExemptions.length === 0,
    staleExemptions.length
      ? `claimed but not referenced: ${staleExemptions.join(", ")}`
      : "an exemption whose owner does not mention it is a gap wearing a reason",
  );
}

// =========================================================================
// 3. THE DECLARATION IS WELL FORMED, so a surface cannot be added wrongly.
// =========================================================================

{
  const problems = [];
  for (const surface of surfaces()) {
    if (!SESSIONS.includes(surface.session)) {
      problems.push(`${surface.key}: session "${surface.session}" is not one of ${SESSIONS.join(", ")}`);
    }
    if (surface.session !== "none" && !surface.probe) {
      problems.push(`${surface.key}: needs a session and names no probe, so no audit can open it`);
    }
    if (surface.session === "none" && surface.probe) {
      problems.push(`${surface.key}: needs no session and names a probe`);
    }
    for (const dir of [
      ...(surface.dirs ?? []),
      ...(surface.publicDirs ?? []),
      ...(surface.apiDirs ?? []),
      ...(surface.componentDirs ?? []),
    ]) {
      if (!existsSync(join(process.cwd(), dir))) problems.push(`${surface.key}: ${dir} does not exist`);
    }
  }
  rec("every declared surface is well formed", problems.length === 0, problems.join(" | "));

  const probeSource = readFileSync("scripts/lib/portal-probe.mjs", "utf8");
  const missingProbes = surfaces()
    .filter((s) => s.probe)
    .filter((s) => !new RegExp(`export async function ${s.probe}\\b`).test(probeSource))
    .map((s) => `${s.key} -> ${s.probe}`);
  rec(
    "and the probe each one names exists",
    missingProbes.length === 0,
    missingProbes.length ? `missing: ${missingProbes.join(", ")}` : "one probe per principal",
  );
}

// =========================================================================
// 4. THE AUDITS DERIVE FROM IT. This is the part that rots first: an audit
//    can quietly go back to a hand written list and nothing else would say so.
// =========================================================================

{
  const MUST_DERIVE = [
    ["scripts/contrast-audit.mjs", "WCAG contrast and other violations"],
    ["scripts/mobile-audit.mjs", "tap targets, clipping and sideways scroll"],
    ["scripts/mobile-overflow-audit.mjs", "sideways scroll on every route"],
    ["scripts/native-audit.mjs", "the native standard at 390"],
    ["scripts/forms-audit.mjs", "every input and state"],
    ["scripts/security-audit.mjs", "the perimeter"],
    ["scripts/token-audit.mjs", "the design system"],
  ];

  for (const [file, what] of MUST_DERIVE) {
    const source = readFileSync(file, "utf8");
    rec(
      `${file.replace("scripts/", "")} derives its list from the inventory`,
      /from "\.\/lib\/surfaces\.mjs"|from "\.\.\/lib\/surfaces\.mjs"|require\("\.\/lib\/surfaces/.test(source),
      what,
    );
  }
}

// =========================================================================
// 5. AND THE SHELL SURFACES ARE KNOWN, because the audits that measure
//    geometry have to look at the region rather than the document on those.
// =========================================================================

{
  const shells = shellSurfaces().map((s) => s.key);
  rec(
    "the surfaces built as an app shell are declared as such",
    shells.includes("portal") && shells.includes("partner"),
    shells.join(", "),
  );

  for (const file of ["scripts/mobile-audit.mjs", "scripts/mobile-overflow-audit.mjs"]) {
    const source = readFileSync(file, "utf8");
    rec(
      `${file.replace("scripts/", "")} measures the scrolling region and not only the document`,
      /data-portal-scroll/.test(source),
      "point 1 of the native standard moved the scrolling off the document",
    );
  }

  const guarded = guardedSurfaces().map((s) => s.key);
  rec(
    "and every surface behind a session is known to the perimeter",
    guarded.includes("portal") && guarded.includes("partner") && guarded.includes("account"),
    guarded.join(", "),
  );
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A harness that does not know what surfaces exist measures the ones");
  console.log("somebody remembered, and reports green about the rest.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Every surface is declared, and every audit that must derive from the list does.`);
