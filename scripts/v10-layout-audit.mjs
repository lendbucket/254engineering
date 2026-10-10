// @runtime react-server
/**
 * DESIGN V10'S LAYOUT RULES, MEASURED ON THE RENDERED PAGE.
 *
 *   npx tsx scripts/v10-layout-audit.mjs                        against the suite's server
 *   BASE_URL=http://localhost:4300 npx tsx scripts/v10-layout-audit.mjs
 *   V10_ONLY=/portal/profile npx tsx scripts/v10-layout-audit.mjs   one route, list ignored
 *
 * Operator rulings 2 and 3 of 2026-10-07. Token compliance does not prove a
 * screen matches V10: the staff portal passed token-audit for weeks while every
 * screen was cards. DESIGN_V10.md layout rule 1: "No boxes. ... No cards, no
 * shadows, no rounded panels"; rule 5: "Buttons are square (2px radius)"; type:
 * "No monospace anywhere". So this asks the BROWSER, at 1280 and at 390, for
 * every visible element on every signed in route:
 *
 *   radius     a corner rounder than 2px, except a true circle (a timeline dot,
 *              an avatar, a radio) and a native radio or checkbox
 *   shadow     any box-shadow at all
 *   monospace  any element with its own text in a monospace face
 *   box        a four-sided border around content on anything that is not a
 *              form control, a button, or a key cap
 *
 * THE DATED LIST. Every route must pass except those on NOT_YET_V10, and an entry
 * may stay there only until 2026-10-19; from 2026-10-20 any entry fails. The list
 * may only SHRINK: an entry not on the frozen original fails, and a listed route
 * that now passes fails too, naming itself, so a restyled screen comes off the
 * list in the commit that restyles it. That is what makes "only shrinks"
 * mechanical rather than a promise.
 *
 * ROUTES WITH AN ID IN THE PATH, operator ruling of 2026-10-07. routesOf skips
 * every [segment] directory, so this audit finds them itself and resolves each
 * to a real id. A dynamic route it has no resolver for FAILS rather than being
 * skipped, so a new [id] screen cannot fall outside it by being new. Three need
 * a record owned by the signed-in probe that no probe helper creates yet; they
 * are named in UNRESOLVED_UNTIL with the same date, counted and printed, and an
 * interim decision of the overnight run records why (rulings-2026-10-06.md
 * section 9).
 */
import { chromium } from "playwright";
import { allPages, SURFACES } from "./lib/surfaces.mjs";
import { AUDIT_BASE_URL } from "./lib/ports.mjs";
import { navigationVerdict, orCouldNotTell, sayCouldNotTell } from "./lib/reachable.mjs";
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
  attachPartnerUser,
  attachCustomerUser,
  detachSeedUsers,
} from "./lib/portal-probe.mjs";
import { auditClient } from "./lib/db-target.mjs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? AUDIT_BASE_URL;
const ONLY = process.env.V10_ONLY ?? null;
/*
 * V10_REPORT=1 measures every route and prints which fail, ignoring the list.
 * It is how ORIGINAL_NOT_YET_V10 was derived (from a measurement of the code
 * before any restyle, never from a guess), and it never passes or fails a board:
 * it exits zero and says it is a report.
 */
const REPORT = process.env.V10_REPORT === "1";
const LIST_EXPIRES = "2026-10-19";
const TODAY = new Date().toISOString().slice(0, 10);

/*
 * NOT YET V10. FROZEN ORIGINAL: exactly the 64 routes that failed when this
 * check, in report mode, measured the code BEFORE any restyle (commit a5786f4,
 * 2026-10-08), not a guess. /account/orders and /account/statements already
 * passed and were never on it. This array may never gain an entry.
 */
const ORIGINAL_NOT_YET_V10 = [
  "/account", "/account/forgot-password", "/account/login", "/account/order", "/account/set-password",
  "/account/settings", "/account/sign-up", "/order/254-B2026-000000", "/order/start/[slug]",
  "/order/start/roof-inspections", "/partner", "/partner/agreement", "/partner/login", "/partner/materials",
  "/partner/referrals", "/partner/set-password", "/partner/statements", "/portal", "/portal/accounts",
  "/portal/accounts/[id]/pricing", "/portal/applications", "/portal/audit", "/portal/billing",
  "/portal/certification", "/portal/charge-log", "/portal/clients", "/portal/deletion-requests",
  "/portal/documents", "/portal/documents/binder/[fileId]", "/portal/files", "/portal/files/dispatch",
  "/portal/inquiries", "/portal/intake", "/portal/jobs", "/portal/jobs/[id]", "/portal/launch", "/portal/login",
  "/portal/messages", "/portal/mfa", "/portal/mfa/enrol", "/portal/onboarding", "/portal/orders",
  "/portal/partners", "/portal/partners/[id]", "/portal/partners/disputes", "/portal/pay", "/portal/people",
  "/portal/pricebook", "/portal/profile", "/portal/profile/seal", "/portal/protocols",
  "/portal/protocols/rc-001", "/portal/queue", "/portal/reports", "/portal/review", "/portal/roles",
  "/portal/set-password", "/portal/status", "/portal/suppressions", "/portal/tasks", "/portal/techs",
  "/portal/techs/[id]", "/portal/waiting", "/portal/windstorm-inquiries",
];
/*
 * WHAT IS STILL ON IT. A route comes off in the commit that makes it pass, and
 * this check fails a listed route that passes, so the list cannot lag. Set from
 * the measurement taken with the commit that last changed it.
 */
/*
 * Measured 2026-10-08 after the shell, the shared pieces, the engineer screens
 * and the sign in screens went to V10: 28 routes pass, these 38 do not. Off the
 * original since then: the engineer's review, protocols and RC-001, profile and
 * seal upload, waiting, certification, his jobs, the two-step pages, sign in and
 * set password, the technician's credentials page, and eleven screens the shared
 * pieces alone brought into line. 2026-10-08: tasks, restyled, and 37 remain.
 */
const STILL_NOT_YET_V10 = [

];
const NOT_YET_V10 = STILL_NOT_YET_V10 ?? [...ORIGINAL_NOT_YET_V10];

/*
 * Dynamic routes whose screen needs a record OWNED by the signed-in probe, which
 * no probe helper makes yet. EMPTY since 2026-10-09: the audit seed
 * (scripts/seed-audit-world.mjs) holds a partner statement and a customer bulk
 * order, and a reader attached to each owner opens them. The object stays, so a
 * route that loses its resolver is named rather than silently skipped.
 */
const UNRESOLVED_UNTIL = {};

/*
 * THE SEEDED RECORDS. Read rather than typed, so a re-seed with a new reference
 * needs no edit here. A missing seed is a FAIL naming the script to run, never
 * a skip: the two routes it serves have no other way to be measured.
 */
const SEED_PARTNER_EMAIL = "seed-partner@audit-probe.invalid";
const SEED_BATCH = "254-B2026-DEMO01";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const unmeasured = [];

console.log("");
console.log("================ DESIGN V10, MEASURED ON THE PAGE ================");

// ------------------------------------------------------------------ the routes
const IN_SCOPE = new Set(["portal", "account", "order", "partner"]);
const pages = allPages().filter((p) => IN_SCOPE.has(p.surface));
const surfaceByKey = new Map(SURFACES.map((s) => [s.key, s]));

/** Every [segment] page under a measured surface, as a route pattern. */
function dynamicRoutes() {
  const found = [];
  for (const s of SURFACES.filter((x) => IN_SCOPE.has(x.key))) {
    for (const dir of [...(s.dirs ?? []), ...(s.publicDirs ?? [])]) {
      const walk = (d, prefix) => {
        let entries = [];
        try {
          entries = readdirSync(d);
        } catch {
          return;
        }
        for (const e of entries) {
          const full = join(d, e);
          if (!statSync(full).isDirectory()) continue;
          const segment = e.startsWith("(") ? "" : `/${e}`;
          const here = `${prefix}${segment}`;
          try {
            if (statSync(join(full, "page.tsx")).isFile() && here.includes("[")) found.push({ surface: s.key, pattern: here });
          } catch {}
          walk(full, here);
        }
      };
      walk(dir, s.prefix);
    }
  }
  return found;
}
const dynamic = dynamicRoutes();
rec("the dynamic routes are found on disk, not listed by hand", dynamic.length > 0, `${dynamic.length}: ${dynamic.map((d) => d.pattern).join(", ")}`);

// ------------------------------------------------------------------ sessions
const sessions = {};
const db = auditClient("v10-layout-audit", { neverProduction: true });
await orCouldNotTell(
  async () => {
    for (const role of ["admin", "engineer", "field_tech", "customer_service"]) {
      sessions[role] = await createProbe(BASE, role, "v10-layout");
    }
    sessions.partner = await createPartnerProbe(BASE, "v10-layout");
    sessions.customer = await createCustomerProbe(BASE, "v10-layout");
  },
  `the server at ${BASE}`,
  async () => {
    await destroyProbes("v10-layout");
    await destroyPartnerProbes("v10-layout");
    await destroyCustomerProbes("v10-layout");
    await detachSeedUsers("v10-layout");
  },
);

/* The seeded owners, and a reader attached to each. */
const seed = { statement: null, batch: null };
if (db) {
  const { data: sp } = await db.from("eng_partners").select("id").eq("contact_email", SEED_PARTNER_EMAIL).maybeSingle();
  if (sp) {
    const { data: st } = await db
      .from("eng_partner_statements")
      .select("reference, status")
      .eq("partner_id", sp.id)
      .in("status", ["issued", "paid"])
      .limit(1);
    if (st?.[0]) {
      seed.statement = st[0].reference;
      sessions.seedPartner = await attachPartnerUser(BASE, "v10-layout", sp.id);
    }
  }
  const { data: sb } = await db.from("eng_order_batches").select("reference, account_id").eq("reference", SEED_BATCH).maybeSingle();
  if (sb?.account_id) {
    seed.batch = sb.reference;
    sessions.seedCustomer = await attachCustomerUser(BASE, "v10-layout", sb.account_id);
  }
}
rec(
  "the audit seed is present (a partner statement and a customer bulk order)",
  Boolean(seed.statement && seed.batch),
  seed.statement && seed.batch
    ? `${seed.statement}, ${seed.batch}`
    : "run: npx tsx --conditions=react-server scripts/seed-audit-world.mjs",
);
for (const k of Object.keys(sessions)) rec(`a ${k} session was created`, Boolean(sessions[k]?.cookie), sessions[k]?.fault ?? "");

/** A real id for each dynamic route, from development records or a probe. Null when it cannot. */
async function resolve(pattern) {
  if (UNRESOLVED_UNTIL[pattern]) return null;
  if (!db) return null;
  if (pattern === "/portal/techs/[id]") return sessions.field_tech?.id ? pattern.replace("[id]", sessions.field_tech.id) : null;
  if (pattern === "/portal/partners/[id]") return sessions.partner?.partnerId ? pattern.replace("[id]", sessions.partner.partnerId) : null;
  if (pattern === "/order/start/[slug]") return "/order/start/roof-inspections";
  /* A partner's order page (run item 16), by the development seed's demo partner. */
  if (pattern === "/order/referred/[code]") return "/order/referred/demo-title";
  /* The two the audit seed serves, opened by the reader attached to each owner. */
  if (pattern === "/partner/statements/[reference]") {
    return seed.statement && sessions.seedPartner?.cookie ? `/partner/statements/${seed.statement}` : null;
  }
  if (pattern === "/account/orders/[reference]") {
    return seed.batch && sessions.seedCustomer?.cookie ? `/account/orders/${seed.batch}` : null;
  }
  /*
   * The order status page, resolved 2026-10-08. It opens only with a signed
   * link, so the resolver issues one through issueCustomerLink, the product's
   * own issuer, for the newest DEMONSTRATION order, expiring in one day. Each
   * run leaves that one expired access row on development (the table is kept
   * pending counsel); recorded in docs/audit-2026-10/GAPS.md.
   */
  if (pattern === "/order/[reference]") {
    const { data } = await db
      .from("eng_service_orders")
      .select("id, reference")
      .eq("is_demo", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const order = data?.[0];
    if (!order) return null;
    const { issueCustomerLink } = await import("../src/lib/ops-intake.ts");
    const link = await issueCustomerLink({ orderId: order.id }, 1);
    return link ? `/order/${order.reference}?token=${encodeURIComponent(link.token)}` : null;
  }
  if (pattern === "/portal/accounts/[id]/pricing") {
    const id = sessions.customer?.accountId ?? null;
    return id ? `/portal/accounts/${id}/pricing` : null;
  }
  if (pattern === "/portal/jobs/[id]" || pattern === "/portal/documents/binder/[fileId]") {
    const { data } = await db
      .from("eng_files")
      .select("id")
      .in("status", ["delivered", "in_review", "evidence_in_progress", "dispatched"])
      .order("created_at", { ascending: false })
      .limit(1);
    const id = data?.[0]?.id ?? null;
    if (!id) return null;
    return pattern.includes("[fileId]") ? `/portal/documents/binder/${id}` : `/portal/jobs/${id}`;
  }
  return null;
}

/* Which session opens a route: the surface's own principal, or the staff role roleFor names. */
function sessionFor(surfaceKey, path) {
  /* A seeded record is opened by its owner's attached reader, never by the probe, which owns nothing. */
  if (surfaceKey === "partner" && path?.startsWith("/partner/statements/")) return { probe: sessions.seedPartner, cookie: partnerCookieFor };
  if (surfaceKey === "account" && path?.startsWith("/account/orders/")) return { probe: sessions.seedCustomer, cookie: customerCookieFor };
  if (surfaceKey === "partner") return { probe: sessions.partner, cookie: partnerCookieFor };
  if (surfaceKey === "account") return { probe: sessions.customer, cookie: customerCookieFor };
  if (surfaceKey === "order") return { probe: null, cookie: null };
  const page = pages.find((p) => p.path === path);
  const role = page?.role ?? (path.startsWith("/portal/jobs/") ? "engineer" : surfaceByKey.get(surfaceKey)?.defaultRole) ?? "admin";
  return { probe: sessions[role] ?? sessions.admin, cookie: cookieFor };
}

const targets = [];
for (const p of pages) targets.push({ pattern: p.path, path: p.path, surface: p.surface, signedIn: p.session !== "none" });
for (const d of dynamic) {
  const path = await resolve(d.pattern);
  targets.push({ pattern: d.pattern, path, surface: d.surface, signedIn: d.surface !== "order" });
}

// ------------------------------------------------------------------ measure
function measure() {
  const found = [];
  const textOf = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  const controlTags = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION", "BUTTON", "KBD"]);
  const describe = (el) => {
    const t = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${t ? ` "${t}"` : ""}`;
  };
  const buttonLike = (el, cs, r) =>
    el.getAttribute("role") === "button" ||
    (el.tagName === "A" && /inline-flex|inline-block|flex/.test(cs.display) && r.height <= 60);
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    if (textOf(el) && /mono|courier|consolas|menlo/i.test(cs.fontFamily)) found.push({ kind: "monospace", at: describe(el) });
    if (cs.boxShadow && cs.boxShadow !== "none") found.push({ kind: "shadow", at: describe(el) });

    const radius = Math.max(
      parseFloat(cs.borderTopLeftRadius) || 0,
      parseFloat(cs.borderTopRightRadius) || 0,
      parseFloat(cs.borderBottomLeftRadius) || 0,
      parseFloat(cs.borderBottomRightRadius) || 0,
    );
    const circle = Math.abs(r.width - r.height) <= 2 && radius >= r.width / 2 - 1;
    const nativeToggle = el.tagName === "INPUT" && /radio|checkbox/.test(el.type);
    if (radius > 2 && !circle && !nativeToggle) found.push({ kind: "radius", at: `${describe(el)} ${Math.round(radius)}px` });

    const sides = ["Top", "Right", "Bottom", "Left"];
    const allFour = sides.every(
      (s) => (parseFloat(cs[`border${s}Width`]) || 0) > 0 && cs[`border${s}Style`] !== "none" && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(cs[`border${s}Color`]),
    );
    if (allFour && !controlTags.has(el.tagName) && !buttonLike(el, cs, r) && r.width > 48 && r.height > 24 && el.innerText.trim()) {
      found.push({ kind: "box", at: describe(el) });
    }
  }

  /*
   * NO TINTED GROUND INSIDE MAIN, operator ruling 3 on the 11:10 report of
   * 2026-10-08, closing the gap the box rule left: a box is found by its four
   * borders, so a tinted block with no border passed. Inside main, any
   * background other than transparent, white or the phone ground is a finding,
   * unless the element is a button, an input or a link drawn as a button.
   * Applied as ruled, with no further exemption: V10 names a grey selected row
   * fill, and if one appears it is reported to the operator rather than excused
   * here.
   */
  const ALLOWED_GROUNDS = new Set(["rgb(255, 255, 255)", "rgb(242, 244, 247)"]);
  const mainEl = document.querySelector("main");
  if (mainEl) {
    for (const el of mainEl.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const bg = cs.backgroundColor;
      if (!bg || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg) || ALLOWED_GROUNDS.has(bg)) continue;
      /* Exactly the ruling's exemption: a button or an input. Not the box rule's
       * wider control set, which also excuses a key cap. */
      if (["BUTTON", "INPUT", "SELECT", "TEXTAREA", "OPTION"].includes(el.tagName) || buttonLike(el, cs, r)) continue;
      /*
       * THE ONE EXCEPTION: A MAP. Operator ruling of 2026-10-09, recorded in
       * DESIGN_V10.md. Colour is permitted on swatches and map features inside
       * an element marked data-v10-map, never on text and never as a background
       * behind content. So the element must sit inside the marked map AND hold
       * no text and no children: a swatch. A coloured label, or a coloured box
       * with anything in it, is still a finding, map or not. Counted, so an
       * exception that excuses nothing is visible.
       */
      if (el.closest("[data-v10-map]") && el.children.length === 0 && !(el.textContent ?? "").trim()) {
        found.push({ kind: "_mapswatch" });
        continue;
      }
      found.push({ kind: "tint", at: `${describe(el)} ${bg}` });
    }
  }

  /*
   * TABLE HEADERS MUST NOT TOUCH, at desktop width. Operator ruling of
   * 2026-10-09, after "MARGIN" and "COVERAGE" rendered as "MARGINCOVERAGE" on
   * the dashboard. For every table, the TEXT of each header cell is measured
   * (a range over its contents, not the cell, whose box always abuts the next)
   * and two neighbours closer than 8px are a finding naming both.
   */
  if (window.innerWidth >= 1200) {
    for (const row of document.querySelectorAll("thead tr")) {
      const heads = [...row.children].filter((th) => {
        const s = getComputedStyle(th);
        return s.display !== "none" && (th.textContent ?? "").trim();
      });
      for (let i = 1; i < heads.length; i++) {
        const a = document.createRange();
        a.selectNodeContents(heads[i - 1]);
        const b = document.createRange();
        b.selectNodeContents(heads[i]);
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        if (ra.width === 0 || rb.width === 0) continue;
        const gap = rb.left - ra.right;
        if (gap < 8) {
          found.push({ kind: "header-touch", at: `"${heads[i - 1].textContent.trim()}" and "${heads[i].textContent.trim()}" ${Math.round(gap)}px apart` });
        }
      }
      found.push({ kind: "_headerpairs", n: Math.max(0, heads.length - 1) });
    }
  }

  /*
   * THE ACTIVE NAV ITEM, operator ruling 4 of 2026-10-08: "gold marker only, no
   * grey ground, no radius", in all four portals. Every visible
   * nav a[aria-current="page"] is read: a fill is a finding, a corner is a
   * finding, and no gold border on any side is a finding. Each one seen is also
   * COUNTED, as a "_navseen" entry the runner tallies by portal, so a check that
   * found no active item anywhere cannot pass over nothing.
   */
  const GOLD = "rgb(214, 166, 42)";
  for (const a of document.querySelectorAll('nav a[aria-current="page"]')) {
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    if (cs.display === "none" || cs.visibility === "hidden" || r.width < 1 || r.height < 1) continue;
    found.push({ kind: "_navseen", at: describe(a) });
    const bg = cs.backgroundColor;
    if (bg && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg)) found.push({ kind: "nav-fill", at: `${describe(a)} ${bg}` });
    const radius = Math.max(...["TopLeft", "TopRight", "BottomLeft", "BottomRight"].map((c) => parseFloat(cs[`border${c}Radius`]) || 0));
    if (radius > 0) found.push({ kind: "nav-radius", at: `${describe(a)} ${radius}px` });
    const marked = ["Top", "Right", "Bottom", "Left"].some(
      (s) => (parseFloat(cs[`border${s}Width`]) || 0) >= 2 && cs[`border${s}Style`] !== "none" && cs[`border${s}Color`] === GOLD,
    );
    if (!marked) found.push({ kind: "nav-marker", at: `${describe(a)}: no gold marker` });
  }
  return found;
}

const browser = targets.length && Object.values(sessions).some((s) => s?.cookie) ? await chromium.launch() : null;
const results = [];
/** Active nav items measured, by portal: admin, engineer, field_tech, partner. */
const navSeen = {};
/** Swatches the map exception excused, by route; and header pairs measured. */
const mapSwatches = {};
let headerPairs = 0;
/** V10's phone-ground, and the surfaces held to it (see the check below). */
const PHONE_GROUND = "rgb(242, 244, 247)";
/* The partner surface joined on 2026-10-09 with the partner batch, which put its shell and sign in screens on the ground. */
const PHONE_GROUND_SURFACES = new Set(["portal", "account", "partner"]);
/**
 * Screens V10 specifies as a single section on a phone. Empty: nothing has been
 * named. An entry is a pattern and a reason, and the run prints the count, so
 * this cannot grow quietly.
 */
const PHONE_SINGLE_SECTION = new Map();
for (const t of targets) {
  if (ONLY && t.pattern !== ONLY) continue;
  if (!t.path) {
    results.push({ ...t, resolved: false });
    continue;
  }
  const kinds = {};
  let loaded = true;
  for (const width of [1280, 390]) {
    if (!browser) {
      loaded = false;
      break;
    }
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
    if (t.signedIn) {
      const s = sessionFor(t.surface, t.pattern);
      if (s.probe?.cookie && s.cookie) await ctx.addCookies(s.cookie(s.probe, BASE));
    }
    const page = await ctx.newPage();
    try {
      const res = await page.goto(BASE + t.path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(500);
      if (!res || res.status() >= 400) {
        loaded = false;
        unmeasured.push(`${t.path} at ${width}: HTTP ${res?.status() ?? "none"}`);
      } else {
        for (const f of await page.evaluate(measure)) {
          if (f.kind === "_navseen") {
            const s = t.signedIn ? sessionFor(t.surface, t.pattern) : null;
            const portal = t.surface === "partner" ? "partner" : t.surface === "portal" ? (s?.probe?.role ?? "unknown") : t.surface;
            navSeen[portal] = (navSeen[portal] ?? 0) + 1;
            continue;
          }
          if (f.kind === "_mapswatch") {
            mapSwatches[t.pattern] = (mapSwatches[t.pattern] ?? 0) + 1;
            continue;
          }
          if (f.kind === "_headerpairs") {
            headerPairs += f.n;
            continue;
          }
          kinds[f.kind] = kinds[f.kind] ?? [];
          if (kinds[f.kind].length < 3) kinds[f.kind].push(`${f.at} at ${width}`);
          kinds[f.kind].count = (kinds[f.kind].count ?? 0) + 1;
        }
        /*
         * V10'S PHONE GROUND, AS SECTIONS ON IT. Operator rulings of 2026-10-08:
         * every portal and account page on a phone, sign in and auth screens
         * included, shows separate white sections with #F2F4F7 visible between
         * them, "as on /portal/tasks. Not one white main filling the screen."
         * This REPLACES the first version, which read the colour behind main
         * and so passed a page that was one white slab on a grey ground.
         *
         * At 390: a white section is an element with an opaque white
         * background at least 90% of the screen wide; nested ones are one
         * section. Two consecutive sections are SEPARATED when 8px or more lies
         * between them and the ground there, the first opaque background
         * behind them, is #F2F4F7. A page passes with at least one separation,
         * that is two or more sections, or when V10 specifies it as a single
         * section screen (PHONE_SINGLE_SECTION, counted, empty today). The
         * partner surface joins in the partner batch.
         */
        /*
         * NO SIDEWAYS SCROLL AT 390, on every page this measures. Operator
         * ruling of 2026-10-08, with the email and short code wrapping rules.
         * The document, and the portal's own scrolling region where there is
         * one, must be no wider than the screen. mobile-audit and
         * mobile-overflow-audit ask the same of their route lists; this holds
         * every route V10 measures to it, dynamic ones included.
         */
        if (width === 390) {
          const over = await page.evaluate(() => {
            const out = [];
            const doc = document.scrollingElement ?? document.documentElement;
            if (doc.scrollWidth > doc.clientWidth + 1) out.push(`document ${doc.scrollWidth}px in ${doc.clientWidth}px`);
            for (const el of document.querySelectorAll("[data-portal-scroll]")) {
              if (el.scrollWidth > el.clientWidth + 1) out.push(`scroll region ${el.scrollWidth}px in ${el.clientWidth}px`);
            }
            return out;
          });
          for (const o of over) {
            kinds.overflow = kinds.overflow ?? [];
            if (kinds.overflow.length < 3) kinds.overflow.push(`${o} at 390`);
            kinds.overflow.count = (kinds.overflow.count ?? 0) + 1;
          }
        }
        if (width === 390 && PHONE_GROUND_SURFACES.has(t.surface) && !PHONE_SINGLE_SECTION.has(t.pattern)) {
          const verdict = await page.evaluate((GROUND) => {
            const WHITE = "rgb(255, 255, 255)";
            const opaque = (c) => c && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(c);
            const vw = document.documentElement.clientWidth;
            const visible = (el) => {
              const cs = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              return cs.display !== "none" && cs.visibility !== "hidden" && r.height > 0;
            };
            const whites = [...document.querySelectorAll("body *")].filter(
              (el) => visible(el) && getComputedStyle(el).backgroundColor === WHITE && el.getBoundingClientRect().width >= vw * 0.9,
            );
            /* Outermost only: a white section inside a white section is the same section. */
            const outer = whites.filter((el) => !whites.some((o) => o !== el && o.contains(el)));
            const box = (el) => {
              const r = el.getBoundingClientRect();
              return { el, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
            };
            const sections = outer.map(box).sort((a, b) => a.top - b.top);
            const groundBehind = (el) => {
              let p = el.parentElement;
              while (p && !opaque(getComputedStyle(p).backgroundColor)) p = p.parentElement;
              return p ? getComputedStyle(p).backgroundColor : "nothing opaque";
            };
            let separated = 0;
            const seen = new Set();
            for (let i = 1; i < sections.length; i++) {
              const gap = sections[i].top - sections[i - 1].bottom;
              const ground = groundBehind(sections[i].el);
              seen.add(ground);
              if (gap >= 8 && ground === GROUND) separated += 1;
            }
            return { sections: sections.length, separated, grounds: [...seen].join(" ") };
          }, PHONE_GROUND);
          if (verdict.separated < 1) {
            kinds["phone-ground"] = kinds["phone-ground"] ?? [];
            kinds["phone-ground"].push(
              `${verdict.sections} white section(s), ${verdict.separated} separated by #F2F4F7 (ground seen: ${verdict.grounds || "none"}) at 390`,
            );
            kinds["phone-ground"].count = (kinds["phone-ground"].count ?? 0) + 1;
          }
        }
      }
    } catch (err) {
      loaded = false;
      unmeasured.push(`${t.path} at ${width}: ${navigationVerdict(err).reason}`);
    }
    await ctx.close();
  }
  results.push({ ...t, resolved: true, loaded, kinds });
}
if (browser) await browser.close();

// ------------------------------------------------------------------ verdicts
const listed = new Set(NOT_YET_V10);
const expired = TODAY > LIST_EXPIRES;
rec("the not-yet list only shrinks: every entry is on the frozen original", NOT_YET_V10.every((r) => ORIGINAL_NOT_YET_V10.includes(r)),
  NOT_YET_V10.filter((r) => !ORIGINAL_NOT_YET_V10.includes(r)).join(", ") || `${NOT_YET_V10.length} of ${ORIGINAL_NOT_YET_V10.length} still listed`);
rec(`and nothing is on it after ${LIST_EXPIRES}`, !expired || NOT_YET_V10.length === 0, expired ? `${NOT_YET_V10.length} route(s) still listed on ${TODAY}` : `until ${LIST_EXPIRES}`);

/*
 * AND THE NAV RULE HAD SOMETHING TO MEASURE IN EVERY PORTAL. A selector that
 * matched nothing, or a shell that stopped marking its current page, would
 * otherwise leave nav-fill, nav-radius and nav-marker silent everywhere. Not
 * asked in ONLY mode, which measures one route.
 */
if (!ONLY && browser) {
  const PORTALS = ["admin", "engineer", "field_tech", "partner"];
  const missing = PORTALS.filter((p) => !navSeen[p]);
  rec(
    "the active nav item was measured in all four portals",
    missing.length === 0,
    missing.length ? `none seen for: ${missing.join(", ")}` : PORTALS.map((p) => `${p} ${navSeen[p]}`).join(", "),
  );
  /*
   * THE MAP EXCEPTION EXCUSES SWATCHES ON THE MAP'S OWN SCREEN, AND NOWHERE
   * ELSE. Operator ruling of 2026-10-09. Counted per route: an exception that
   * excused nothing would mean the marked element vanished, and one excusing
   * swatches on a screen with no map would mean the marker spread.
   */
  const MAP_SCREENS = ["/portal/techs"];
  const where = Object.keys(mapSwatches);
  rec(
    "the map exception excuses swatches on the map's own screen and nowhere else",
    MAP_SCREENS.every((p) => mapSwatches[p] > 0) && where.every((p) => MAP_SCREENS.includes(p)),
    where.length ? where.map((p) => `${p} ${mapSwatches[p]}`).join(", ") : "none excused anywhere",
  );
  rec(
    "and table headers were measured for touching (a check over no tables passes forever)",
    headerPairs > 0,
    `${headerPairs} neighbouring header pair(s) measured at 1280`,
  );
}
rec(
  "screens excused the phone sections rule as single-section are named, and none is",
  PHONE_SINGLE_SECTION.size === 0,
  PHONE_SINGLE_SECTION.size ? [...PHONE_SINGLE_SECTION].map(([p, why]) => `${p}: ${why}`).join("; ") : "0 excused",
);

let clean = 0;
let stillListed = 0;
for (const r of results) {
  if (!r.resolved) {
    const why = UNRESOLVED_UNTIL[r.pattern];
    rec(
      `${r.pattern} is measured`,
      Boolean(why) && !expired,
      why ? `NOT RESOLVED until ${LIST_EXPIRES}: needs ${why}` : "a dynamic route with no resolver; add one, a route with an id is not exempt",
    );
    continue;
  }
  if (!r.loaded) continue;
  const broken = Object.entries(r.kinds);
  const detail = broken.map(([k, v]) => `${k} ${v.count}: ${v.join("; ")}`).join(" | ");
  if (ONLY) {
    rec(`${r.pattern} follows V10's layout rules`, broken.length === 0, detail);
    continue;
  }
  if (broken.length === 0) {
    clean += 1;
    rec(`${r.pattern} follows V10's layout rules`, !listed.has(r.pattern), listed.has(r.pattern) ? "it passes: take it off NOT_YET_V10 in this commit" : "");
  } else if (listed.has(r.pattern) && !expired) {
    stillListed += 1;
  } else {
    rec(`${r.pattern} follows V10's layout rules`, false, detail);
  }
}

if (REPORT) {
  console.log("");
  const failing = [];
  for (const r of results) {
    if (!r.resolved) {
      console.log(`  UNRESOLVED ${r.pattern}`);
      continue;
    }
    if (!r.loaded) {
      console.log(`  NOT LOADED ${r.pattern}`);
      continue;
    }
    const broken = Object.entries(r.kinds);
    if (broken.length) failing.push(r.pattern);
    console.log(`  ${broken.length ? "FAILS" : "PASSES"} ${r.pattern}${broken.length ? `  | ${broken.map(([k, v]) => `${k} ${v.count}`).join(", ")}` : ""}`);
  }
  console.log("");
  console.log(`V10_FAILING_ROUTES ${JSON.stringify(failing.sort())}`);
  sayCouldNotTell(unmeasured, "these routes");
  await destroyProbes("v10-layout");
  await destroyPartnerProbes("v10-layout");
  await destroyCustomerProbes("v10-layout");
  const detached = await detachSeedUsers("v10-layout");
  if (!detached.ok) console.log(`  SEED READERS NOT REMOVED: ${detached.left} left; ${detached.note}`);
  console.log("REPORT ONLY: nothing passed or failed.");
  process.exit(0);
}

console.log("");
/*
 * THE SEED READERS GO BEFORE THE VERDICT IS PRINTED, so a reader left able to
 * sign in to a seeded owner is a red here rather than a credential nobody saw.
 */
{
  const detached = await detachSeedUsers("v10-layout");
  rec("the readers attached to the seeded owners are removed", detached.ok, `${detached.left} left; ${detached.note}`);
}
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
if (!ONLY) {
  console.log("");
  console.log(`  NOTE: ${clean} route(s) follow V10; ${stillListed} still on the dated not-yet list until ${LIST_EXPIRES}.`);
}
sayCouldNotTell(unmeasured, "these routes");

await destroyProbes("v10-layout");
await destroyPartnerProbes("v10-layout");
await destroyCustomerProbes("v10-layout");

const failed = out.filter((r) => !r.ok).length;
console.log("");
if (failed) {
  console.log(`FAIL: ${failed} of ${out.length} checks.`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${out.length} checks. Every route measured follows V10's layout rules or is on the dated list.`);
}
