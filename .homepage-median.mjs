/**
 * The homepage LCP, measured enough times to be representative.
 *
 * Uses perf-audit's throttling settings verbatim, so the figures are comparable
 * to the gate rather than merely similar to it. One route only, because the
 * gate's other nine are not in question and running them would multiply the
 * time by ten for no information.
 *
 * Reports the distribution of the MEDIAN, which is what the gate judges, not
 * the distribution of individual samples.
 */
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const BASE = "http://localhost:3225";
const MEDIANS = Number(process.env.MEDIANS || 8);
const SAMPLES = 3;

const SETTINGS = {
  formFactor: "mobile",
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
  throttlingMethod: "simulate",
  throttling: {
    rttMs: 150,
    throughputKbps: 1600,
    cpuSlowdownMultiplier: 4,
    requestLatencyMs: 150 * 3.75,
    downloadThroughputKbps: 1600 * 0.9,
    uploadThroughputKbps: 750,
  },
};

const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};

function sh(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32", stdio: "pipe" });
}

async function waitFor(url, ms = 90000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if ((await fetch(url)).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

const server = spawn("npx", ["next", "start", "-p", "3225"], { shell: process.platform === "win32", stdio: "ignore" });
const medians = [];
const everySample = [];

try {
  if (!(await waitFor(BASE))) { console.log("SERVER NEVER ANSWERED"); process.exit(1); }

  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });

  try {
    for (let i = 1; i <= MEDIANS; i += 1) {
      const samples = [];
      for (let s = 0; s < SAMPLES; s += 1) {
        const r = await lighthouse(
          `${BASE}/`,
          { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
          { extends: "lighthouse:default", settings: SETTINGS },
        );
        const lcp = r.lhr.audits["largest-contentful-paint"]?.numericValue;
        if (typeof lcp === "number") samples.push(Math.round(lcp));
      }
      everySample.push(...samples);
      const m = median(samples);
      medians.push(m);
      console.log(`  median ${String(i).padStart(2)}: ${m}   samples ${samples.join(", ")}`);
    }
  } finally {
    await chrome.kill();
  }
} finally {
  server.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  sh("npx", ["kill-port", "3225"]);
}

const lo = Math.min(...medians);
const hi = Math.max(...medians);
const mid = median(medians);
const p = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

console.log("");
console.log(`THE HOMEPAGE, ${MEDIANS} INDEPENDENT MEDIANS OF ${SAMPLES}`);
console.log(`  medians:        ${medians.join(", ")}`);
console.log(`  min ${lo}   median ${mid}   max ${hi}   range ${hi - lo}`);
console.log(`  all ${everySample.length} samples: min ${Math.min(...everySample)}  max ${Math.max(...everySample)}`);
console.log("");
for (const ceiling of [3400, 3500, 3600, 3700, 3800]) {
  const over = medians.filter((v) => v > ceiling).length;
  console.log(`  at a ceiling of ${ceiling}: ${over} of ${medians.length} medians cross`);
}
console.log("");
console.log(`  worst observed median + 10%: ${Math.ceil((hi * 1.1) / 50) * 50}`);
