/**
 * AN OFFER NOTIFICATION OPENS THE JOB, NOT THE LIST. Walk 2, 2026-11-15.
 *
 * The job's own page has carried the offer's accept and decline controls since
 * Robert's answer 3 of 2026-11-12 ("opened from a notification or a link, an
 * offered job's page" answers the offer too). The notification that tells a
 * technician about the offer still linked /portal/jobs, so the one message
 * built to bring him to that page dropped him on the list instead.
 *
 * What must hold:
 *   1. The offer.received notification in ops-field.ts links the job by its
 *      file id, /portal/jobs/${fileId}, and names the same file as its entity.
 *   2. The job page exists, opens for a reader who may list his own offers,
 *      and finds his live offer on that file to show its controls.
 *   3. The two offer.lost notifications still link the list: a technician
 *      who lost the job cannot open it, and sending him there would be a
 *      dead end.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const field = codeOf(readFileSync("src/lib/ops-field.ts", "utf8"));
/** Every raise({ ... }) call, as the text between its braces, located by the call and not by a window. */
const raises = [];
for (let at = field.indexOf("await raise({"); at >= 0; at = field.indexOf("await raise({", at + 1)) {
  let depth = 0, end = -1;
  for (let i = field.indexOf("{", at); i < field.length; i++) {
    if (field[i] === "{") depth++;
    else if (field[i] === "}" && --depth === 0) { end = i; break; }
  }
  raises.push(field.slice(at, end + 1));
}
const ofKind = (kind) => raises.filter((r) => r.includes(`kind: "${kind}"`));

const received = ofKind("offer.received");
check("ops-field raises exactly one offer.received notification", received.length === 1, `${received.length} found`);
check("it links the job by its file id", /href: `\/portal\/jobs\/\$\{fileId\}`/.test(received[0] ?? ""), (received[0] ?? "").match(/href: [^\n]*/)?.[0]);
check("and names that same file as its entity", /entityType: "file",\s*entityId: fileId,/.test(received[0] ?? ""));

const page = codeOf(readFileSync("src/app/portal/(app)/jobs/[id]/page.tsx", "utf8"));
check("the job page opens for a reader who may list his own offers", /if \(!can\(actor, "offers\.list_own"\) && !can\(actor, "evidence\.review"\)\) notFound\(\);/.test(page));
check("and finds his live offer on that file to answer it there", /\(await listOffers\(actor\)\)\.find\(\(o\) => o\.file_id === view\.file\.id && o\.state === "offered"/.test(page));

const lost = ofKind("offer.lost");
check("both offer.lost notifications are still raised", lost.length === 2, `${lost.length} found`);
check("and both link the list, because a lost job does not open", lost.length === 2 && lost.every((r) => /href: "\/portal\/jobs",/.test(r)));

console.log("");
if (wrong === 0) {
  console.log("PASS: an offer notification opens the job it offers.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
