// @runtime react-server
/**
 * A SCREEN A ROLE'S GRANTS PUT IN ITS MENU ALWAYS OPENS FOR THAT ROLE.
 *
 * Robert, 2026-11-14, from the after walk screenshots 07-cs-intake-390 and
 * 08-cs-inbox-390: Customer Service read "That page is not here" on New job and
 * Inbox, and its bottom bar had no New. Those were taken on 2026-11-13 at
 * 23:45, before 0130 gave the role files.create, inbox.read, inbox.answer and
 * payments.send_link (committed 2026-11-14 08:03, on development since 14:39).
 * His instruction: every screen and nav item those grants open must open, and a
 * check derived from the grants, so a granted screen can never 404.
 *
 * What it does, for every role in DEFAULT_ROLES:
 *   1. builds the role's actor from its own grants and asks the layout's own
 *      question, navFor((a) => may(actor, a)), for the menu it would draw;
 *   2. for every item in that menu, reads the screen's page.tsx and evaluates
 *      every guard that refuses (`if (...) notFound()` or a redirect away),
 *      against that actor, with the product's own can, holdsLicence and helpers;
 *   3. fails on any guard that would refuse a screen the menu offers.
 *
 * A guard naming something only the request knows (a run id, a script entry)
 * is not about the role and is not evaluated; those are COUNTED and NAMED, and
 * every screen must still have at least one guard that was evaluated, so a
 * screen whose guards all went unread fails rather than passing over nothing.
 *
 * It also asserts Customer Service's bottom bar carries New, and that the four
 * grants 0130 gave it each open the screen they were given for.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-granted-screen-always-opens.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { NAV, navFor, mobileTabsFor } from "../../src/components/portal/nav.ts";
import { DEFAULT_ROLES, can, may, holdsLicence } from "../../src/lib/ops-authz.ts";
import { canLookUpOrders } from "../../src/lib/ops-order-lookup.ts";
import { canSeeBilling } from "../../src/lib/ops-dashboard.ts";
import { mayOpenOnboarding } from "../../src/lib/onboarding-scope.ts";
import { REPORTS } from "../../src/lib/ops-reports.ts";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* The names a role guard may use. Anything else is about the request, not the role. */
const KNOWN = new Set(["actor", "can", "holdsLicence", "canLookUpOrders", "canSeeBilling", "mayOpenOnboarding", "allowed", "length"]);

function pageFor(href) {
  const rel = href.replace(/^\/portal/, "");
  return `src/app/portal/(app)${rel}/page.tsx`;
}

/** Every refusing guard in a page: the condition of `if (COND) notFound()` or of a redirect that is not to sign in. */
function guardsOf(code) {
  const out = [];
  const re = /if \(/g;
  let m;
  while ((m = re.exec(code))) {
    let depth = 1;
    let i = m.index + 4;
    for (; i < code.length && depth > 0; i += 1) {
      if (code[i] === "(") depth += 1;
      else if (code[i] === ")") depth -= 1;
    }
    const cond = code.slice(m.index + 4, i - 1);
    const after = code.slice(i).trimStart();
    const nf = after.startsWith("notFound()");
    const rd = /^redirect\("([^"]+)"\)/.exec(after);
    if (nf || (rd && !rd[1].startsWith("/portal/login"))) out.push(cond);
  }
  return out;
}

const pairs = [];
const unread = [];
const noGuard = [];
const refused = [];

for (const role of DEFAULT_ROLES) {
  const actor = { id: `probe-${role.key}`, role: role.key, status: "active", grants: new Set(role.grants) };
  const menu = navFor((a) => may(actor, a));
  const allowed = REPORTS.filter((r) => can(actor, r.action));
  for (const item of menu) {
    const path = pageFor(item.href);
    if (!existsSync(path)) {
      refused.push(`${role.key} ${item.href}: no page at ${path}`);
      continue;
    }
    const guards = guardsOf(codeOf(readFileSync(path, "utf8")));
    let evaluated = 0;
    for (const cond of guards) {
      /* String contents are grant names, not identifiers, so they are removed before the names are read. */
      const names = [...new Set(cond.replace(/"[^"]*"/g, '""').match(/[A-Za-z_$][\w$]*/g) ?? [])];
      const foreign = names.filter((n) => !KNOWN.has(n));
      if (foreign.length) {
        unread.push(`${item.href}: if (${cond}) [${foreign.join(", ")}]`);
        continue;
      }
      const refuses = new Function(
        "actor", "can", "holdsLicence", "canLookUpOrders", "canSeeBilling", "mayOpenOnboarding", "allowed",
        `return Boolean(${cond});`,
      )(actor, can, holdsLicence, canLookUpOrders, canSeeBilling, mayOpenOnboarding, allowed);
      evaluated += 1;
      pairs.push(`${role.key} ${item.href}`);
      if (refuses) refused.push(`${role.key} is offered ${item.href} (${item.label}) and its guard refuses: if (${cond})`);
    }
    if (evaluated === 0) noGuard.push(`${role.key} ${item.href}`);
  }
}

check(
  `every screen a role's grants put in its menu opens for that role (${pairs.length} role and guard pairs, ${DEFAULT_ROLES.length} roles)`,
  refused.length === 0,
  refused.join("; ") || "no granted screen refuses its role",
);
check("and every offered screen had a guard that was evaluated", noGuard.length === 0, noGuard.join("; ") || "none went unread");
check("and the walk covered something", pairs.length >= 100 && DEFAULT_ROLES.length >= 8, `${pairs.length} pairs`);
const uniqueUnread = [...new Set(unread)];
console.log(`  NOTE: ${uniqueUnread.length} request guard(s) not about the role, not evaluated: ${uniqueUnread.join(" | ")}`);

/* Customer Service, as Robert saw it. */
const cs = DEFAULT_ROLES.find((r) => r.key === "customer_service");
check("Customer Service is a declared role", Boolean(cs));
if (cs) {
  const actor = { id: "probe-cs", role: cs.key, status: "active", grants: new Set(cs.grants) };
  const menu = navFor((a) => may(actor, a));
  const tabs = mobileTabsFor(menu);
  for (const grant of ["files.create", "inbox.read", "inbox.answer", "payments.send_link"]) {
    check(`Customer Service holds ${grant} (0130)`, actor.grants.has(grant));
  }
  check("its menu has New job", menu.some((i) => i.href === "/portal/intake"));
  check("and Inbox", menu.some((i) => i.href === "/portal/inbox"));
  check("its bottom bar has New", tabs.some((t) => t.href === "/portal/intake"), tabs.map((t) => t.short).join(", "));
  check(
    "and none of those screens refuses it",
    !refused.some((r) => r.startsWith("customer_service ")),
  );
}

/* The four grants hold a real screen each: send_link and inbox.answer act on screens files.create and inbox.read open. */
const intake = codeOf(readFileSync("src/app/portal/(app)/intake/page.tsx", "utf8"));
check("New job is opened by files.create alone", /if \(!actor \|\| !can\(actor, "files\.create"\)\) notFound\(\);/.test(intake));
const inbox = codeOf(readFileSync("src/app/portal/(app)/inbox/page.tsx", "utf8"));
check("Inbox is opened by inbox.read, and answering by inbox.answer", /if \(!actor \|\| !can\(actor, "inbox\.read"\)\) notFound\(\);/.test(inbox) && /const canAnswer = can\(actor, "inbox\.answer"\);/.test(inbox));

console.log("");
if (wrong === 0) {
  console.log(`PASS: every screen a role's grants offer opens for it, ${pairs.length} pairs across ${DEFAULT_ROLES.length} roles; Customer Service has New job, Inbox and New on its bar.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
void NAV;
