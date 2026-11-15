/**
 * A TELEPHONED JOB UNPAID AFTER 24 HOURS GOES BACK TO THE REP WHO TOOK IT.
 *
 * The Killeen call, item 6 (Robert, 2026-11-14). What must hold:
 *   1. The jobs cron runs sweepUnpaidJobs after the batch.
 *   2. It reads card orders raised against a file, still awaiting payment, raised
 *      24 or more hours ago; a web checkout with no file is not one of them.
 *   3. Newest first, so orders already followed up cannot crowd out a new one.
 *   4. One task per order, keyed on the order, assigned to eng_files.created_by
 *      (the person takeJob records), on the file, linking to the file where the
 *      resend is.
 *   5. raiseSystemTask writes the assignee and file it is given, and nothing
 *      for a caller that gives none.
 *   6. It never throws, and counts what it raised, not what exists.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const cron = codeOf(readFileSync("src/app/api/cron/jobs/route.ts", "utf8"));
check("the jobs cron runs the unpaid sweep after the batch", /const unpaid = await sweepUnpaidJobs\(\);/.test(cron) && cron.indexOf("await sweepUnpaidJobs()") > cron.indexOf("await runBatch(workerId)"));

const sweep = codeOf(readFileSync("src/lib/unpaid-followup.ts", "utf8"));
check("the window is 24 hours", /export const UNPAID_AFTER_HOURS = 24;/.test(sweep) && /now - UNPAID_AFTER_HOURS \* 3600_000/.test(sweep));
check("card orders on a file still awaiting payment", /\.eq\("status", "awaiting_payment"\)\s*\.eq\("billing_mode", "card"\)\s*\.not\("file_id", "is", null\)\s*\.lt\("created_at", before\)/.test(sweep));
check("newest first", /\.order\("created_at", \{ ascending: false \}\)/.test(sweep));
check("one task per order", /key: `unpaid-followup:\$\{o\.id as string\}`/.test(sweep));
check("assigned to the person who took the job", /assigneeId: file\?\.created_by \?\? null,/.test(sweep) && /eng_files\(file_number, created_by\)/.test(sweep));
check("on the file, linking to it", /fileId: o\.file_id as string,/.test(sweep) && /\/portal\/files\?id=\$\{o\.file_id as string\}/.test(sweep));
check("it never throws", /catch \(err\) \{\s*await captureError\(err/.test(sweep));
check("and counts what it raised, not what exists", /if \(!result\.already\) raised \+= 1;/.test(sweep) && /more may be waiting/.test(sweep));

const work = codeOf(readFileSync("src/lib/system-work.ts", "utf8"));
check("raiseSystemTask writes the assignee it is given", /assignee_id: input\.assigneeId \?\? null,/.test(work));
check("and the file", /file_id: input\.fileId \?\? null,/.test(work));

const intake = codeOf(readFileSync("src/lib/ops-crm.ts", "utf8"));
check("createFile records who took the job", /created_by: actor\.id,/.test(intake));

console.log("");
if (wrong === 0) {
  console.log("PASS: an unpaid telephoned job goes back to the rep who took it after 24 hours, once, with the file linked.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
