/**
 * THE OPEN CALL SCRIPT VARIANTS, FOUND BY STRUCTURE. Robert's ruling of
 * 2026-11-02 evening on R3 (issue #1, his answer to 6589813147, item 1):
 * "approved, the narrow counted exemption for the open script variants in
 * src/content/crm-scripts.ts only, with the second check that they render
 * nowhere except behind the sellable test."
 *
 * The approved open variants are present tense by design ("We issue roof
 * certification letters"): they are true only when the line they name is
 * sellable, and only then are they shown. The voice rule on added lines
 * (preflight rule 5) cannot tell that from a claim, so it is told, and told
 * narrowly:
 *
 *   - ONE FILE. Only src/content/crm-scripts.ts. Nowhere else is exempt.
 *   - ONE PROPERTY. Only the string literal that is the `open` property of an
 *     entry of the CRM_SCRIPTS object, found by parsing the file with the
 *     TypeScript compiler, never by a list of sentences somebody keeps.
 *   - NEVER A PRELAUNCH VARIANT. Those are read by the ordinary rule and must
 *     pass it. If an open text were also a prelaunch text, the exemption could
 *     reach a prelaunch variant, so that is refused outright.
 *   - COUNTED AND NAMED. The rule prints how many it exempted and for which
 *     verticals, so the exemption cannot grow without the output saying so.
 *
 * The second half of the ruling, that an open variant renders nowhere except
 * behind the sellable test, is proved by
 * scripts/proofs/the-open-call-scripts-render-only-behind-the-sellable-test.mjs.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export const CRM_SCRIPTS_FILE = "src/content/crm-scripts.ts";

const require = createRequire(import.meta.url);

/**
 * The open and prelaunch texts of every CRM_SCRIPTS entry, read from the AST.
 * Returns problems instead of guessing when the shape is not the one expected,
 * so a reshaped file fails the rule rather than exempting nothing (or more).
 */
export function crmScriptVariants(source = readFileSync(CRM_SCRIPTS_FILE, "utf8")) {
  const ts = require("typescript");
  const sf = ts.createSourceFile(CRM_SCRIPTS_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const open = [];
  const prelaunch = [];
  const problems = [];
  let found = false;

  const textOf = (node) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "CRM_SCRIPTS") {
      found = true;
      let init = node.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init) || ts.isParenthesizedExpression(init))) init = init.expression;
      if (!init || !ts.isObjectLiteralExpression(init)) {
        problems.push("CRM_SCRIPTS is not an object literal");
        return;
      }
      for (const prop of init.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isObjectLiteralExpression(prop.initializer)) {
          problems.push("a CRM_SCRIPTS entry is not a plain property with an object value");
          continue;
        }
        const vertical = prop.name.getText(sf).replace(/^["']|["']$/g, "");
        const byKey = new Map();
        for (const inner of prop.initializer.properties) {
          if (ts.isPropertyAssignment(inner)) byKey.set(inner.name.getText(sf), inner.initializer);
        }
        const o = textOf(byKey.get("open"));
        const p = textOf(byKey.get("prelaunch"));
        if (o === null || p === null) {
          problems.push(`${vertical}: open and prelaunch must each be one plain string literal`);
          continue;
        }
        open.push({ vertical, text: o });
        prelaunch.push({ vertical, text: p });
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!found) problems.push("CRM_SCRIPTS was not found");
  const openTexts = new Set(open.map((x) => x.text));
  for (const p of prelaunch) if (openTexts.has(p.text)) problems.push(`${p.vertical}: a prelaunch text is identical to an open text`);
  return { open, prelaunch, problems };
}

/**
 * The value of an added line, if the line is exactly one double-quoted string
 * literal (optionally after `open:` and before a trailing comma), else null.
 * Only `open:` is stripped, never `prelaunch:`.
 */
export function literalOnLine(line) {
  const m = line.trim().replace(/^open\s*:\s*/, "").replace(/,\s*$/, "");
  if (!/^"(?:[^"\\]|\\.)*"$/.test(m)) return null;
  try {
    return JSON.parse(m);
  } catch {
    return null;
  }
}

/**
 * Splits added lines into the ones the voice rule reads and the ones it
 * exempts: an added line is exempt only if it is in CRM_SCRIPTS_FILE and its
 * one string literal is exactly an open variant's text.
 */
export function exemptOpenScriptLines(added, variants = crmScriptVariants()) {
  const openByText = new Map(variants.open.map((x) => [x.text, x.vertical]));
  const kept = [];
  const exempted = [];
  for (const a of added) {
    if (a.path === CRM_SCRIPTS_FILE) {
      const value = literalOnLine(a.text);
      if (value !== null && openByText.has(value)) {
        exempted.push(openByText.get(value));
        continue;
      }
    }
    kept.push(a);
  }
  return { kept, exempted };
}
