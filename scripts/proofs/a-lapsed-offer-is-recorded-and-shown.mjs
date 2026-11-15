/**
 * A DISPATCH OFFER NOBODY ANSWERED IS RECORDED AS LAPSED, AND THE DISPATCHER SEES IT.
 *
 * Part 1 finding 19, Robert's answer 1 of 2026-11-14. "expired" was a word the
 * schema allowed and nothing wrote; the dispatcher's "expiring soon" counted
 * offers already past their time, and nobody was told an offer had lapsed.
 *
 * What must hold:
 *   1. The jobs cron runs sweepLapsedOffers after the batch, every minute.
 *   2. The sweep moves a row only from "offered" to "expired", so an answer
 *      given in the same moment stands, and writes the lapse to the file.
 *   3. It never throws and says how many it moved, never how many exist.
 *   4. "Expiring soon" counts only offers still ahead of their time.
 *   5. A file left with nobody offered after a lapse is named on the
 *      dispatcher's home and links to the file itself.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const cron = codeOf(readFileSync("src/app/api/cron/jobs/route.ts", "utf8"));
check("the jobs cron runs the lapse sweep", /const lapses = await sweepLapsedOffers\(\);/.test(cron));
check("after the batch", cron.indexOf("await sweepLapsedOffers()") > cron.indexOf("await runBatch(workerId)"));
check("and reports what it did", /offers: \$\{lapses\.note\}/.test(cron));

const sweep = codeOf(readFileSync("src/lib/offer-lapse.ts", "utf8"));
check("it reads offers still marked offered whose time has passed", /\.eq\("state", "offered"\)\s*\.lt\("expires_at", /.test(sweep));
check("it moves a row only from offered to expired", /\.update\(\{ state: "expired", responded_at: DB_NOW \}\)\s*\.eq\("id", row\.id\)\s*\.eq\("state", "offered"\)/.test(sweep));
check("an answer in the same moment stands", /if \(!moved\?\.length\) continue;/.test(sweep));
check("each lapse is written to the file's timeline", /from\("eng_file_events"\)\.insert\(\{[\s\S]*?kind: "dispatch"/.test(sweep));
check("it never throws", /catch \(err\) \{\s*await captureError\(err/.test(sweep));
check("its note counts what it moved, not what exists", /marked lapsed this run/.test(sweep) && /more may be waiting/.test(sweep));

const dash = codeOf(readFileSync("src/lib/ops-dashboard.ts", "utf8"));
const dispatcher = dash.slice(dash.indexOf("async function dispatcherDashboard("), dash.indexOf("// ------------------------------------------------------------------ sales"));
check("expiring soon counts only offers still ahead of their time", /return at > nowMs && at < nowMs \+ HOURS_48;/.test(dispatcher));
check("lapsed offers are read, and a failed read is said", /\.eq\("state", "expired"\)/.test(dispatcher) && /if \(!lapseRead\.ok\) notComputable\.push\(/.test(dispatcher));
check("a file still offered to somebody is not listed", /!stillOffered\.has\(f\.id as string\)/.test(dispatcher));
check("each file left with nobody offered links to the file", /href: `\/portal\/files\?id=\$\{f\.id as string\}`/.test(dispatcher));

console.log("");
if (wrong === 0) {
  console.log("PASS: a lapsed offer is recorded each minute, written to its file, and named on the dispatcher's home.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
