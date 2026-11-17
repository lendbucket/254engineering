/**
 * THE BELL SAYS A FAILED READ, AND A SIGNED-OUT PERSON COMES BACK TO THEIR PAGE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-bell-and-the-return-path-say-what-happened.mjs
 *
 * The two instances still open in the BACKLOG entry "screen reads that still
 * hide a failure" (fix/db-fetch-timeout, 2026-10-12), under the operator's
 * ruling that a failed or stalled read never renders as an empty state:
 *
 *   THE BELL. listNotifications discarded its error, and the layout read the
 *   folded unread count, so a failed read opened a panel saying "Nothing yet"
 *   on every staff screen. The layout now reads listNotificationsRead and
 *   unreadCountRead, both null on a failure, and the panel says the
 *   notifications could not be loaded.
 *
 *   THE RETURN PATH. The layout sent a cookie that no longer opens a session to
 *   the sign in with next taken from x-invoke-path, which Next 16 never sets,
 *   so next was always /portal. The proxy now stamps the path under
 *   PORTAL_PATH_HEADER and the layout reads it through returnPathFrom.
 *
 * returnPathFrom is exercised, not read: it is the one piece with a rule in
 * it, and the rule is about what it refuses. The wiring is read from source.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { PORTAL_PATH_HEADER, returnPathFrom } = await import("../../src/lib/portal-return-path.ts");
const layout = readFileSync("src/app/portal/(app)/layout.tsx", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
const chrome = readFileSync("src/components/portal/PortalChrome.tsx", "utf8");
const notify = readFileSync("src/lib/ops-notify.ts", "utf8");

/* ---------------------------------------------------------------- the bell */

const readBody = notify.slice(notify.indexOf("export async function listNotificationsRead("));
const readFn = readBody.slice(0, readBody.indexOf("\n}\n") + 2);
check("listNotificationsRead exists and takes the read's error", readFn.length > 0 && /const \{ data, error \} = await db/.test(readFn));
/* The line after the error is logged is the return: matched by line, because the log line itself carries a brace. */
check("and answers a failure with null, never an empty list", /if \(error\) \{\n[^\n]*\n\s*return null;/.test(readFn) && /if \(!db\) return null;/.test(readFn));
check("the layout reads the list through it", /await listNotificationsRead\(actor\.id, 12\)/.test(layout) && !/await listNotifications\(/.test(layout));
check("and the count through the read that can say null", /await unreadCountRead\(actor\.id\)/.test(layout) && !/await unreadCount\(/.test(layout));
check("a failed list reaches the bell as null", /notifications === null\s*\?\s*null/.test(layout));
check("the bell says the read failed, before it says there is nothing", (() => {
  const failed = chrome.indexOf("items === null ?");
  const empty = chrome.indexOf("items.length === 0 ?");
  return failed > 0 && empty > failed && /Your notifications could not be loaded\. This is not the same as having none\./.test(chrome);
})());
check("and a count that could not be read shows no number, never a zero", /unread !== null && unread > 0 \?/.test(chrome));

/* ------------------------------------------------------------- the billing */

/* The third open instance of the same entry: /portal/billing's panel of reviews that credited the engineer nothing. */
const billing = readFileSync("src/app/portal/(app)/billing/page.tsx", "utf8");
check("billing reads the reviews owed a credit through the read that can say null", /await uncreditedReviewsRead\(\)/.test(billing) && !/await uncreditedReviews\(\)/.test(billing));
check("and says the read failed, before it decides there is nothing to show", (() => {
  const failed = billing.indexOf("uncredited === null ?");
  const shown = billing.indexOf("uncredited.length > 0 ?");
  return failed > 0 && shown > failed && /The reviews still owed a credit could not be read/.test(billing);
})());

/* --------------------------------------------------------- the return path */

/* The CALL, not the name: the layout's comment says what it used to read, and naming a thing is not reading it. */
check("the layout no longer reads x-invoke-path", !/\.get\(\s*["']x-invoke-path["']\s*\)/.test(layout));
check("it reads the proxy's header through returnPathFrom", /returnPathFrom\(\(await headers\(\)\)\.get\(PORTAL_PATH_HEADER\)\)/.test(layout));
check("the proxy sets that header, set and not appended, on the request it lets through", /forwarded\.set\(PORTAL_PATH_HEADER, pathname\)/.test(proxy) && /NextResponse\.next\(\{ request: \{ headers: forwarded \} \}\)/.test(proxy));
check("the header has one name, a lowercase one", PORTAL_PATH_HEADER === PORTAL_PATH_HEADER.toLowerCase() && PORTAL_PATH_HEADER.length > 0);

const cases = [
  ["/portal/jobs/abc", "/portal/jobs/abc"],
  ["/portal", "/portal"],
  ["/portal?x=1", "/portal?x=1"],
  [null, "/portal"],
  ["", "/portal"],
  ["//evil.example/portal", "/portal"],
  ["https://evil.example/portal", "/portal"],
  ["/portalx", "/portal"],
  ["/portal/..\\evil", "/portal"],
  ["/account/orders", "/portal"],
];
const misses = cases.filter(([input, want]) => returnPathFrom(input) !== want);
check(
  "returnPathFrom keeps a portal path and turns anything else into /portal",
  misses.length === 0,
  misses.map(([input, want]) => `${JSON.stringify(input)} gave ${JSON.stringify(returnPathFrom(input))}, wanted ${want}`).join("; ") || `${cases.length} cases`,
);

console.log(wrong === 0 ? "PASS: the bell says a failed read, and the return path survives the sign in." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
