/**
 * INDEXNOW, FROM THE PRODUCTION BUILD. Robert's answer of 2026-10-25: option
 * (a). It runs only when VERCEL_ENV is production, never on a preview or a
 * local build. A failed or slow submission logs and never fails the build. It
 * sends only the URLs that changed, as built.
 *
 * Runs as npm's postbuild, after `next build` has written the sitemap.
 *
 * "AS BUILT" is the sitemap this build just rendered,
 * .next/server/app/sitemap.xml.body. "CHANGED" is measured against the sitemap
 * production is serving at this moment, which during the build is still the
 * previous deployment's. If either cannot be read, nothing is sent and the log
 * says which, because guessing at a change would tell IndexNow about pages that
 * did not change.
 *
 * The build runs minutes before the deployment is promoted, so a search engine
 * that fetches at once may see the previous page for those minutes. That is the
 * trade Robert chose over a workflow outside the trigger allowlist.
 */
import { existsSync, readFileSync } from "node:fs";
import { changedUrls, submit, HOST } from "./indexnow.mjs";

const say = (line) => console.log(`[indexnow] ${line}`);
const LIMIT_MS = 15_000;

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    say(`skipped: VERCEL_ENV is ${process.env.VERCEL_ENV ? `"${process.env.VERCEL_ENV}"` : "not set"}, and only a production build submits`);
    return;
  }
  const built = ".next/server/app/sitemap.xml.body";
  if (!existsSync(built)) {
    say(`nothing sent: the built sitemap is not at ${built}`);
    return;
  }
  const current = readFileSync(built, "utf8");
  let previous;
  try {
    const res = await fetch(`https://${HOST}/sitemap.xml`, { signal: AbortSignal.timeout(LIMIT_MS) });
    const body = await res.text();
    if (res.status !== 200 || !body.includes("<urlset")) {
      say(`nothing sent: production's sitemap answered ${res.status}${body.includes("<urlset") ? "" : " without a sitemap in it"}, so what changed cannot be told`);
      return;
    }
    previous = body;
  } catch (e) {
    say(`nothing sent: production's sitemap could not be read (${String(e?.name ?? e)})`);
    return;
  }
  const urls = changedUrls(previous, current);
  if (urls.length === 0) {
    say("nothing sent: no sitemap URL changed in this build");
    return;
  }
  const timed = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(LIMIT_MS) });
  const results = await submit(urls, timed);
  for (const r of results) say(`IndexNow answered ${r.status} for ${r.count} changed URL(s)`);
  for (const u of urls) say(`  ${u}`);
}

try {
  await main();
} catch (e) {
  say(`submission failed and the build carries on: ${String(e?.message ?? e).slice(0, 200)}`);
}
process.exitCode = 0;
