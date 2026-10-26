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

/*
 * FROM THE PRODUCTION BUILD ONLY, AND NEVER FAILING IT (Robert's answer (a),
 * 2026-10-25). The real post-build step is run in a child, in a scratch
 * directory holding a built sitemap, with fetch replaced by a preload that
 * serves production's previous sitemap and records what reaches IndexNow.
 */
{
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const { pathToFileURL } = await import("node:url");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  check("npm runs the step after every build", pkg.scripts?.postbuild === "node scripts/indexnow-after-build.mjs", String(pkg.scripts?.postbuild));
  const step = resolve("scripts/indexnow-after-build.mjs");
  const run = (env, { endpoint = "accept", sitemap = "serve" } = {}) => {
    const dir = mkdtempSync(join(tmpdir(), "indexnow-proof-"));
    mkdirSync(join(dir, ".next/server/app"), { recursive: true });
    writeFileSync(join(dir, ".next/server/app/sitemap.xml.body"), after);
    const sent = join(dir, "sent.json");
    const preload = join(dir, "fake-fetch.mjs");
    writeFileSync(
      preload,
      [
        `import { appendFileSync } from "node:fs";`,
        `const before = ${JSON.stringify(before)};`,
        `globalThis.fetch = async (url, init) => {`,
        `  if (String(url).endsWith("/sitemap.xml")) {`,
        `    if (${JSON.stringify(sitemap)} === "blocked") return new Response("challenge", { status: 403 });`,
        `    return new Response(before, { status: 200 });`,
        `  }`,
        `  if (${JSON.stringify(endpoint)} === "throws") throw new Error("proof: IndexNow is down");`,
        `  appendFileSync(${JSON.stringify(sent)}, init.body + "\\n");`,
        `  return new Response(null, { status: 202 });`,
        `};`,
      ].join("\n"),
    );
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, step], {
      cwd: dir,
      env: { ...process.env, VERCEL_ENV: env ?? "" },
      encoding: "utf8",
    });
    const posted = existsSync(sent) ? readFileSync(sent, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    rmSync(dir, { recursive: true, force: true });
    return { code: r.status, out: `${r.stdout}${r.stderr}`, posted };
  };
  const local = run(undefined);
  check("a local build submits nothing and exits 0", local.code === 0 && local.posted.length === 0 && /skipped/.test(local.out), local.out.trim());
  const preview = run("preview");
  check("a preview build submits nothing and exits 0", preview.code === 0 && preview.posted.length === 0 && /skipped/.test(preview.out), preview.out.trim());
  const prod = run("production");
  check(
    "a production build sends exactly the changed URLs, as built",
    prod.code === 0 && prod.posted.length === 1 && JSON.stringify(prod.posted[0].urlList) === JSON.stringify(urls),
    prod.posted.length ? JSON.stringify(prod.posted[0].urlList) : prod.out.trim(),
  );
  const down = run("production", { endpoint: "throws" });
  check("a failed submission logs and the build still exits 0", down.code === 0 && /submission failed and the build carries on/.test(down.out), down.out.trim());
  const blocked = run("production", { sitemap: "blocked" });
  check("an unreadable live sitemap sends nothing, says so, and exits 0", blocked.code === 0 && blocked.posted.length === 0 && /answered 403/.test(blocked.out), blocked.out.trim());
}

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
