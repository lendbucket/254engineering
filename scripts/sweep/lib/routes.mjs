/**
 * EVERY ROUTE THE SWEEP VISITS, DERIVED FROM THE DECLARED INVENTORY.
 *
 * Operator ruling, 2026-09-30: routes come from the declaration, not a typed
 * list, and the sweep's first finding is a count of routes on disk against
 * routes the inventory declares.
 *
 * WHY THAT IS THE FIRST ROW RATHER THAN A FOOTNOTE. `scripts/lib/surfaces.mjs`
 * is what every browser audit derives its subject from, so a page that belongs
 * to no declared surface is invisible to the whole board. The partner portal
 * shipped that way once and reached two audits out of eight: measured for
 * contrast by nothing, for tap targets by nothing, for overflow by nothing.
 * A sweep that inherited the same blind spot would report a clean bill over the
 * same hole, so it counts the gap before it loads a single page.
 *
 * IT ALSO WALKS src/app ITSELF, which is the half that makes the count mean
 * something. Asking the inventory for its routes and reporting that number is a
 * check on the inventory agreeing with itself.
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

import { surfaces, routesOf, apisOf, sourceDirsOf } from "../../lib/surfaces.mjs";

/**
 * The public site's routes come from its SITEMAP, not from a directory walk.
 *
 * `routesFrom: "sitemap"` on that surface, and `routesOf` returns an empty list
 * for it deliberately: the marketing site's shipped pages are decided by data
 * (which counties have substance, which posts exist), so the sitemap is the
 * authority and a walk would include pages the build excludes.
 *
 * THE FIRST VERSION OF THIS FILE DID NOT KNOW THAT and reported all twenty
 * marketing pages as undeclared, which would have opened the sweep with a false
 * headline against the declaration every other audit depends on. Second time in
 * one function that my comparison, rather than the inventory, was the thing at
 * fault; the first was dynamic routes. Both were two sets that were never the
 * same set.
 */
export async function sitemapRoutes(base) {
  if (!base) return { routes: [], why: "no base URL, so the sitemap could not be fetched" };
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/sitemap.xml`);
    if (!res.ok) return { routes: [], why: `sitemap.xml answered ${res.status}` };
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const routes = locs
      .map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    /*
     * A SITEMAP THAT FAILED TO PARSE YIELDS AN EMPTY LIST, which is exactly the
     * shape that passes a check while measuring nothing. CLAUDE.md records a
     * round that printed "every declared route answers 200 (0 of 0)" for this
     * reason, so the count is returned for the caller to assert rather than
     * trusted.
     */
    return { routes: [...new Set(routes)].sort(), why: `${routes.length} <loc> entries parsed` };
  } catch (e) {
    return { routes: [], why: `the sitemap could not be fetched: ${String(e).slice(0, 80)}` };
  }
}

/** Surfaces whose routes this file can enumerate without a running server. */
export function walkableSurfaces() {
  return surfaces().filter((s) => s.routesFrom !== "sitemap");
}

/**
 * Every directory under src/app that renders a page, as a route path.
 *
 * Route groups in parentheses are stripped, because `(site)` is an organising
 * device rather than a URL segment, and a dynamic segment is kept in its
 * bracketed form so a reader can see it is a pattern rather than a path.
 */
export function routesOnDisk(root = process.cwd()) {
  const appDir = join(root, "src", "app");
  const found = [];
  if (!existsSync(appDir)) return found;

  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        /* A route group contributes no URL segment. */
        const next = /^\(.*\)$/.test(entry) ? segments : [...segments, entry];
        walk(full, next);
      } else if (entry === "page.tsx") {
        found.push("/" + segments.join("/"));
      }
    }
  };
  walk(appDir, []);
  return [...new Set(found)].sort();
}

/**
 * The routes a given directory owns, as URL paths.
 *
 * Used to ask which routes belong to a surface whose directory is a route
 * group, where there is no prefix to match on. The walk is the same one
 * `routesOnDisk` does, pointed at one directory instead of all of them.
 */
export function routesUnder(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  const walk = (at, segments) => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      if (statSync(full).isDirectory()) {
        const next = /^\(.*\)$/.test(entry) ? segments : [...segments, entry];
        walk(full, next);
      } else if (entry === "page.tsx") {
        found.push("/" + segments.join("/"));
      }
    }
  };
  walk(dir, []);
  return [...new Set(found)];
}

/** Every API route on disk, by the same walk. */
export function apisOnDisk(root = process.cwd()) {
  const appDir = join(root, "src", "app");
  const found = [];
  if (!existsSync(appDir)) return found;

  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        const next = /^\(.*\)$/.test(entry) ? segments : [...segments, entry];
        walk(full, next);
      } else if (entry === "route.ts" || entry === "route.tsx") {
        found.push("/" + segments.join("/"));
      }
    }
  };
  walk(appDir, []);
  return [...new Set(found)].sort();
}

/** Every route the inventory declares, with the surface it belongs to. */
export function declaredRoutes(root = process.cwd()) {
  const rows = [];
  for (const surface of surfaces()) {
    let routes = [];
    try {
      routes = routesOf(surface, { root });
    } catch (e) {
      rows.push({ surface: surface.key, route: null, error: String(e).slice(0, 120) });
      continue;
    }
    for (const route of routes) rows.push({ surface: surface.key, route });
  }
  return rows;
}

/** Every API the inventory declares, with its surface. */
export function declaredApis(root = process.cwd()) {
  const rows = [];
  for (const surface of surfaces()) {
    let list = [];
    try {
      list = apisOf(surface, { root });
    } catch {
      continue;
    }
    for (const route of list) rows.push({ surface: surface.key, route });
  }
  return rows;
}

/**
 * The gap, which is the sweep's first finding.
 *
 * A route on disk that no surface claims is the blind spot this exists to
 * measure. The reverse, a declared route with no page, is also reported: it
 * means the inventory names something that cannot be loaded, which is how a
 * probe ends up pointed at nothing.
 */
export function inventoryGap(root = process.cwd()) {
  const disk = routesOnDisk(root);
  const diskApis = apisOnDisk(root);
  const declared = declaredRoutes(root).filter((r) => r.route).map((r) => r.route);
  const declaredApi = declaredApis(root).map((r) => r.route);

  const normalise = (p) => p.replace(/\/+$/, "") || "/";
  const declaredSet = new Set(declared.map(normalise));
  const declaredApiSet = new Set(declaredApi.map(normalise));

  /*
   * DYNAMIC ROUTES ARE COUNTED SEPARATELY, BECAUSE THE INVENTORY SKIPS THEM ON
   * PURPOSE AND COMPARING THE TWO SETS WOULD BE COMPARING TWO DIFFERENT THINGS.
   *
   * `routesOf` has `if (entry.name.startsWith("[")) continue;` in its walk. That
   * is correct: a route with a parameter cannot be visited without supplying
   * one, so a browser audit deriving its subject from the inventory would be
   * fetching `/insights/[slug]` and getting a 404 that means nothing.
   *
   * The first version of this function did not know that and reported 35
   * undeclared routes, of which most were dynamic. It would have opened the
   * sweep with a false headline finding against the one declaration every other
   * audit depends on, which is the worst place to be wrong. It is the matcher
   * lesson in a new costume: not a window too wide, but two sets that were never
   * the same set.
   *
   * So the gap is STATIC routes no surface claims, which is a real blind spot,
   * and dynamic routes are listed as what they are: pages the sweep must supply
   * a parameter for or mark COULD NOT TELL.
   */
  /*
   * THE SITEMAP SURFACE'S DIRECTORIES ARE EXCLUDED FROM THE GAP, because its
   * routes are declared by the sitemap rather than by a walk. Including them
   * reported twenty marketing pages as undeclared when every one of them is
   * published, which is the second way this comparison was wrong about its own
   * subject. The directories are taken from the inventory rather than typed, so
   * a surface that changes how it declares its routes is followed rather than
   * guessed at.
   */
  /*
   * BY WALKING THAT SURFACE'S OWN DIRECTORIES, NOT BY MATCHING A PREFIX.
   *
   * The site surface's directory is `src/app/(site)`, and a route group
   * contributes no URL segment, so every marketing page sits at the root:
   * `/about`, `/contact`, `/`. There is no prefix to match on, and a prefix
   * derivation reduced to the empty string and matched nothing, which would
   * have left the twenty false findings in place while looking like a fix.
   *
   * Third correction to this one function, and all three are the same mistake:
   * comparing two sets that were never the same set. Dynamic routes the
   * inventory skips on purpose, sitemap routes it declares elsewhere, and now a
   * prefix that does not exist. The subject list is the foundation of the whole
   * sweep, which is why it is worth getting wrong three times in private rather
   * than once in the report.
   */
  const sitemapDirs = surfaces()
    .filter((s) => s.routesFrom === "sitemap")
    .flatMap((s) => [...(s.dirs ?? []), ...(s.publicDirs ?? [])]);
  const sitemapOwned = new Set(sitemapDirs.flatMap((d) => routesUnder(join(root, d))));
  const fromSitemapSurface = (p) => sitemapOwned.has(p);

  const isDynamic = (p) => p.includes("[");
  const staticDisk = disk.filter((p) => !isDynamic(p) && !fromSitemapSurface(p));
  const dynamicDisk = disk.filter(isDynamic);
  const staticApis = diskApis.filter((p) => !isDynamic(p));
  const dynamicApis = diskApis.filter(isDynamic);

  return {
    onDisk: disk.length,
    staticOnDisk: staticDisk.length,
    declared: declaredSet.size,
    undeclared: staticDisk.filter((p) => !declaredSet.has(normalise(p))),
    dynamic: dynamicDisk,
    declaredButMissing: [...declaredSet].filter((p) => !disk.map(normalise).includes(p)),
    apisOnDisk: diskApis.length,
    apisDeclared: declaredApiSet.size,
    apisUndeclared: staticApis.filter((p) => !declaredApiSet.has(normalise(p))),
    dynamicApis,
  };
}
