/**
 * THE SURFACES THIS PLATFORM HAS. ONE LIST, DERIVED FROM BY EVERY AUDIT THAT
 * OPENS A BROWSER.
 *
 * WHY THIS EXISTS
 * ---------------
 * Operator ruling, 2026-09-07, after a sweep found the same defect twice in one
 * afternoon and then a third time in a different form.
 *
 * The first form was a measurement that moved: point 1 of the native standard
 * took the scrolling off the document and gave it to an element, and two audits
 * went on measuring the document. Their portal rows were green on a comparison
 * that could not fail.
 *
 * The second form is this one, and it is worse because it is silent in a way no
 * injection into an existing page can find. Every audit carried its OWN
 * hand written list of what to measure. There was no list of what exists. So a
 * surface entered the harness only where somebody remembered, and the partner
 * portal, which shipped in Phase 9 Section 4, reached exactly two audits out of
 * eight. Five signed in pages, two credential forms and four APIs were measured
 * for nothing: not contrast, not tap targets, not overflow, not form behaviour,
 * not the perimeter. The customer account surface, which shipped a phase
 * earlier, was in fewer still.
 *
 * Nobody decided that. It is what happens when the denominator is a memory.
 *
 * WHAT THIS FILE IS, AND WHAT IT IS NOT
 * -------------------------------------
 * It is the declaration: every surface, its prefix, whether opening it needs a
 * session, and which probe makes one. It is not a list of routes. Routes are
 * DERIVED by walking the directories each surface names, because a route list
 * in here would be the same memory problem one level down.
 *
 * `scripts/surface-audit.mjs` is the enforcement. It walks src/app for anything
 * that renders a page or answers a request, asserts every one of them belongs to
 * a declared surface, and asserts that the audits which must derive from this
 * file actually import it. Adding a surface without declaring it fails there,
 * which is the whole point of writing this down.
 *
 * THE CANARY
 * ----------
 * Every consumer calls a function from this file rather than reading the array,
 * and each of those functions refuses to return an empty list. An inventory that
 * quietly matched nothing would turn every audit deriving from it into an audit
 * measuring nothing, which is precisely the failure this file was written to
 * end, arriving through the fix for it.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * How a surface is opened.
 *
 *   none      anybody can reach it
 *   staff     eng_ops cookie, from createProbe(role)
 *   partner   eng_partner cookie, from createPartnerProbe
 *   customer  eng_customer cookie, from createCustomerProbe
 *
 * Three principals, three cookies, three credential stores, and the separation
 * is asserted by accounts-audit. A surface naming the wrong one would be a
 * probe that cannot open it, which fails loudly rather than passing quietly.
 */
export const SESSIONS = ["none", "staff", "partner", "customer"];

export const SURFACES = [
  {
    key: "site",
    label: "the public website",
    prefix: "/",
    /*
     * The only surface whose routes come from the sitemap rather than from a
     * directory walk: it is the one surface that is meant to be indexed, the
     * sitemap is the list search engines act on, and an audit walking the
     * directory instead would measure pages the sitemap deliberately omits.
     */
    routesFrom: "sitemap",
    dirs: ["src/app/(site)"],
    sourceDirs: ["src/app/(site)"],
    session: "none",
    probe: null,
    shell: false,
    indexed: true,
  },
  {
    key: "order",
    label: "the order flow",
    prefix: "/order",
    routesFrom: "declared",
    /*
     * Both routes are dynamic and neither is in the sitemap, so there is nothing
     * to walk and nothing to fetch: a slug and a reference have to come from
     * somewhere that knows what a real one looks like. order-audit owns the
     * behaviour; what the browser audits need is a page to measure, so the
     * catalog's first slug and a reference shape are declared here and the
     * reference page is expected to render its own "not found" state, which is
     * itself a screen a person sees.
     */
    routes: ["/order/start/roof-inspections", "/order/254-B2026-000000"],
    dirs: ["src/app/(site)/order"],
    sourceDirs: ["src/app/(site)/order", "src/components/order"],
    session: "none",
    probe: null,
    shell: false,
    indexed: false,
  },
  {
    key: "portal",
    label: "the staff portal",
    prefix: "/portal",
    routesFrom: "walk",
    dirs: ["src/app/portal/(app)"],
    publicDirs: ["src/app/portal/(public)"],
    /*
     * The whole prefix, not the route groups: layout.tsx sits above both of
     * them and is the file the app shell lives in.
     */
    sourceDirs: ["src/app/portal", "src/components/portal"],
    apiDirs: ["src/app/api/portal"],
    componentDirs: ["src/components/portal"],
    session: "staff",
    probe: "createProbe",
    /** The scrolling lives in [data-portal-scroll], not on the document. */
    shell: true,
    indexed: false,
    /*
     * Routes an audit cannot open with the default probe, and why. A route in
     * here is still measured; it is measured with the role named.
     */
    roleFor: {
      "/portal/review": "engineer",
      "/portal/protocols": "engineer",
      "/portal/jobs": "field_tech",
      "/portal/certification": "field_tech",
    },
    defaultRole: "admin",
  },
  {
    key: "partner",
    label: "the partner portal",
    prefix: "/partner",
    routesFrom: "walk",
    dirs: ["src/app/partner/(app)"],
    publicDirs: ["src/app/partner/(public)"],
    sourceDirs: ["src/app/partner", "src/components/partner"],
    apiDirs: ["src/app/api/partner"],
    componentDirs: ["src/components/partner"],
    session: "partner",
    probe: "createPartnerProbe",
    /** Same shell, and deliberately the same data attribute. */
    shell: true,
    indexed: false,
  },
  {
    key: "account",
    label: "the customer account surface",
    prefix: "/account",
    routesFrom: "walk",
    dirs: ["src/app/account"],
    sourceDirs: ["src/app/account"],
    /*
     * No route group here: login and set-password sit beside the signed in
     * pages in one directory, so the public half is named rather than derived.
     */
    publicRoutes: ["/account/login", "/account/set-password"],
    apiDirs: ["src/app/api/account"],
    componentDirs: ["src/components/order"],
    session: "customer",
    probe: "createCustomerProbe",
    shell: false,
    indexed: false,
  },
];

/**
 * Directories under src/app that are not a surface, and why each one is not.
 *
 * Every entry is a claim that nothing here renders a page a person navigates to.
 * surface-audit checks that claim by looking for page.tsx underneath, so an
 * exemption cannot be used to hide a screen.
 */
export const NOT_A_SURFACE = {
  api: "route handlers, covered by each surface's apiDirs and by security-audit",
  "(site)": "the public website's own group, declared as the site surface",
  onboarding: "a token addressed link, measured by onboarding-audit end to end",
  apply: "the careers application flow, measured by the careers module in forms-audit",
};

const nonEmpty = (list, what) => {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(
      `surfaces: ${what} is empty. Every audit deriving from this file would ` +
        `then measure nothing and report green, which is the failure this ` +
        `inventory exists to prevent.`,
    );
  }
  return list;
};

/** Every declared surface. Throws rather than returning nothing. */
export function surfaces() {
  return nonEmpty(SURFACES, "the surface inventory");
}

/** The surfaces matching a predicate, refusing to return an empty set. */
export function surfacesWhere(predicate, what = "a filtered surface list") {
  return nonEmpty(SURFACES.filter(predicate), what);
}

/**
 * Every file a set of surfaces renders, for the audits that read source rather
 * than open a browser.
 *
 * Separate from routesOf on purpose: a route tree is shaped by Next's route
 * groups and a file tree is not, and asking one question with the other's
 * answer is how token-audit briefly stopped checking the portal's own layout.
 */
export function sourceDirsOf(list = SURFACES) {
  return nonEmpty(
    [...new Set(list.flatMap((s) => s.sourceDirs ?? []))],
    "the source directories of the given surfaces",
  );
}

/** Surfaces whose pages a person navigates and an audit can open. */
export function measurableSurfaces() {
  return surfacesWhere((s) => s.routesFrom !== "sitemap", "the measurable surfaces");
}

/** Surfaces that need a session, which is what the perimeter is about. */
export function guardedSurfaces() {
  return surfacesWhere((s) => s.session !== "none", "the guarded surfaces");
}

/** Surfaces built as an app shell, where the scrolling is not the document's. */
export function shellSurfaces() {
  return surfacesWhere((s) => s.shell, "the app shell surfaces");
}

/**
 * The routes a surface actually has, by walking what is on disk.
 *
 * Dynamic segments are skipped, exactly as security-audit's own discovery does,
 * because probing one means inventing an id. A surface with dynamic routes worth
 * measuring declares them in `routes`, where the invented value is visible and
 * arguable rather than buried in a walker.
 */
export function routesOf(surface, { root = process.cwd(), include = "all" } = {}) {
  if (surface.routesFrom === "sitemap") return [];
  if (surface.routesFrom === "declared") return [...(surface.routes ?? [])];

  const found = [];

  const walk = (dir, prefix) => {
    if (!existsSync(dir)) return;
    if (existsSync(join(dir, "page.tsx"))) found.push(prefix || "/");
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("[")) continue;
      if (entry.name === "api") continue;
      const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      walk(join(dir, entry.name), `${prefix}${segment}`);
    }
  };

  if (include === "all" || include === "signed-in") {
    for (const dir of surface.dirs ?? []) walk(join(root, dir), surface.prefix);
  }
  if (include === "all" || include === "public") {
    for (const dir of surface.publicDirs ?? []) walk(join(root, dir), surface.prefix);
    for (const route of surface.publicRoutes ?? []) found.push(route);
  }

  /*
   * A signed in list must not contain the public pages, or an audit measuring
   * "the screens behind the door" would be measuring the sign in screen too and
   * counting it as coverage. The account surface has no route group, so this is
   * where that separation is made.
   */
  const publicRoutes = new Set(surface.publicRoutes ?? []);
  const filtered =
    include === "signed-in" ? found.filter((r) => !publicRoutes.has(r)) : found;

  return [...new Set(filtered)].sort();
}

/** The API paths a surface answers on, walked the same way. */
export function apisOf(surface, { root = process.cwd() } = {}) {
  const found = [];
  const walk = (dir, prefix) => {
    if (!existsSync(dir)) return;
    if (existsSync(join(dir, "route.ts"))) found.push(prefix);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("[")) continue;
      const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      walk(join(dir, entry.name), `${prefix}${segment}`);
    }
  };
  for (const dir of surface.apiDirs ?? []) {
    const prefix = `/${dir.replace(/^src\/app\//, "")}`;
    walk(join(root, dir), prefix);
  }
  return [...new Set(found)].sort();
}

/**
 * Every page an audit could open, as one flat list with the session each needs.
 *
 * This is what contrast, mobile and overflow derive from. The shape carries the
 * probe rather than the cookie, because the probe is the thing an audit has to
 * create and a list that hid that would be a list an audit could not use.
 */
export function allPages({ root = process.cwd() } = {}) {
  const out = [];
  for (const surface of measurableSurfaces()) {
    for (const path of routesOf(surface, { root, include: "signed-in" })) {
      out.push({
        surface: surface.key,
        path,
        session: surface.session,
        probe: surface.probe,
        role: surface.roleFor?.[path] ?? surface.defaultRole ?? null,
        shell: Boolean(surface.shell),
        name: `${surface.key}: ${path.replace(`${surface.prefix}`, "").replace(/^\//, "") || "home"}`,
      });
    }
    for (const path of routesOf(surface, { root, include: "public" })) {
      if (out.some((p) => p.path === path)) continue;
      out.push({
        surface: surface.key,
        path,
        session: "none",
        probe: null,
        role: null,
        shell: false,
        name: `${surface.key}: ${path.replace(`${surface.prefix}`, "").replace(/^\//, "") || "home"}`,
      });
    }
  }
  return nonEmpty(out, "the page list every browser audit derives from");
}
