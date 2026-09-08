process.loadEnvFile(".env.local");
import { chromium } from "playwright";
const OUT = process.argv[2];
const { createProbe } = await import("./scripts/lib/portal-probe.mjs");
const probe = await createProbe("http://localhost:3225", "admin", "reports");
if (!probe?.cookie) { console.error("no probe:", probe); process.exit(1); }
const browser = await chromium.launch();
for (const width of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addCookies([{ name: "eng_ops", value: probe.cookie, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3225/portal/reports", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/reports-${width}.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
if (probe.cleanup) await probe.cleanup();
console.log("shot at 1280 and 390");
