/**
 * NO ROLE'S MENU OFFERS A SCREEN WHOSE PAGE TELLS THAT ROLE IT IS NOT FOR THEM.
 *
 * Robert, 2026-11-14, item 9 from the every-role walk: the administrator's menu
 * still showed My jobs, which reads as a technician's screen ("Offers waiting
 * on you"), and Your franchise, which told him his account does not belong to
 * a franchisee. His instruction: take both out of the administrator's menu, and
 * add a check that no role's menu offers a screen whose page tells that role it
 * is not for them.
 *
 * The menu and the page answer from one declaration, notFor in
 * src/components/portal/nav.ts. What this proves, from the page source rather
 * than from that declaration:
 *   1. every portal page that tells a reader the screen is not theirs marks it
 *      with data-not-for-reader naming its own route, and decides it by asking
 *      notForReader about that same route, never with a condition of its own;
 *   2. a page whose words turn a reader away ("does not belong to", "is not
 *      yours", "not for you", "a technician's own") carries that mark, so a new
 *      turn-away sentence written by hand cannot skip the menu;
 *   3. for every role in DEFAULT_ROLES, its menu (the layout's own navFor) offers
 *      no marked screen that would turn that role away;
 *   4. by member: the administrator's menu has neither My jobs nor Your
 *      franchise, the dispatcher's has no My jobs, the technician's keeps My
 *      jobs, and a franchisee owner keeps Your franchise.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/no-menu-offers-a-screen-that-turns-its-reader-away.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const { NAV, navFor, notForReader } = await import("../../src/components/portal/nav.ts");
const { DEFAULT_ROLES, actionsFor, may } = await import("../../src/lib/ops-authz.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ROOT = "src/app/portal/(app)";
const pages = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name === "page.tsx") pages.push(p.split("\\").join("/"));
  }
};
walk(ROOT);
const routeOf = (path) =>
  "/portal" + path.slice(ROOT.length).replace(/\/page\.tsx$/, "").replace(/\/\([^)]*\)/g, "");

/* 1 and 2. The pages that turn a reader away, read from their source. */
const TURN_AWAY = [/does not belong to/i, /is not yours/i, /not for you/i, /a technician&apos;s own|a technician's own/i];
const marked = new Map();
for (const path of pages) {
  const src = readFileSync(path, "utf8");
  const route = routeOf(path);
  const marks = [...src.matchAll(/data-not-for-reader="([^"]+)"/g)].map((m) => m[1]);
  const words = TURN_AWAY.filter((re) => re.test(src));
  if (words.length) check(`${route} turns a reader away and carries the mark`, marks.length > 0, words.map(String).join(", "));
  if (!marks.length) continue;
  check(`${route} marks its own route`, marks.every((m) => m === route), marks.join(", "));
  check(
    `and decides it with the menu's own question`,
    new RegExp(`notForReader\\("${route.replace(/\//g, "\\/")}"`).test(src),
    route,
  );
  const item = NAV.find((i) => i.href === route);
  check(`and the menu declares who it is not for`, Boolean(item?.notFor), item ? `notFor ${item.notFor}` : "no menu item");
  marked.set(route, item);
}
check("the sweep found turned-away screens to check", marked.size >= 2, `${marked.size}: ${[...marked.keys()].join(", ")}`);

/* 3. Every role's menu, asked the layout's question. */
const menus = new Map();
for (const role of DEFAULT_ROLES) {
  const actor = { id: "x", role: role.key, status: "active", email: "x@audit-probe.invalid", grants: new Set(actionsFor(role.key)) };
  const allowed = (a) => may(actor, a);
  const menu = navFor(allowed).map((i) => i.href);
  menus.set(role.key, menu);
  const offended = menu.filter((href) => marked.has(href) && notForReader(href, allowed));
  check(`${role.key}'s menu offers no screen that turns it away`, offended.length === 0, offended.join(", ") || `${menu.length} items`);
}

/* 4. By member, so a sweep that reached nobody cannot pass. */
const has = (role, href) => (menus.get(role) ?? []).includes(href);
check("the administrator's menu has no My jobs", menus.has("admin") && !has("admin", "/portal/jobs"));
check("nor Your franchise", menus.has("admin") && !has("admin", "/portal/franchise"));
check("and still has Franchisees, the firm-wide version", has("admin", "/portal/franchisees"));
check("the dispatcher's menu has no My jobs", menus.has("dispatcher") && !has("dispatcher", "/portal/jobs"));
check("the technician's menu keeps My jobs", has("field_tech", "/portal/jobs"));
const owner = DEFAULT_ROLES.find((r) => actionsFor(r.key).includes("franchise.read_own") && !actionsFor(r.key).includes("franchise.manage"));
check("a franchisee owner keeps Your franchise", Boolean(owner) && has(owner.key, "/portal/franchise"), owner?.key ?? "no such role");

console.log(wrong === 0 ? "\nNo role's menu offers a screen that turns it away." : `\n${wrong} check(s) wrong.`);
process.exitCode = wrong === 0 ? 0 : 1;
