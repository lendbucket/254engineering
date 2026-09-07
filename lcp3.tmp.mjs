import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "playwright";
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});
const r = await lighthouse("https://254engineering.com/coverage",
  { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
  { extends: "lighthouse:default", settings: {
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
    throttlingMethod: "simulate",
    throttling: { rttMs: 150, throughputKbps: 1600, cpuSlowdownMultiplier: 4,
      requestLatencyMs: 562.5, downloadThroughputKbps: 1440, uploadThroughputKbps: 750 } } });
const ids = Object.keys(r.lhr.audits);
console.log("lighthouse version:", r.lhr.lighthouseVersion);
console.log("\naudits mentioning element/largest/paint/insight:");
for (const id of ids) if (/element|largest|paint|insight|lcp/i.test(id)) console.log("  " + id);
