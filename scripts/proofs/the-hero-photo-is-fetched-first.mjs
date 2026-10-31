/**
 * THE HERO PHOTOGRAPH IS FETCHED FIRST. Robert, 22:12 Central 2026-10-29:
 * "/coverage brought well under 3400 ms without raising the ceiling (profile
 * what it loads; make static or defer what can be)."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-hero-photo-is-fetched-first.mjs
 *
 * WHAT THE PROFILE FOUND. At 390 the masthead photograph is the largest thing
 * above the fold, and Lighthouse names it the LCP element on /coverage ("A dirt
 * road running straight across open country"). It was rendered with
 * next/image's default, loading="lazy", and no fetch priority, and Lighthouse's
 * own discovery insight said both: "LCP resources should not use loading=lazy"
 * and "fetchpriority=high should be applied". Under the board's simulated 1.6
 * Mbps that put /coverage at 3417ms on board 40906332499 and
 * /coverage/coastal-bend at 3402ms on board 40990127640, against a 3400ms
 * ceiling. Every page with a masthead photograph renders it through
 * src/components/site/PageHeader.tsx, so that one element is the subject.
 *
 * WHAT IT ASSERTS, read off the element by the TypeScript parser rather than by
 * a pattern over the file, so a comment or a second element cannot satisfy it:
 *
 *   PageHeader renders exactly one next/image element;
 *   that element carries loading="eager" and fetchPriority="high";
 *   and it carries no preload, which Next 16 says not to combine with either.
 */
import { readFileSync } from "node:fs";

const FILE = "src/components/site/PageHeader.tsx";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ts = (await import("typescript")).default;
const text = readFileSync(FILE, "utf8");
const sf = ts.createSourceFile(FILE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/* The local name next/image is imported under, so a rename cannot hide it. */
let imageName = null;
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st) && st.moduleSpecifier.text === "next/image" && st.importClause?.name) {
    imageName = st.importClause.name.text;
  }
}
check("PageHeader imports next/image", imageName !== null, imageName ?? "no import found");

const elements = [];
const visit = (node) => {
  if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sf) === imageName) {
    elements.push(node);
  }
  ts.forEachChild(node, visit);
};
visit(sf);
check("and renders exactly one image element, the masthead photograph", elements.length === 1, `${elements.length} found`);

const attrs = new Map();
for (const prop of elements[0]?.attributes.properties ?? []) {
  if (!ts.isJsxAttribute(prop)) continue;
  const name = prop.name.getText(sf);
  const init = prop.initializer;
  const value = init && ts.isStringLiteral(init) ? init.text : init ? init.getText(sf) : true;
  attrs.set(name, value);
}
check('it loads eagerly: loading="eager"', attrs.get("loading") === "eager", `loading=${attrs.get("loading") ?? "absent, so next/image defaults to lazy"}`);
check('it is fetched first: fetchPriority="high"', attrs.get("fetchPriority") === "high", `fetchPriority=${attrs.get("fetchPriority") ?? "absent"}`);
check("and it carries no preload, which Next 16 says not to combine with loading or fetchPriority", !attrs.has("preload") && !attrs.has("priority"));

if (wrong > 0) {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
} else {
  console.log("PASS: the masthead photograph, the LCP element on every page that has one, is fetched eagerly and first.");
}
