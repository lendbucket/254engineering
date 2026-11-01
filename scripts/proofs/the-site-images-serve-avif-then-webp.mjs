/**
 * THE SITE'S IMAGES ARE SERVED AS AVIF, WITH WEBP FOR A BROWSER THAT DOES NOT
 * ACCEPT IT. Robert, 2026-10-31, on issue #1 comment 6551453855: "yes, serve
 * AVIF with WebP fallback for the hero photo and site images. Report /coverage
 * on the next three boards."
 *
 *   node scripts/proofs/the-site-images-serve-avif-then-webp.mjs
 *
 * Bundle 42 named /coverage's LCP element: the masthead photograph, rendered by
 * next/image in src/components/site/PageHeader.tsx. Its bytes are the lever, and
 * next/image re-encodes to whatever `images.formats` lists, first match against
 * the request's Accept header winning. Next's default is WebP alone.
 *
 * WHAT IT ASSERTS.
 *   next.config.ts, as Next reads it, lists exactly AVIF then WebP. The ruled
 *   list is written out here as a literal, never imported, so the config
 *   drifting is a red rather than a comparison of a value with itself.
 *   No public page renders a raw <img>, which next/image would never see, so
 *   the setting reaches every site image. The public surface is the (site)
 *   route group and the site and brand components it renders.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RULED = ["image/avif", "image/webp"];

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const config = (await import("../../next.config.ts")).default;
const formats = config?.images?.formats ?? null;
check(
  "next.config.ts lists AVIF first and WebP second, and nothing else",
  Array.isArray(formats) && formats.length === RULED.length && formats.every((f, i) => f === RULED[i]),
  JSON.stringify(formats),
);

const ts = (await import("typescript")).default;
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
const files = ["src/app/(site)", "src/components/site", "src/components/brand"].flatMap(walk);
check("the public surface was found and read", files.length >= 10, `${files.length} files`);

const raw = [];
for (const file of files) {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sf) === "img") {
      raw.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
check("no public page renders a raw <img> that next/image would never re-encode", raw.length === 0, raw.join(", "));

const header = readFileSync("src/components/site/PageHeader.tsx", "utf8");
check("the masthead photograph is still rendered through next/image", /from "next\/image"/.test(header));

console.log(wrong === 0 ? "PASS: the site's images are served as AVIF, then WebP." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
