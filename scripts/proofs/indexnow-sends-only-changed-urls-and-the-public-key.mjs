/**
 * INDEXNOW IS SENT ONLY THE SITEMAP URLS THAT CHANGED, WITH THE PUBLIC KEY THE
 * SITE SERVES. Robert, 2026-10-25.
 *
 *   node scripts/proofs/indexnow-sends-only-changed-urls-and-the-public-key.mjs
 *
 * Against two sitemaps built here and a fetch that records instead of sending.
 * Nothing reaches api.indexnow.org.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { changedUrls, submit, INDEXNOW_KEY, HOST, ENDPOINT } from "../indexnow.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const map = (entries) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset>${entries
    .map(([loc, lastmod]) => `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`)
    .join("")}</urlset>`;
const H = `https://${HOST}`;
const before = map([[`${H}/`, null], [`${H}/insights/a`, "2026-10-01"], [`${H}/insights/b`, "2026-10-01"], [`${H}/old`, null]]);
const after = map([[`${H}/`, null], [`${H}/insights/a`, "2026-10-26"], [`${H}/insights/b`, "2026-10-01"], [`${H}/new`, null], ["https://elsewhere.example/x", null]]);

const urls = changedUrls(before, after);
check("a page whose lastmod moved is sent", urls.includes(`${H}/insights/a`));
check("a page new to the sitemap is sent", urls.includes(`${H}/new`));
check("a page whose lastmod did not move is not sent", !urls.includes(`${H}/insights/b`));
check("a page with no lastmod, present both times, is not sent again", !urls.includes(`${H}/`));
check("a page that left the sitemap is not sent", !urls.includes(`${H}/old`));
check("nothing on another host is sent", !urls.some((u) => !u.startsWith(H)));
check("exactly the two changed pages", urls.length === 2, urls.join(", "));

const sent = [];
const recorder = async (url, init) => {
  sent.push({ url, body: JSON.parse(init.body) });
  return new Response(null, { status: 202 });
};
const results = await submit(urls, recorder);
check("one request, to api.indexnow.org", sent.length === 1 && sent[0].url === ENDPOINT && ENDPOINT === "https://api.indexnow.org/indexnow", sent[0]?.url);
check(
  "it names the host, the key and where the key is served",
  sent[0]?.body.host === HOST && sent[0]?.body.key === INDEXNOW_KEY && sent[0]?.body.keyLocation === `${H}/${INDEXNOW_KEY}.txt`,
  JSON.stringify(sent[0]?.body),
);
check("and only the changed URLs", JSON.stringify(sent[0]?.body.urlList) === JSON.stringify(urls));
check("the answer is reported", results[0]?.status === 202 && results[0]?.count === 2);
sent.length = 0;
await submit([], recorder);
check("an empty list sends nothing", sent.length === 0);

const keyFile = `public/${INDEXNOW_KEY}.txt`;
check("the key file is served at the site root", existsSync(keyFile), keyFile);
check("and holds exactly the key", existsSync(keyFile) && readFileSync(keyFile, "utf8").trim() === INDEXNOW_KEY);
check(
  "it is the only IndexNow key file there",
  readdirSync("public").filter((f) => /^[0-9a-f]{32}\.txt$/.test(f)).length === 1,
);

/* Never from a page request: nothing under src submits. */
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
const callers = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && /indexnow/i.test(readFileSync(f, "utf8")));
check("no page, route or library under src calls IndexNow", callers.length === 0, callers.join(", ") || "none");

console.log("");
if (wrong === 0) {
  console.log("PASS: IndexNow is sent only the sitemap URLs that changed, with the public key the site serves.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
