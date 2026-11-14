/**
 * PROOF: NO NEXT LINK POINTS AT AN API ROUTE.
 *
 * Next prefetches every <Link> in view. An API route behind one is CALLED when
 * a screen merely opens. On 2026-10-09 the administrator's dashboard did that
 * to its period export, which writes an audit row before it answers, so every
 * visit recorded an export nobody made and the page never went idle. The fix
 * then went into ButtonLink, which renders a plain anchor for an /api/ href,
 * and closed that component only.
 *
 * On 2026-11-13 the office-ready measurement found the same thing on
 * /portal/crm/reports, built later with a plain <Link> to
 * /api/portal/crm/reports, an export that also writes its audit row first. The
 * instance fix of October did not reach it, because nothing looked at <Link>.
 *
 * So this reads every .tsx file under src, finds every element whose tag is the
 * name `next/link` was imported as, and refuses any whose href begins /api/,
 * written as a string or a template. It counts what it read, so a scan that
 * matched nothing fails rather than passing over an empty set.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = walk("src");
let filesWithLink = 0;
let linksRead = 0;
const offenders = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const imp = src.match(/import\s+(\w+)\s+from\s+["']next\/link["']/);
  if (!imp) continue;
  filesWithLink += 1;
  const tag = imp[1];
  const open = new RegExp(`<${tag}\\b([^>]*?)>`, "gs");
  for (const m of src.matchAll(open)) {
    linksRead += 1;
    const href = m[1].match(/href=\{?\s*[`"']([^`"']*)/);
    if (href && href[1].startsWith("/api/")) {
      const line = src.slice(0, m.index).split("\n").length;
      offenders.push(`${f.replace(/\\/g, "/")}:${line} ${href[1].slice(0, 60)}`);
    }
  }
}

check("the scan read Next links", filesWithLink >= 20 && linksRead >= 100, `${linksRead} links in ${filesWithLink} files`);
check("no Next Link points at an API route", offenders.length === 0, offenders.join("; "));

if (wrong) {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
console.log(`PASS: no Next Link among ${linksRead} points at an API route, so opening a screen calls no route.`);
