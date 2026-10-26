/**
 * EVERY CITATION ANSWERS ON ITS OWN PAGE.
 *
 *   node scripts/citation-audit.mjs
 *
 * Robert, 2026-10-25, from the Ahrefs crawl of 2026-10-26 00:18 UTC. The crawl
 * found eight outbound citations that redirected, one that had become a
 * homepage, and four that answered 404, on pages whose whole argument is that
 * every claim is traceable. Nothing here had ever loaded a citation.
 *
 * THE SUBJECT IS DERIVED. Every `url: "..."` field and every markdown link to
 * another site in src/content, so a source added to any register is read the
 * day it is written. The protocol transcriptions are excluded by name: they are
 * Aman's signed text, carried verbatim, and are not public copy.
 *
 * THREE VERDICTS, BECAUSE A BOT WALL IS NOT A DEAD PAGE.
 *   FAIL           the citation answers 404 or 410, or redirects anywhere: a
 *                  redirect means the page cited is not the page a reader gets,
 *                  and the fix is to cite the final address after reading it.
 *   COULD NOT TELL 401, 403, 429, a 5xx or no answer. Several official sites
 *                  answer a script that way and a person in a browser with 200
 *                  (Justia, the City of Denton on 2026-10-26). Those are read in
 *                  a browser by hand, and listed here so nobody mistakes them
 *                  for checked.
 *   PASS           200 on the address cited.
 *
 * Requests are paced, one at a time, because these are other people's servers.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";

const ROOT = "src/content";
const EXCLUDED = ["src/content/protocols/"];
const OWN = /(^|\.)254engineering\.com$/i;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = `${dir}/${name}`;
    if (EXCLUDED.some((e) => p.startsWith(e) || `${p}/` === e)) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });

const files = walk(ROOT);
const cited = new Map();
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const found = [
    ...[...text.matchAll(/\burl:\s*"(https?:\/\/[^"]+)"/g)].map((m) => m[1]),
    ...[...text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]),
  ];
  for (const u of found) {
    let host;
    try {
      host = new URL(u).hostname;
    } catch {
      continue;
    }
    if (OWN.test(host)) continue;
    if (!cited.has(u)) cited.set(u, new Set());
    cited.get(u).add(f);
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

const fail = [];
const unsure = [];
let pass = 0;
for (const [url, where] of cited) {
  const at = [...where].join(", ");
  let res;
  try {
    res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    unsure.push(`${url}: no answer (${String(e?.cause?.code ?? e?.name ?? e).slice(0, 40)}) [${at}]`);
    await sleep(400);
    continue;
  }
  const s = res.status;
  if (s >= 300 && s < 400) {
    const to = res.headers.get("location") ?? "(no location)";
    fail.push(`${url}: redirects (${s}) to ${new URL(to, url).href}; cite the final address after reading it [${at}]`);
  } else if (s === 404 || s === 410) {
    fail.push(`${url}: answers ${s}; replace it with a page that says the same thing, or remove the claim resting on it [${at}]`);
  } else if (s >= 200 && s < 300) {
    pass += 1;
  } else {
    unsure.push(`${url}: answers ${s} to a script; read it in a browser [${at}]`);
  }
  await res.body?.cancel().catch(() => {});
  await sleep(400);
}

console.log(`${cited.size} outbound citation(s) in ${files.length} content file(s), protocols excluded by name.`);
for (const line of unsure) console.log(`  COULD NOT TELL: ${line}`);
for (const line of fail) console.log(`  FAIL: ${line}`);
console.log("");
if (cited.size < 50) {
  console.log(`FAIL: only ${cited.size} citations found, below the floor of 50: the scan has stopped reading the registers.`);
  process.exitCode = 1;
} else if (fail.length) {
  console.log(`FAIL: ${fail.length} citation(s) dead or redirected; ${pass} answer on their own page; ${unsure.length} could not be told.`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${pass} citation(s) answer on their own page; ${unsure.length} could not be told by a script and are listed above.`);
  process.exitCode = 0;
}
