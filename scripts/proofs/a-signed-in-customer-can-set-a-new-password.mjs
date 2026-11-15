/**
 * A SIGNED IN CUSTOMER CAN SET A NEW PASSWORD. Walk 2, 2026-11-15.
 *
 * /account/forgot-password redirected a live session to /account/settings, on
 * the reasoning that such a visitor "wanted their settings, not this". Settings
 * has no password control and nothing else in the account had one, while the
 * account page's Sessions section said "setting a new password does the same".
 * A signed in customer who wanted a new password had to sign out to find the
 * only form that sends one.
 *
 * What must hold:
 *   1. The recovery page serves a signed in visitor: it reads no session and
 *      redirects nowhere.
 *   2. The account page links the recovery page, in its Sessions section,
 *      beside the sentence that names setting a new password.
 *   3. The page the emailed link opens, /account/set-password, does not turn a
 *      signed in visitor away either, so the path holds end to end.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const codeOf = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

const forgot = codeOf(readFileSync("src/app/account/forgot-password/page.tsx", "utf8"));
check("the recovery page redirects nobody", !/\bredirect\(/.test(forgot));
check("and reads no session to decide whether to", !/currentCustomer\(/.test(forgot));
check("it still renders the recovery form", /<ForgotPasswordForm\b/.test(forgot));

const account = codeOf(readFileSync("src/app/account/page.tsx", "utf8"));
const sessions = account.slice(account.indexOf(">\n            Sessions\n"), account.indexOf("</section>", account.indexOf(">\n            Sessions\n")));
check("the account page has a Sessions section", sessions.length > 0);
check("which names setting a new password", /setting a new password/.test(sessions));
check("and links the recovery page from that section", /href="\/account\/forgot-password"/.test(sessions));

const setPw = readFileSync("src/app/account/set-password/page.tsx", "utf8");
check("the emailed link's page turns no signed in visitor away", !/\bredirect\(/.test(codeOf(setPw)));

console.log("");
if (wrong === 0) {
  console.log("PASS: a signed in customer can set a new password.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
