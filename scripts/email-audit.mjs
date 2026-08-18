// Email audit. Renders every outbound template and checks it the way the site's
// own copy is checked.
//
//   npm run email-audit
//
// WHY THIS SURFACE NEEDED ITS OWN AUDIT
// -------------------------------------
// The site has five harnesses reading its rendered HTML and the outbound email
// had none, which made it the only prose a customer receives that nobody
// measures. Worse, it is the prose most likely to drift: nobody reads a
// notification template as writing, so a banned phrase or a relative link sits
// there indefinitely and is only noticed by the person it was sent to.
//
// The templates are pure functions in src/lib/email-templates.ts, so this runs
// with no network, no API key, and no send.
//
// WHAT IS CHECKED, AND THE ONE THING THAT CANNOT BE
// --------------------------------------------------
//   voice           The same banned phrase list the site copy is held to, from
//                   scripts/lib/voice-blocklist.mjs. One definition of good
//                   writing across both surfaces.
//   style laws      Em and en dashes, and emoji. placeholder-audit enforces
//                   these on rendered HTML and cannot see an email, so this is
//                   composition rather than duplication.
//   absolute links  A relative path in an email is dead text.
//   plaintext part  Present and non-empty on every template.
//   375px render    NOT APPLICABLE and reported as such. These templates have no
//                   HTML part by design, and a width check on plain text would
//                   be a green light for a measurement that never happened.
import { allTemplatesForAudit } from "../src/lib/email-templates.ts";
import { context, findBannedPhrases } from "./lib/voice-blocklist.mjs";

const LONG_DASH = /[‒–—―]/;
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}]/u;
const PRODUCTION_ORIGIN = "https://254engineering.com";

/** Subject lines get truncated in a phone notification well before this. */
const MAX_SUBJECT = 78;

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const recSkip = (name, note) => out.push({ name, ok: true, skipped: true, note });

const templates = allTemplatesForAudit();

if (templates.length === 0) {
  console.error("email-audit: no templates returned; refusing to report a pass on zero templates.");
  process.exitCode = 1;
}

for (const t of templates) {
  const label = t.id;
  const whole = `${t.subject}\n${t.text}`;

  rec(`${label}: has a non-empty plaintext part`, typeof t.text === "string" && t.text.trim().length > 0);
  rec(`${label}: has a subject`, typeof t.subject === "string" && t.subject.trim().length > 0);
  rec(
    `${label}: subject fits a phone preview`,
    t.subject.length <= MAX_SUBJECT,
    `${t.subject.length} chars`,
  );

  const banned = findBannedPhrases(whole);
  rec(
    `${label}: no banned phrases`,
    banned.length === 0,
    banned.map((b) => `${b.why}: ${context(whole, b.index)}`).join("; "),
  );

  rec(`${label}: no em or en dashes`, !LONG_DASH.test(whole));
  rec(`${label}: no emoji`, !EMOJI.test(whole));

  // Every link has to be absolute and point at production. A bare path is not a
  // link in an email client, and a localhost URL in a template is a template
  // somebody tested and shipped.
  const urls = [...whole.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => m[0]);
  const badOrigin = urls.filter(
    (u) => !u.startsWith(PRODUCTION_ORIGIN) && !u.startsWith("https://www.google.com/"),
  );
  rec(
    `${label}: every URL is absolute and points at production`,
    badOrigin.length === 0,
    badOrigin.join(", "),
  );

  // A path that looks like a link but is not one. The referrer and page fields
  // legitimately carry bare paths as DATA, so only lines that read as a call to
  // action are checked.
  const fakeLink = whole
    .split("\n")
    .filter((line) => /\b(?:click|visit|open|see)\b/i.test(line) && /(?:^|\s)\/[a-z]/.test(line));
  rec(`${label}: no relative path offered as a link`, fakeLink.length === 0, fakeLink.join(" | "));

  rec(
    `${label}: reply-to is set so a reply reaches the sender`,
    typeof t.replyTo === "string" && t.replyTo.includes("@"),
    t.replyTo ?? "none",
  );

  if (t.html) {
    rec(`${label}: HTML part present, needs a 375px render check`, false, "add the render step");
  } else {
    recSkip(
      `${label}: 375px render`,
      "no HTML part by design; these are plain text operator notifications",
    );
  }
}

console.log("=== EMAIL AUDIT ===");
console.log(`${templates.length} templates rendered\n`);
for (const r of out) {
  const state = r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL";
  console.log(`  ${state}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
const fails = out.filter((r) => !r.ok);
const skips = out.filter((r) => r.skipped);
const ran = out.length - skips.length;
console.log(`\n${ran - fails.length}/${ran} pass${skips.length ? `, ${skips.length} skipped` : ""}`);
process.exitCode = fails.length ? 1 : 0;
