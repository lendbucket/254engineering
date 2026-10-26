/**
 * TELL INDEXNOW WHICH SITEMAP URLS CHANGED. Robert, 2026-10-25, from the Ahrefs
 * crawl: a key file at the site root, and the changed sitemap URLs submitted to
 * api.indexnow.org after each production deploy, from the deploy step and never
 * from a page request.
 *
 *   node scripts/indexnow.mjs <previous sitemap.xml> <current sitemap.xml> [--submit]
 *
 * Without --submit it prints what it would send and sends nothing.
 *
 * WHAT "CHANGED" MEANS. A URL in the current sitemap that was not in the
 * previous one, or whose lastmod moved. A URL that left the sitemap is not
 * sent: IndexNow is told about pages that exist. A page whose sitemap entry
 * carries no lastmod (the sitemap carries one only where a true date exists)
 * is sent when it first appears and not again, which is the honest limit of
 * what a sitemap can say about it.
 *
 * THE KEY IS PUBLIC BY DESIGN: IndexNow verifies a submission by fetching
 * public/<key>.txt from the host. It is not a secret and no secret is read here.
 *
 * WHERE IT RUNS: THE PRODUCTION BUILD, Robert's answer (a) of 2026-10-25.
 * scripts/indexnow-after-build.mjs is npm's postbuild; it submits only when
 * VERCEL_ENV is production, and a failed or slow submission never fails the
 * build. Vercel deploys from its Git integration, so there is no deploy step of
 * ours; the other two options (a deployment_status workflow, or dropping
 * [skip ci] from merges) were not chosen.
 */
import { readFileSync } from "node:fs";

export const INDEXNOW_KEY = "8e5df2ec478b0645910ddf17d8fdf8d9";
export const HOST = "254engineering.com";
export const ENDPOINT = "https://api.indexnow.org/indexnow";
/* IndexNow's limit per request. */
const BATCH = 10_000;

/** { loc: lastmod | null } from sitemap XML. */
export function entriesOf(xml) {
  const out = new Map();
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;
    out.set(loc, m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? null);
  }
  return out;
}

/** The URLs to submit: new to the sitemap, or with a lastmod that moved. Only this site's own host. */
export function changedUrls(previousXml, currentXml) {
  const before = entriesOf(previousXml);
  const after = entriesOf(currentXml);
  const own = (u) => {
    try {
      return new URL(u).hostname === HOST;
    } catch {
      return false;
    }
  };
  return [...after].filter(([loc, lastmod]) => own(loc) && (!before.has(loc) || before.get(loc) !== lastmod)).map(([loc]) => loc);
}

/** POSTs the URLs in batches. Returns one { status, count } per request. Sends nothing for an empty list. */
export async function submit(urls, fetchImpl = fetch) {
  const results = [];
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH);
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`, urlList }),
    });
    results.push({ status: res.status, count: urlList.length });
  }
  return results;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}`) {
  const [prev, cur] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!prev || !cur) {
    console.error("usage: node scripts/indexnow.mjs <previous sitemap.xml> <current sitemap.xml> [--submit]");
    process.exit(2);
  }
  const urls = changedUrls(readFileSync(prev, "utf8"), readFileSync(cur, "utf8"));
  console.log(`${urls.length} changed sitemap URL(s)`);
  for (const u of urls) console.log(`  ${u}`);
  if (process.argv.includes("--submit") && urls.length) {
    const results = await submit(urls);
    for (const r of results) console.log(`  IndexNow answered ${r.status} for ${r.count} URL(s)`);
    /* 200 and 202 are accepted; anything else is a failed submission and says so. */
    if (results.some((r) => r.status !== 200 && r.status !== 202)) process.exit(1);
  }
}
