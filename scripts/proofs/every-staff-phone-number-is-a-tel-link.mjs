/**
 * EVERY PHONE NUMBER STAFF SEE IS A tel: LINK.
 *
 *   node scripts/proofs/every-staff-phone-number-is-a-tel-link.mjs
 *
 * Office ready, operator ruling of 2026-10-20: "Every phone number is a tel:
 * link." The 2026-10-24 survey found seven screens printing numbers as plain
 * text. This reads every portal page and component and fails on any phone
 * value printed into a string (a template or a join) rather than through
 * PhoneLink, JoinedWithPhone or telLink, which return plain text only for a
 * number that is not ten North American digits.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) ? [p] : [];
  });
const files = [...walk("src/app/portal"), ...walk("src/components/portal")];
check("the portal's screens and components were read", files.length > 50, `${files.length} files`);

/* A phone value printed into text: `${x.phone}`, a join list carrying x.phone, or {x.phone} alone in JSX. */
const PRINTED = [
  { what: "a template string", re: /\$\{\s*[\w.?]*\bphone\b[^}]*\}/i },
  { what: "a joined list", re: /\[[^\]]*\b[\w.]*\.(?:customer_)?phone\b[^\]]*\]\s*\.filter\(Boolean\)\.join/i },
  { what: "a bare JSX value", re: /\{\s*[\w.]+\.(?:customer_)?phone\s*\}/i },
];
/*
 * TWO PLACES A NUMBER IS RIGHTLY TEXT, told apart by a property of the markup
 * rather than by a list of files: the text of an <a> that already dials (a
 * href within the three lines above), and a number inside a <button>, where a
 * link would be invalid HTML and steal the click. Each is counted and named.
 */
const offenders = [];
const insideLink = [];
const insideButton = [];
for (const f of files) {
  if (/PhoneLink\.tsx$/.test(f)) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    if (/telLink|PhoneLink|JoinedWithPhone|href=|placeholder|aria-|htmlFor|\.trim\(\)|value=\{|defaultValue|setPhone|phone:|\bphone =|=== |label/.test(line)) return;
    const hit = PRINTED.find((p) => p.re.test(line));
    if (!hit) return;
    const near = lines.slice(Math.max(0, i - 3), i).join("\n");
    /* A button's opening tag can carry many lines of attributes and a handler, so its look back is twelve lines, stopping at a close. */
    const enclosing = lines.slice(Math.max(0, i - 12), i).join("\n");
    const at = `${f}:${i + 1}`;
    if (/href=\{href\}|href=\{tel/.test(near)) insideLink.push(at);
    else if (/<button\b/.test(enclosing) && !/<\/button>/.test(enclosing.slice(enclosing.lastIndexOf("<button")))) insideButton.push(at);
    else offenders.push(`${at} (${hit.what})`);
  });
}
check("no portal screen prints a phone number as plain text", offenders.length === 0, offenders.slice(0, 6).join("; "));
console.log(`     (text of a link that already dials: ${insideLink.length}; inside a button, where a link is invalid: ${insideButton.length}, ${insideButton.join(", ")})`);

const named = ["clients/page.tsx", "search/page.tsx", "inquiries/page.tsx", "windstorm-inquiries/page.tsx", "techs/page.tsx", "onboarding/page.tsx"];
const missing = named.filter((n) => !/PhoneLink|JoinedWithPhone/.test(readFileSync(join("src/app/portal/(app)", n), "utf8")));
check("the six screens the survey named each dial through PhoneLink", missing.length === 0, missing.join(", "));

/*
 * AND A NUMBER THE PLATFORM STORED READS AS A PERSON WRITES IT (2026-11-12).
 * The franchise walk found a franchisee's office printed "+13615550142",
 * because 0126 stores it in E.164 and PhoneLink printed it as stored. Only that
 * stored shape is rewritten; a typed number is printed as typed.
 */
{
  const { phoneForReading } = await import("../../src/lib/phone-link.ts");
  check("a stored E.164 number reads as (361) 555-0142", phoneForReading("+13615550142") === "(361) 555-0142", phoneForReading("+13615550142"));
  check("and with stray spaces around it", phoneForReading(" +13615550142 ") === "(361) 555-0142");
  for (const typed of ["(361) 555-0142", "361.555.0142", "3615550142", "+447700900123", "ext 12"]) {
    check(`a number typed as "${typed}" is printed as typed`, phoneForReading(typed) === typed, phoneForReading(typed));
  }
  const link = readFileSync("src/components/portal/PhoneLink.tsx", "utf8");
  check("PhoneLink's link text is phoneForReading of the number, its href telLink's", /\{phoneForReading\(phone\)\}/.test(link) && /const href = telLink\(phone\);/.test(link));
}

console.log("");
if (wrong === 0) {
  console.log("PASS: every phone number staff see is a tel: link.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
