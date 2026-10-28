/**
 * W2: WALK EVERY WORKFLOW THE MAP NAMES, AS THE ROLE THE MAP NAMES.
 *
 * Robert's instruction of 22:05 Central, 2026-10-26, phase W2, and his
 * overnight ruling of 22:48 Central, 2026-10-27: the walk writes probe accounts
 * to development, so it runs only on a board, and W3 is built from what this
 * prints in the board's sealed log.
 *
 * THE SUBJECT IS docs/workflows.md, READ AS DATA (scripts/lib/workflow-map.mjs).
 * Every step of 254-WF-001 to 254-WF-036 gets exactly one result per width:
 *
 *   works      the page opened for the role, said something, and carries a
 *              control where the step is something a person does
 *   friction   it opened and something is in the way; the reason says what
 *   broken     the role the map names could not use it; the reason says why
 *   missing    the map itself marks the step [NO SCREEN] or
 *              [NEEDS SQL, A SCRIPT OR A CODE EDIT]
 *
 * and two results that say what the walk could not see, counted rather than
 * folded into one of the four, because folding them in would claim a finding
 * nobody made:
 *
 *   off-screen the step happens outside this platform's pages (Stripe's card
 *              page, an email, a notice), so a browser here has nothing to open
 *   unreached  the page needs a record (an id in the path) and the list it is
 *              opened from offered none on development; or the page opened
 *              on its empty state (data-empty-state), so the control the step
 *              names, which belongs to a row, had no row to sit on
 *
 * THE SECOND HALF OF "unreached" CAME FROM THE FIRST RUN (board 40635489767).
 * Twelve steps read "no control to do ..." as friction: refunding an order,
 * retrying a dead job, accepting an offer. Every one of those controls exists
 * in the source and renders on a row, and the probe's list had no rows. A page
 * with nothing to act on and a page with no way to act read the same to a
 * count of buttons, so the empty state now says which it is. A page with no
 * control and no empty state is still friction.
 *
 * NOTHING IS DRIVEN. The walk opens pages and reads them; it never submits a
 * form or presses a button, so nothing is charged, sent, sealed or written by
 * a step. A step whose control is present reads "control present, not driven".
 * The only rows written are the probe accounts, on @audit-probe.invalid, and
 * the teardown removes them and reads the removal back.
 *
 * THE VERDICT IS ABOUT THE WALK, NOT ABOUT THE PLATFORM. It passes when every
 * mapped step was walked and given a result, and fails only when a step could
 * not be walked or classified, which is a fault in this harness. A principal
 * that could not be built is COULD NOT TELL with its fault named (CLAUDE.md
 * section 6c): no probe means nothing was measured, not that a door is open.
 * The findings themselves are the "W2 RESULT:" lines, one per step and width.
 */

import { chromium } from "playwright";

import { readWorkflowMap } from "./lib/workflow-map.mjs";
import { SURFACES, roleForRoute } from "./lib/surfaces.mjs";
import { AUDIT_BASE_URL } from "./lib/ports.mjs";
import { navigationVerdict, orCouldNotTell, COULD_NOT_TELL } from "./lib/reachable.mjs";
import {
  createProbe,
  cookieFor,
  destroyProbes,
  createPartnerProbe,
  partnerCookieFor,
  destroyPartnerProbes,
  createCustomerProbe,
  customerCookieFor,
  destroyCustomerProbes,
} from "./lib/portal-probe.mjs";

const BASE = process.env.BASE_URL ?? AUDIT_BASE_URL;
const LABEL = "w2-walk";
const WIDTHS = [1280, 390];

/*
 * WHAT THE MAP SAYS ABOUT ITSELF, PINNED AS LITERALS. An audit never imports
 * its expectation from the thing it audits (CLAUDE.md section 6), so the
 * counts are typed here and compared with what the parser found: 36
 * workflows, at least 138 steps, and the marks as the map's own table counts
 * them (8 steps needing SQL, a script or a code edit; 13 with no screen). A
 * step added to the map raises the floor on purpose, in two places.
 */
const MAP_WORKFLOWS = 36;
const MAP_STEPS_AT_LEAST = 138;
const MAP_NEEDS_CODE = 8;
const MAP_NO_SCREEN = 13;

/** The office-ready standard, CLAUDE.md section 2d: a staff page is interactive in under 2 seconds. */
const STAFF_INTERACTIVE_MS = 2000;

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ W2, EVERY WORKFLOW WALKED AS ITS ROLE ================");

// ------------------------------------------------------------------ the map
const workflows = readWorkflowMap();
const steps = workflows.flatMap((w) => w.steps.map((s) => ({ ...s, wf: w.id, section: w.section })));
const ids = workflows.map((w) => w.id);
const expectedIds = Array.from({ length: MAP_WORKFLOWS }, (_, i) => `254-WF-${String(i + 1).padStart(3, "0")}`);
rec(
  "the map names 254-WF-001 to 254-WF-036, once each and in order",
  ids.join(",") === expectedIds.join(","),
  `${ids.length} workflow(s) parsed`,
);
const malformed = steps.filter((s) => s.malformed);
rec("every step row has the map's ten columns", malformed.length === 0, malformed.map((s) => `${s.wf} step ${s.n}: ${s.malformed}`).join("; "));
rec(
  `the map holds at least ${MAP_STEPS_AT_LEAST} steps`,
  steps.length >= MAP_STEPS_AT_LEAST,
  `${steps.length} parsed; a parser that matched nothing would walk nothing and pass`,
);
const needsCode = steps.filter((s) => s.marks?.needsCode).length;
const noScreen = steps.filter((s) => s.marks?.noScreen).length;
rec(
  "the marks parsed are the marks the map counts",
  needsCode === MAP_NEEDS_CODE && noScreen === MAP_NO_SCREEN,
  `${needsCode} needing SQL, a script or a code edit (the map says ${MAP_NEEDS_CODE}); ${noScreen} with no screen (the map says ${MAP_NO_SCREEN})`,
);

// ------------------------------------------------------------------ who walks each step
const portal = SURFACES.find((s) => s.key === "portal");
const SIGNED_OUT_PAGES = /\/(login|sign-up|forgot-password|set-password)$/;

/** The staff role a "Who" cell names, read from its first words. Null when it names none. */
function staffRoleFor(who) {
  const w = who.toLowerCase().replace(/`/g, "");
  if (/^(engineer|office staff and engineer)/.test(w)) return "engineer";
  if (/^rep\b/.test(w)) return "rep";
  if (/^ops manager/.test(w)) return "ops_manager";
  if (/^(technician|the technician)/.test(w)) return "field_tech";
  if (/^customer service/.test(w)) return "customer_service";
  if (/^(admin|the owner|the operator|staff with [a-z]|enrolled staff)/.test(w) && !/^staff with no enrolment/.test(w)) return "admin";
  if (/^(any staff|staff with no enrolment)/.test(w)) return "rep";
  return null;
}

/** The principal that opens one route of one step. "The same" is whoever did the step before it. */
function principalFor(step, route, previousStaff) {
  if (SIGNED_OUT_PAGES.test(route)) return "signed out";
  if (route === "/portal" || route.startsWith("/portal/")) {
    if (/^the same\b/i.test(step.who.trim()) && previousStaff) return previousStaff;
    return staffRoleFor(step.who) ?? roleForRoute(portal, route) ?? "admin";
  }
  if (route === "/partner" || route.startsWith("/partner/")) return "partner";
  if (route === "/account" || route.startsWith("/account/")) return "customer";
  return "signed out";
}

const previousStaffIn = new Map();
const plan = steps.map((s) => {
  if (s.malformed) return { step: s, kind: "fault" };
  if (s.marks.needsCode || s.marks.noScreen) return { step: s, kind: "missing" };
  if (!s.routes.length) return { step: s, kind: "off-screen" };
  const routes = s.routes.map((r) => ({ route: r, who: principalFor(s, r, previousStaffIn.get(s.wf)) }));
  const staffWho = routes.find((r) => r.route.startsWith("/portal") && r.who !== "signed out")?.who;
  if (staffWho) previousStaffIn.set(s.wf, staffWho);
  return { step: s, kind: "walk", routes };
});
const rolesNeeded = [...new Set(plan.flatMap((p) => (p.routes ?? []).map((r) => r.who)))].filter((r) => r !== "signed out");

// ------------------------------------------------------------------ principals
const sessions = {};
async function teardown() {
  const staff = await destroyProbes(LABEL);
  const partners = await destroyPartnerProbes(LABEL);
  const customers = await destroyCustomerProbes(LABEL);
  return { staff, partners, customers };
}

await orCouldNotTell(
  async () => {
    for (const role of rolesNeeded) {
      if (role === "partner") sessions.partner = { probe: await createPartnerProbe(BASE, LABEL), cookie: partnerCookieFor };
      else if (role === "customer") sessions.customer = { probe: await createCustomerProbe(BASE, LABEL), cookie: customerCookieFor };
      else sessions[role] = { probe: await createProbe(BASE, role, LABEL), cookie: cookieFor };
    }
  },
  `the server at ${BASE}`,
  teardown,
);

const faulted = Object.entries(sessions).filter(([, s]) => !s.probe?.cookie);
if (faulted.length) {
  await teardown();
  console.log("");
  for (const [role, s] of faulted) {
    console.log(`  COULD NOT TELL: no ${role} session, so no ${role} step was walked (${s.probe?.fault ?? "no session cookie came back"}).`);
  }
  console.log("");
  console.log("  Nothing was walked, and that is not a pass and not a failure. A probe that");
  console.log("  could not be built says nothing about the screens it was meant to open.");
  process.exit(COULD_NOT_TELL);
}
rec(
  "a probe session was built for every role the map's steps need",
  rolesNeeded.every((r) => sessions[r]?.probe?.cookie),
  rolesNeeded.join(", "),
);

// ------------------------------------------------------------------ the walk
/** Runs in the page: what a person would meet on it. */
function readPage() {
  const main = document.querySelector("main") ?? document.body;
  const text = (main.innerText ?? "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const controls = [...main.querySelectorAll("button, input, select, textarea, form, a[href]")].filter(
    (el) => visible(el) && !el.disabled,
  ).length;
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    text: text.slice(0, 400),
    chars: text.length,
    controls,
    empty: main.querySelector("[data-empty-state]") !== null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    interactive: nav ? Math.round(nav.domInteractive) : null,
    links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
  };
}

const PASSIVE = /^(reads|opens|arrives|sees|looks|follows|waits|receives|is told|gets|lands)\b/i;
const ERROR_TEXT = /application error|internal server error|something went wrong|this page could not be found/i;
const NOT_DRIVEN = /pay|charge|refund|send|sends|email|text|sms|seal|sign/i;

const rank = { works: 0, friction: 1, broken: 2 };
const contexts = {};
let browser = null;

async function contextFor(who, width) {
  const key = `${who}@${width}`;
  if (contexts[key]) return contexts[key];
  browser ??= await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  const s = sessions[who];
  if (s) await ctx.addCookies(s.cookie(s.probe, BASE));
  contexts[key] = ctx;
  return ctx;
}

/** Opens one path and judges it. Throws only on a fault in the harness or a vanished server. */
async function openAndJudge(ctx, path, step, width, staff) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120));
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e.message ?? e).slice(0, 120)));
  try {
    let res;
    try {
      res = await page.goto(BASE + path, { waitUntil: "load", timeout: 45000 });
    } catch (err) {
      const v = navigationVerdict(err);
      if (v.unreachable) throw err;
      if (/timeout/i.test(String(err?.message))) return { result: "broken", reason: `${path} did not load in 45 seconds` };
      throw err;
    }
    await page.waitForTimeout(400);
    const status = res?.status() ?? 0;
    const landed = new URL(page.url()).pathname;
    const seen = await page.evaluate(readPage);
    const notes = [];
    if (landed !== path) notes.push(`landed on ${landed}`);
    if (status >= 500) return { result: "broken", reason: `${path} answered HTTP ${status}`, seen };
    if (status === 404 || ERROR_TEXT.test(seen.text)) return { result: "broken", reason: `${path} shows an error page (HTTP ${status})`, seen };
    if (status >= 400) return { result: "broken", reason: `${path} refused the role the map names (HTTP ${status})`, seen };
    if (/\/login$/.test(landed) && !/\/login$/.test(path)) {
      return { result: "broken", reason: `${path} sent the role the map names to sign in (${landed})`, seen };
    }
    const friction = [];
    if (seen.chars < 60) friction.push(`the page says almost nothing (${seen.chars} characters)`);
    /* No control on an EMPTY list is nothing to act on yet, not no way to act (see the header). */
    const noControl = !PASSIVE.test(step.does.trim()) && seen.controls === 0;
    if (noControl && !seen.empty) friction.push(`no control to do "${step.does.slice(0, 60)}"`);
    if (noControl && seen.empty) notes.push(`opened on its empty state, so no row to "${step.does.slice(0, 60)}" on development`);
    if (seen.overflow > 1) friction.push(`scrolls sideways by ${seen.overflow}px`);
    if (consoleErrors.length) friction.push(`${consoleErrors.length} console error(s), first: ${consoleErrors[0]}`);
    if (staff && width === 1280 && seen.interactive && seen.interactive > STAFF_INTERACTIVE_MS) {
      friction.push(`interactive in ${seen.interactive} ms, over the 2 second standard`);
    }
    if (!PASSIVE.test(step.does.trim()) && seen.controls > 0 && NOT_DRIVEN.test(step.does)) notes.push("control present, not driven");
    if (friction.length) return { result: "friction", reason: [...friction, ...notes].join("; "), seen };
    if (noControl && seen.empty) return { result: "unreached", reason: [`${path} opened`, ...notes].join("; "), seen };
    return { result: "works", reason: [`${path} opened`, ...notes].join("; "), seen };
  } finally {
    await page.close();
  }
}

/**
 * A path with an id in it is reached the way a person reaches it: from a page
 * that links to it. The step's own fixed pages are tried first (the orders list
 * beside an order, the statements list beside a statement), then each page
 * above the id, nearest first.
 */
async function reachDynamic(ctx, pattern, step, width, staff) {
  const segs = pattern.split("/");
  const at = segs.findIndex((s) => s.startsWith("["));
  const ancestors = [];
  for (let i = at; i >= 1; i--) ancestors.push(segs.slice(0, i).join("/") || "/");
  const from = [...new Set([...step.routes.filter((r) => !r.includes("[")), ...ancestors])];
  const shape = new RegExp(
    "^" + segs.map((s) => (s.startsWith("[") ? "[^/?#]+" : s.replace(/[.*+?^${}()|[\]]/g, (c) => "\\" + c))).join("/") + "$",
  );
  let target = null;
  let via = null;
  for (const parent of from) {
    const page = await ctx.newPage();
    try {
      try {
        await page.goto(BASE + parent, { waitUntil: "load", timeout: 45000 });
      } catch (err) {
        if (navigationVerdict(err).unreachable) throw err;
        continue;
      }
      const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
      target = hrefs.map((h) => (h ?? "").split(/[?#]/)[0]).find((h) => shape.test(h)) ?? null;
    } finally {
      await page.close();
    }
    if (target) {
      via = parent;
      break;
    }
  }
  if (!target) return { result: "unreached", reason: `no link to ${pattern} on ${from.join(", ")} on development` };
  const judged = await openAndJudge(ctx, target, step, width, staff);
  return { ...judged, reason: `via ${via}: ${judged.reason}` };
}

const lines = [];
const harnessFaults = [];
const tally = { works: 0, friction: 0, broken: 0, missing: 0, "off-screen": 0, unreached: 0 };

for (const p of plan) {
  const s = p.step;
  const tag = `${s.wf} step ${s.n}`;
  if (p.kind === "fault") {
    harnessFaults.push(`${tag}: ${s.malformed}`);
    continue;
  }
  if (p.kind === "missing") {
    const why = [s.marks.needsCode ? "[NEEDS SQL, A SCRIPT OR A CODE EDIT]" : "", s.marks.noScreen ? "[NO SCREEN]" : ""].filter(Boolean).join(" ");
    lines.push({ tag, who: s.who, width: "-", result: "missing", reason: `the map marks it ${why}` });
    tally.missing += 1;
    continue;
  }
  if (p.kind === "off-screen") {
    lines.push({ tag, who: s.who, width: "-", result: "off-screen", reason: `happens outside this platform's pages: ${s.screen.replace(/`/g, "").slice(0, 80)}` });
    tally["off-screen"] += 1;
    continue;
  }
  for (const width of WIDTHS) {
    const parts = [];
    try {
      for (const { route, who } of p.routes) {
        const ctx = await contextFor(who, width);
        const staff = route.startsWith("/portal");
        const judged = route.includes("[")
          ? await reachDynamic(ctx, route, s, width, staff)
          : await openAndJudge(ctx, route, s, width, staff);
        parts.push({ who, ...judged });
      }
    } catch (err) {
      if (navigationVerdict(err).unreachable) {
        await teardown();
        console.log("");
        console.log(`  COULD NOT TELL: the server at ${BASE} went away during ${tag} (${navigationVerdict(err).reason}).`);
        process.exit(COULD_NOT_TELL);
      }
      harnessFaults.push(`${tag} at ${width}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      continue;
    }
    const reached = parts.filter((x) => x.result !== "unreached");
    let result;
    if (!reached.length) result = "unreached";
    else result = reached.reduce((a, b) => (rank[b.result] > rank[a.result] ? b : a)).result;
    const who = [...new Set(parts.map((x) => x.who))].join(", ");
    lines.push({ tag, who, width: String(width), result, reason: parts.map((x) => x.reason).join(" | ") });
    tally[result] += 1;
  }
}

for (const ctx of Object.values(contexts)) await ctx.close().catch(() => {});
if (browser) await browser.close();

// ------------------------------------------------------------------ the findings
console.log("");
console.log("  W2 RESULT: workflow step | role | width | result | reason");
for (const l of lines) console.log(`  W2 RESULT: ${l.tag} | ${l.who.replace(/`/g, "")} | ${l.width} | ${l.result} | ${l.reason}`);
console.log("");
console.log(
  `  NOTE: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}. Each walked step is one line per width; nothing was submitted.`,
);

const walkedSteps = new Set(lines.map((l) => l.tag));
rec(
  "every step the map names was walked and given a result",
  walkedSteps.size === steps.length && harnessFaults.length === 0,
  harnessFaults.length ? `${harnessFaults.length} could not be walked: ${harnessFaults.slice(0, 4).join("; ")}` : `${walkedSteps.size} of ${steps.length}`,
);

// ------------------------------------------------------------------ teardown, read back
{
  const t = await teardown();
  const left = (t.staff.left ?? 0) + (t.partners.left ?? 0) + (t.customers.left ?? 0);
  rec(
    "the probe accounts were removed",
    t.staff.ok && t.partners.ok && t.customers.ok && left === 0,
    `staff ${t.staff.left ?? "?"} left, partners ${t.partners.left ?? "?"} left, customers ${t.customers.left ?? "?"} left`,
  );
}

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok).length;
console.log("");
if (failed) {
  console.log(`FAIL: ${failed} of ${out.length} checks.`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${out.length} checks. Every workflow step was walked as its role and given a result.`);
}
