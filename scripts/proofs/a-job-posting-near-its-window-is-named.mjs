/**
 * A job posting close to seo-audit's failure window is named before a board
 * fails on it, and the naming is a warning only.
 *
 * Robert, 10:26 Central 2026-10-31: "have the height-style warning cover
 * JobPosting dates too, naming any validThrough within 45 days as a warning, so
 * the 30-day failure never arrives unannounced." seo-audit runs only on the
 * board, so the decision of which postings warn lives in a pure function,
 * scripts/lib/posting-notice.mjs, and this proof tests that function with no
 * server and a fixed day, so it means the same thing on any date.
 *
 * The figures are the board's own: on 2026-10-31 both postings carried
 * 2026-11-30, 30 days out, and failed with no earlier line saying so.
 */
import { readFileSync } from "node:fs";
import { postingNotices, POSTING_NOTICE_DAYS } from "../lib/posting-notice.mjs";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

/* The failure window, pinned as a literal and asserted against the data file. */
const FAIL_DAYS = 30;
const positions = readFileSync(new URL("../../data/positions.ts", import.meta.url), "utf8");
check(
  "data/positions.ts still declares the 30 day failure window this proof assumes",
  /POSTING_WARNING_DAYS = 30;/.test(positions),
);
check("the notice is the ruled 45 days", POSTING_NOTICE_DAYS === 45, `${POSTING_NOTICE_DAYS}`);

const today = new Date("2026-10-16T15:00:00Z");
const postings = [
  { route: "/careers/at-45", validThrough: "2026-11-30" },
  { route: "/careers/at-46", validThrough: "2026-12-01" },
  { route: "/careers/at-31", validThrough: "2026-11-16" },
  { route: "/careers/at-30", validThrough: "2026-11-15" },
  { route: "/careers/lapsed", validThrough: "2026-10-15" },
  { route: "/careers/not-a-date", validThrough: "soon" },
  { route: "/careers/far", validThrough: "2027-01-31" },
];
const notices = postingNotices(postings, today, FAIL_DAYS);
const byRoute = new Map(notices.map((n) => [n.route, n]));

check("a posting 45 days out is named", byRoute.has("/careers/at-45"), JSON.stringify(notices.map((n) => n.route)));
check("with 45 days left", byRoute.get("/careers/at-45")?.daysLeft === 45, `${byRoute.get("/careers/at-45")?.daysLeft}`);
check("a posting 31 days out is named, and listed first", notices[0]?.route === "/careers/at-31");
check("a posting 46 days out is not named", !byRoute.has("/careers/at-46"));
check(
  "a posting 30 days out is not a warning (it stays a finding in the audit's own path)",
  !byRoute.has("/careers/at-30"),
);
check("a lapsed posting is not a warning", !byRoute.has("/careers/lapsed"));
check("a posting with no real date is not a warning", !byRoute.has("/careers/not-a-date"));
check("a posting far out is not named", !byRoute.has("/careers/far"));
check(
  "the function returns names and days left, never a verdict",
  notices.every((n) => Object.keys(n).sort().join(",") === "daysLeft,route,validThrough"),
  JSON.stringify(notices[0] ?? {}),
);

/* The audit must call it and must not turn it into a finding. */
const audit = readFileSync(new URL("../seo-audit.mjs", import.meta.url), "utf8");
const start = audit.indexOf("const notices = postingNotices(");
const block = start < 0 ? "" : audit.slice(start, audit.indexOf("\n}\n", start));
check("seo-audit calls postingNotices with its own failure window", block.includes("windowDays,"));
check(
  "and pushes nothing from it into problems",
  block.length > 0 && !/problems\.push/.test(block),
  `${block.length} chars read`,
);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: a job posting within ${POSTING_NOTICE_DAYS} days of validThrough is named as a warning, and the warning decides nothing.`
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
