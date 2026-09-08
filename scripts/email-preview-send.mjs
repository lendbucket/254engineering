/**
 * SEND REAL TEMPLATES TO THE FIRM'S OWN INBOX, AND NOWHERE ELSE.
 *
 *   npx tsx --conditions=react-server scripts/email-preview-send.mjs            (all)
 *   npx tsx --conditions=react-server scripts/email-preview-send.mjs order.sealed order.confirmed
 *
 * WHY THIS EXISTS
 * ---------------
 * email-audit renders every template and checks it without a network, which is
 * what makes it fast enough to run in the suite. What it cannot tell you is what
 * Gmail does to the markup, whether the logo loads from a real client, whether
 * the navy band survives a dark mode inversion, or whether the whole thing
 * lands in spam. A screenshot of HTML in Chromium is not a rendered email, and
 * the operator's gate on this workstream is a real send.
 *
 * THE ONE SAFETY PROPERTY, AND IT IS NOT A CONVENIENCE
 * ----------------------------------------------------
 * Every template's own recipient is DISCARDED and replaced with the firm's
 * notification address. Several of these templates are addressed to customers,
 * applicants and technicians, and the audit fixtures carry sample addresses on
 * domains this firm does not own. A preview tool that honoured `to` would, the
 * first time somebody pointed it at a real rendered message, send a real
 * customer a duplicate of an email about their own order.
 *
 * The override is not a flag, because a flag is a thing somebody sets by
 * accident. There is no way to make this send anywhere else.
 *
 * IT REFUSES TO GUESS AT A TEMPLATE NAME. An argument that matches nothing is
 * an error naming what exists, rather than a run that quietly sends nothing and
 * reports success, which is this repository's recurring defect.
 */

/*
 * THE SAME ENVIRONMENT THE DEV SERVER READS.
 *
 * scripts/lib/db-target.mjs loads this file for the reason recorded there: a
 * tool that decides what it can do by consulting its own environment, while the
 * system it stands in for reads .env.local, is a tool measuring something else.
 * Without it this script reported "RESEND_API_KEY is not set" and skipped every
 * send while the key sat in the file next to it, which is a success
 * indistinguishable from nothing happening.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  /* Absent on a fresh clone. notify() then says the key is missing, which is
   * true and is the right message. */
}

import { business } from "../src/config/business.ts";

const { allTemplatesForAudit } = await import("../src/lib/email-templates.ts");
const { notify } = await import("../src/lib/notify.ts");

const RECIPIENT = business.notificationEmail;

const wanted = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const all = allTemplatesForAudit();
const known = [...new Set(all.map((t) => t.id))].sort();

if (wanted.length) {
  const unknown = wanted.filter((w) => !known.includes(w));
  if (unknown.length) {
    console.error(`\nNo such template: ${unknown.join(", ")}`);
    console.error(`\nThere are ${known.length}:\n  ${known.join("\n  ")}\n`);
    process.exit(1);
  }
}

const chosen = wanted.length ? all.filter((t) => wanted.includes(t.id)) : all;

console.log("");
console.log("========== SENDING REAL EMAIL ==========");
console.log("");
console.log(`  to:        ${RECIPIENT}   (every template, whatever it says)`);
console.log(`  templates: ${chosen.length} of ${all.length}`);
console.log(`  gate:      LAUNCH_MODE=${process.env.LAUNCH_MODE ?? "(unset, so prelaunch)"}`);
console.log("");

/*
 * A LINK THAT DOES NOT RESOLVE MAKES THE EMAIL WRONG, WHATEVER IT LOOKS LIKE.
 *
 * Operator ruling, and it was earned the hard way: the first real send of the
 * three customer templates went out carrying ?token=sample, because the audit
 * fixtures are the only rendered copies that exist without a live order. They
 * looked perfect and every link in them was inert. Somebody clicking "Track
 * this order" would have got the page that says the order cannot be found,
 * which is exactly the impression a firm cannot afford to give the person who
 * just paid it.
 *
 * A preview of a fixture is still worth sending, because the render is the
 * thing being judged. What is not acceptable is sending one WITHOUT SAYING SO,
 * so every message is classified and the inert links are named before the send.
 */
const FIXTURE_MARKERS = [/token=sample/i, /\bSAMPLE\b/, /sample@example\.com/i, /254-O2026-ABCDEF/];

function inertLinks(email) {
  const body = `${email.text}\n${email.html ?? ""}`;
  const links = [...new Set([...body.matchAll(/https:\/\/[^\s"<)]+/g)].map((m) => m[0]))];
  return links.filter((l) => FIXTURE_MARKERS.some((re) => re.test(l)));
}

let sent = 0;
const failed = [];
const fixtures = [];

for (const template of chosen) {
  /*
   * The recipient is replaced on a COPY. Mutating the rendered message would
   * work equally well here and would be a trap for whatever calls this next.
   */
  const inert = inertLinks(template);

  const result = await notify({ ...template, to: RECIPIENT });
  if (result.sent) {
    sent += 1;
    console.log(`  SENT   ${template.id}  ${template.subject}`);
    if (result.messageId) console.log(`         resend id ${result.messageId}`);
    if (inert.length) {
      fixtures.push(template.id);
      for (const l of inert) console.log(`         INERT LINK, goes nowhere: ${l}`);
    }
  } else {
    failed.push(`${template.id}: ${result.reason ?? result.outcome}`);
    console.log(`  FAILED ${template.id}  ${result.reason ?? result.outcome}`);
  }
}

console.log("");
if (failed.length) {
  console.log(`${sent} sent, ${failed.length} FAILED`);
  for (const f of failed) console.log(`  ${f}`);
  console.log("");
  process.exit(1);
}

console.log(`${sent} sent to ${RECIPIENT}.`);
console.log("");

if (fixtures.length) {
  console.log(`  ${fixtures.length} of these are FIXTURE renders: ${fixtures.join(", ")}`);
  console.log("  Their links go nowhere. Judge the design from them and nothing else;");
  console.log("  whether the links work is a separate question these cannot answer,");
  console.log("  because a fixture has no order behind it to link to.");
  console.log("");
}

console.log("A send is not a verification, and acceptance by Resend is not delivery.");
console.log("Open each one and look at it: the logo, the navy bands, the button, and");
console.log("what dark mode does to all three.");
console.log("");
