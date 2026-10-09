/**
 * PROOF: EVERY URL THIS PLATFORM HANDS STRIPE RESOLVES TO A ROUTE THAT EXISTS.
 *
 * Operator finding, 2026-09-28, on launch day. Two return paths were broken and
 * both were invisible from every test in the repository:
 *
 *   /order/[ref]?paid=1              the route exists and answered the paying
 *                                    customer "This link does not open an order",
 *                                    because the token is minted at RELEASE and
 *                                    cannot exist at checkout.
 *   /account/statements/[ref]        the route does not exist at all. There is a
 *                                    list at /account/statements and no detail
 *                                    segment, so it was a 404.
 *
 * WHY NOTHING CAUGHT EITHER, WHICH IS THE PART WORTH CARRYING. These strings are
 * handed to Stripe and Stripe hands them back to a person. Nothing in this
 * repository ever fetches them: the browser audits walk routes derived from the
 * surface inventory, and a success_url is not a route this platform links to. It
 * is a route a PAYMENT PROVIDER links to, which puts it outside the subject list
 * of every check that exists.
 *
 * That is the same shape CLAUDE.md records about the Stripe webhook: the worst
 * failures on an integration live where our own checks have no reason to look.
 *
 * SO THE SUBJECT IS DERIVED FROM THE SOURCE rather than typed here. The proof
 * reads every successUrl and cancelUrl literal out of the modules that build
 * them, extracts the path, and asserts a matching file exists under src/app.
 * A fifth one added next year is covered on the day it is written.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO = "C:/Users/salon/projects/254engineering";
const SOURCES = ["src/lib/ops-payments.ts", "src/lib/ops-statements.ts"];

let wrong = 0;
const failed = [];
const check = (name, ok, note) => {
  if (!ok) {
    wrong += 1;
    failed.push(name);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/* Every successUrl or cancelUrl assignment, with its template literal. */
const found = [];
for (const rel of SOURCES) {
  const body = readFileSync(join(REPO, rel), "utf8");
  for (const m of body.matchAll(/(successUrl|cancelUrl):\s*`([^`]+)`/g)) {
    found.push({ file: rel, kind: m[1], template: m[2] });
  }
}

check(
  `the scan found return urls to check (${found.length})`,
  found.length >= 4,
  found.length < 4 ? "if this were low the checks below would pass over nothing" : found.map((f) => f.kind).join(", "),
);

/**
 * The path a customer's browser would ask for, with every interpolation replaced
 * by a placeholder segment. `${deploymentOrigin()}` is the origin and is dropped;
 * everything else becomes one segment, which is what a dynamic route matches.
 */
function pathOf(template) {
  const afterOrigin = template.replace(/^\$\{deploymentOrigin\(\)\}/, "");
  const noQuery = afterOrigin.split("?")[0];
  return noQuery.replace(/\$\{[^}]+\}/g, "SEGMENT");
}

/**
 * Does a route file exist for this path?
 *
 * Walks src/app the way the router does: a literal segment must match a
 * directory of that name, and a placeholder matches a literal directory OR a
 * dynamic one. Route groups in parentheses are transparent, which is why the
 * order page lives under (site) and is served at /order.
 */
function routeExists(path) {
  const wanted = path.split("/").filter(Boolean);

  const walk = (dir, rest) => {
    if (rest.length === 0) return existsSync(join(dir, "page.tsx"));
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      return false;
    }
    const [head, ...tail] = rest;

    for (const e of entries) {
      /* A route group is not a path segment. Step through it without consuming. */
      if (e.name.startsWith("(") && e.name.endsWith(")")) {
        if (walk(join(dir, e.name), rest)) return true;
        continue;
      }
      const dynamic = e.name.startsWith("[");
      if (e.name === head || (dynamic && head === "SEGMENT")) {
        if (walk(join(dir, e.name), tail)) return true;
      }
    }
    return false;
  };

  return walk(join(REPO, "src/app"), wanted);
}

for (const f of found) {
  const path = pathOf(f.template);
  check(`${f.file} ${f.kind} resolves to a route: ${path}`, routeExists(path), f.template.slice(0, 70));
}

/*
 * AND THE ORDER PAGE ANSWERS A PAID CUSTOMER WITHOUT A TOKEN.
 *
 * The route existing is not enough and was never the defect: /order/[ref]
 * existed the whole time and told a paying customer his link was no good. This
 * asserts the branch that answers him, and asserts it is NOT the refusal.
 */
const orderPage = readFileSync(join(REPO, "src/app/(order)/order/[reference]/page.tsx"), "utf8");
check(
  "the order page has a branch for a paid customer with no token",
  /if\s*\(!view\s*&&\s*paid\)/.test(orderPage),
  "without it, Stripe's success_url lands on the refusal written for a revoked link",
);
check(
  "and that branch is reached BEFORE the refusal",
  orderPage.indexOf("if (!view && paid)") < orderPage.indexOf("This link does not open an order"),
  "order matters: the refusal returns, so a later branch is unreachable",
);
check(
  "and it does not open the order",
  !/if\s*\(!view\s*&&\s*paid\)[\s\S]{0,900}customerView/.test(orderPage),
  "a page that showed the order on paid=1 would make the query string the credential",
);

console.log(
  wrong === 0
    ? "\nAll checks correct. Every return url resolves, and a paid customer is answered rather than refused."
    : `\n${wrong} check(s) wrong: ${failed.join("; ")}`,
);
process.exitCode = wrong === 0 ? 0 : 1;
