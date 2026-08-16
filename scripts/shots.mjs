// Screenshot harness. Every new surface is photographed at 390 and 1280 and
// looked at before it is reported as done.
//
//   npm run shots                          every route in ROUTES
//   npm run shots -- / /services           only those routes
//   BASE_URL=http://localhost:3225 npm run shots    against a running server
//
// Files land in screenshots/<slug>-<width>.png, overwritten each run so the
// directory is always the current state of the site rather than an archive.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { startNextServer } from "./lib/dev-server.mjs";

const PORT = Number(process.env.SHOTS_PORT || 3226);
const WIDTHS = [390, 1280];
const OUT = path.join(process.cwd(), "screenshots");

const ROUTES = [
  "/",
  "/about",
  "/services",
  "/services/roof-inspections",
  "/services/windstorm-wpi-8",
  "/coverage",
  "/coverage/coastal-bend",
  "/coverage/panhandle",
  "/government",
  "/careers",
  "/contact",
  "/waitlist",
  "/privacy",
  "/terms",
];

const requested = process.argv.slice(2).filter((a) => a.startsWith("/"));
const routes = requested.length ? requested : ROUTES;

const slug = (route) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/[\/?=&]/g, "-"));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const external = process.env.BASE_URL;
  let server = null;
  let base = external;

  if (!external) {
    console.log(`Starting next dev on port ${PORT} ...`);
    server = await startNextServer({ port: PORT, command: "dev", timeoutMs: 180000 });
    base = server.base;
  }

  const browser = await chromium.launch();
  try {
    for (const route of routes) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        const res = await page.goto(base + route, { waitUntil: "networkidle", timeout: 120000 });
        const status = res ? res.status() : 0;
        // A shot of a 404 looks like a shot of a page. Say the status out loud
        // so a missing route is read as missing rather than as a design choice.
        const file = path.join(OUT, `${slug(route)}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  ${route} @${width}  HTTP ${status}  ${path.relative(process.cwd(), file)}`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (server) await server.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
