/**
 * ONLY THE UPRIGHT FACE IS PRELOADED. Item l, Robert 2026-11-01, on
 * /coverage/coastal-bend at 3,014ms: "change how fonts load, not which fonts or
 * how they look ... preload only the weights used above the fold".
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/only-the-upright-face-is-preloaded.mjs
 *
 * WHAT IT CHANGED. One next/font/local declaration carried both Inter files, and
 * next/font preloads every file of a declaration, so every public page fetched
 * the 51 KB italic beside the masthead photograph, its LCP element, while no
 * public page paints italic (read off the live /coverage/coastal-bend head on
 * 2026-11-01: two font preloads, upright and italic). The italic is now its own
 * declaration with preload off. Same two files, same weights, same face.
 *
 * WHAT IT ASSERTS, read off the layout by the TypeScript parser:
 *
 *   exactly two localFont declarations, one per file;
 *   the upright one is preloaded (no preload: false) and serves 400 to 700;
 *   the italic one serves 400 to 700 italic and carries preload: false;
 *   both variables are on <html>;
 *   and globals.css points italic text at the italic declaration, so the
 *   portal's absent data chip keeps a real italic, not a synthesised oblique.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const FILE = "src/app/layout.tsx";
const ts = (await import("typescript")).default;
const text = readFileSync(FILE, "utf8");
const sf = ts.createSourceFile(FILE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

let localName = null;
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st) && st.moduleSpecifier.text === "next/font/local" && st.importClause?.name) {
    localName = st.importClause.name.text;
  }
}
check("the layout imports next/font/local", localName !== null);

/* Every call of the import, with its binding name and its options object. */
const calls = [];
for (const st of sf.statements) {
  if (!ts.isVariableStatement(st)) continue;
  for (const d of st.declarationList.declarations) {
    const init = d.initializer;
    if (init && ts.isCallExpression(init) && init.expression.getText(sf) === localName && ts.isObjectLiteralExpression(init.arguments[0])) {
      const opts = new Map();
      for (const p of init.arguments[0].properties) if (ts.isPropertyAssignment(p)) opts.set(p.name.getText(sf), p.initializer);
      const files = [];
      const srcNode = opts.get("src");
      if (srcNode && ts.isArrayLiteralExpression(srcNode)) {
        for (const el of srcNode.elements) {
          if (!ts.isObjectLiteralExpression(el)) continue;
          const f = {};
          for (const p of el.properties) if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) f[p.name.getText(sf)] = p.initializer.text;
          files.push(f);
        }
      }
      calls.push({ name: d.name.getText(sf), opts, files });
    }
  }
}
check("exactly two localFont declarations", calls.length === 2, `${calls.length} found`);
check("each declares exactly one file", calls.every((c) => c.files.length === 1), calls.map((c) => `${c.name}: ${c.files.length}`).join(", "));

const upright = calls.find((c) => c.files[0]?.style === "normal");
const italic = calls.find((c) => c.files[0]?.style === "italic");
check("the upright declaration serves Inter 400 to 700", upright?.files[0]?.path === "../fonts/inter-latin.woff2" && upright.files[0].weight === "400 700");
check("and is preloaded", upright !== undefined && upright.opts.get("preload")?.kind !== ts.SyntaxKind.FalseKeyword);
check("the italic declaration serves Inter italic 400 to 700", italic?.files[0]?.path === "../fonts/inter-latin-italic.woff2" && italic.files[0].weight === "400 700");
check("and is not preloaded", italic?.opts.get("preload")?.kind === ts.SyntaxKind.FalseKeyword);
const varOf = (c) => (c?.opts.get("variable") && ts.isStringLiteral(c.opts.get("variable")) ? c.opts.get("variable").text : null);
check("the upright variable is still --font-inter, which the site tokens read", varOf(upright) === "--font-inter");
check("the italic has its own variable", varOf(italic) === "--font-inter-italic");
check(
  "both variables are on <html>",
  upright && italic && text.includes(`className={\`\${${upright.name}.variable} \${${italic.name}.variable}\`}`),
);

const css = readFileSync("src/app/globals.css", "utf8");
check(
  "italic text reads the italic declaration first",
  /:where\(\.italic, em, i\) \{\s*font-family: var\(--font-inter-italic\), var\(--font-sans\);\s*\}/.test(css),
);

console.log(wrong === 0 ? "PASS: only the upright face is preloaded, and italic text still gets the real italic." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
