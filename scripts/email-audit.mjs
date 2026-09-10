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
import { allTemplatesForAudit, MARKETING_TEMPLATES } from "../src/lib/email-templates.ts";
import { readSource } from "./lib/read-source.mjs";
import { business } from "../src/config/business.ts";
import { context, findBannedPhrases } from "./lib/voice-blocklist.mjs";

const LONG_DASH = /[‒–—―]/;
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}]/u;
const PRODUCTION_ORIGIN = "https://254engineering.com";

/** Subject lines get truncated in a phone notification well before this. */
const MAX_SUBJECT = 78;

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { emailIdentity, fromHeader, signatureLines, FROM_DISPLAY_NAME, REPLY_TO, REPLY_TO_EXCEPTIONS } from "../src/config/email-identity.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const templates = allTemplatesForAudit();

if (templates.length === 0) {
  console.error("email-audit: no templates returned; refusing to report a pass on zero templates.");
  process.exitCode = 1;
}

/* ------------------------------------------------------------------------ */
/* THE INVENTORY IS DERIVED, NOT LISTED.                                     */
/*                                                                          */
/* allTemplatesForAudit() is a list somebody maintains by hand, and a list   */
/* somebody maintains by hand stops describing the system the first time     */
/* somebody forgets. That already happened: three customer templates were    */
/* written, wired and shipped while this audit's count sat at 352, and the   */
/* only symptom was a number that did not move. Nothing failed, because      */
/* nothing was looking.                                                      */
/*                                                                          */
/* So the set of templates that EXIST is read from the source, the same way  */
/* surface-audit reads scripts/lib/surfaces.mjs, and a template that exists  */
/* and is not rendered here is a failure rather than a discovery.            */
/*                                                                          */
/* Every id is the first argument to compose(), which is the one function    */
/* every template goes through. Read as an expression rather than a literal, */
/* because leadNotification picks its id with a ternary and a regex for a    */
/* bare string would silently miss both halves of it.                        */
/* ------------------------------------------------------------------------ */
{
  const source = readSource("src/lib/email-templates.ts");
  const declared = new Set();

  for (let i = source.indexOf("compose("); i !== -1; i = source.indexOf("compose(", i + 1)) {
    /* Walk to the comma that ends the first argument, tracking depth so a
     * nested call or object does not end it early. */
    let depth = 1;
    let j = i + "compose(".length;
    let firstArg = "";
    for (; j < source.length && depth > 0; j += 1) {
      const c = source[j];
      if (c === "(" || c === "{" || c === "[") depth += 1;
      else if (c === ")" || c === "}" || c === "]") depth -= 1;
      if (depth === 1 && c === ",") break;
      if (depth > 0) firstArg += c;
    }
    for (const m of firstArg.matchAll(/"([a-z0-9_]+\.[a-z0-9_]+)"/g)) declared.add(m[1]);
  }

  const measured = new Set(templates.map((t) => t.id));
  const unmeasured = [...declared].filter((d) => !measured.has(d)).sort();
  const phantom = [...measured].filter((m) => !declared.has(m)).sort();

  rec(
    `the template inventory was derived from the source (${declared.size} found)`,
    declared.size >= measured.size && declared.size > 5,
    declared.size <= 5 ? "parsing found almost nothing, so the check below is measuring nothing" : "",
  );

  rec(
    "every template that exists is rendered by this audit",
    unmeasured.length === 0,
    unmeasured.length
      ? `NOT MEASURED: ${unmeasured.join(", ")}. Add them to allTemplatesForAudit.`
      : `${measured.size} of ${declared.size}`,
  );

  rec(
    "and this audit renders nothing that does not exist",
    phantom.length === 0,
    phantom.length ? `fixture with no template: ${phantom.join(", ")}` : "",
  );

  /*
   * NO TRANSACTIONAL EMAIL CARRIES AN UNSUBSCRIBE.
   *
   * Operator ruling, and it is standing law rather than a style preference. A
   * receipt is not marketing: somebody who paid for a sealed document is owed
   * the confirmation, the outcome and the refund arithmetic whatever their
   * marketing preference says. A footer offering to switch those off would be
   * offering something this firm must not honour, and the first person to click
   * it would stop receiving news about their own money.
   *
   * The split is declared in email-templates.ts rather than here, so the
   * application and the audit cannot disagree about which is which.
   */
  const marketing = new Set(MARKETING_TEMPLATES);
  const leaked = templates
    .filter((t) => !marketing.has(t.id))
    .filter((t) => /unsubscribe|opt.?out|manage (your )?preferences/i.test(`${t.text}\n${t.html ?? ""}`))
    .map((t) => t.id);

  /*
   * ONE FIRM, ONE NAME, ONE MAILBOX TO REPLY TO.
   *
   * Operator ruling, 2026-09-08. Every message is FROM "254 Engineering" and
   * replies to the firm's support mailbox. The From name takes no exceptions at
   * all; Reply-To takes the seven declared in email-identity.ts, each carrying
   * its reason, and a template that quietly adds itself to that behaviour fails
   * here.
   *
   * ceo@36west.org is checked separately and over the whole message rather than
   * just the headers. It was the human sender's reply-to until this ruling, it
   * is a mailbox on a domain this firm does not own, and the way it would come
   * back is somebody hardcoding it into a body rather than into a header.
   */
  /*
   * THE EXPECTED HEADERS ARE WRITTEN OUT HERE, NOT IMPORTED, AND THAT IS THE
   * WHOLE POINT.
   *
   * The first version of this check compared every template's From against
   * FROM_DISPLAY_NAME, the same constant the templates are built from. It
   * compared a value to itself and could not disagree with anything: the
   * injection test changed the constant to the old personal name and the check
   * reported PASS on the new wrong value, in its own words.
   *
   * An audit that imports its expectation from the thing it is auditing is not
   * an audit. So the ruled values are stated here as literals, this file
   * disagrees with the config when the config changes, and somebody editing
   * either has to come and edit the other on purpose. That duplication is the
   * mechanism, not an oversight; roles-audit derives its expectations
   * independently for the same reason.
   */
  const EXPECTED_FROM = "254 Engineering <notifications@254engineering.com>";
  const EXPECTED_REPLY_TO = "support@254engineering.com";

  /* And the config still has to agree with the ruling, said separately so a
   * drifted constant is named as a drifted constant. */
  rec(
    "the sender config states the ruled name and mailbox",
    `${FROM_DISPLAY_NAME} <notifications@${business.domain}>` === EXPECTED_FROM &&
      REPLY_TO === EXPECTED_REPLY_TO,
    `config says ${FROM_DISPLAY_NAME} / ${REPLY_TO}`,
  );

  const wrongFrom = templates
    .filter((t) => t.from !== EXPECTED_FROM)
    .map((t) => `${t.id} (${t.from})`);

  rec(
    `every template is FROM ${EXPECTED_FROM} (${templates.length} checked)`,
    wrongFrom.length === 0,
    wrongFrom.length ? wrongFrom.join(", ") : "",
  );

  const wrongReplyTo = templates
    .filter((t) => !(t.id in REPLY_TO_EXCEPTIONS))
    .filter((t) => t.replyTo !== EXPECTED_REPLY_TO)
    .map((t) => `${t.id} replies to ${t.replyTo ?? "(nothing)"}`);

  rec(
    `every template replies to ${EXPECTED_REPLY_TO} unless it says why (${Object.keys(REPLY_TO_EXCEPTIONS).length} exceptions)`,
    wrongReplyTo.length === 0,
    wrongReplyTo.length ? wrongReplyTo.join(", ") : "",
  );

  /* An exception naming a template that no longer exists is an exemption
   * outliving the thing it exempted, which is how an allowlist rots. */
  const staleExceptions = Object.keys(REPLY_TO_EXCEPTIONS).filter((id) => !measured.has(id));
  rec(
    "and every declared reply-to exception names a real template",
    staleExceptions.length === 0,
    staleExceptions.length ? `no such template: ${staleExceptions.join(", ")}` : "",
  );

  const leakedOwner = templates
    .filter((t) =>
      `${t.from}\n${t.replyTo ?? ""}\n${t.to ?? ""}\n${t.subject}\n${t.text}\n${t.html ?? ""}`.includes(
        "ceo@36west.org",
      ),
    )
    .map((t) => t.id);

  rec(
    "no template carries ceo@36west.org anywhere",
    leakedOwner.length === 0,
    leakedOwner.length ? `${leakedOwner.join(", ")}, and it is not a 254 address` : "",
  );

  /*
   * A SUPPRESSED ADDRESS STILL GETS ITS RECEIPT.
   *
   * Operator ruling, and it is the defect the whole marketing split exists to
   * prevent: a customer unsubscribes from announcements, then pays for a sealed
   * document and never hears what happened to it or to their money.
   *
   * Asserted on the SOURCE rather than by sending, because the claim is an
   * absence. There is no call to make that would prove a transactional path
   * does not consult the suppression list; what proves it is that no
   * transactional module imports the module that would answer. The one
   * legitimate reader is the announcement path.
   *
   * The same shape as mfa-audit's caller allowlist and for the same reason: the
   * question "who is allowed to ask this" is answerable from the imports and
   * nowhere else.
   */
  /*
   * TWO LISTS SINCE 2026-09-09, AND THE SPLIT MAKES THIS CHECK SHARPER RATHER
   * THAN LOOSER.
   *
   * Phase 12 Section 2 built the operator screen for the list, so a request
   * made on the telephone can be recorded without somebody writing SQL against
   * production. That screen and its route import the module, and this check
   * went red on both, correctly: as written it asked "who imports the module",
   * and the answer had grown.
   *
   * Adding two entries to one list would have answered the failure and weakened
   * the guarantee, turning "the one legitimate reader is the announcement path"
   * into a list that grows whenever somebody needs it to.
   *
   * The real claim is narrower than the module. `isSuppressed` is the GATE, the
   * function a send path would call to decide whether to write to somebody, and
   * it is the one that must never be reachable from a transactional send.
   * Everything else in the module manages the list: reading it to show it,
   * recording a request, correcting a mistyped row, building an unsubscribe
   * URL. None of those can suppress a receipt.
   *
   * So the gate has its own allowlist of one, which is stricter than before,
   * and managing the list is allowed from the operator surface that exists to
   * manage it.
   */
  const SUPPRESSION_GATE = "isSuppressed";
  const SUPPRESSION_GATE_READERS = [
    /* The one path that consults it to decide whether to SEND. */
    "src/lib/ops-announce.ts",
    /* And the public unsubscribe page, which sends nothing at all: it asks so
     * it can tell somebody who follows the link twice that they are already
     * off the list, rather than thanking them for a second time as though the
     * first had not worked. Verified rather than assumed: the file imports no
     * send, no compose and no queue. */
    "src/app/(site)/unsubscribe/page.tsx",
  ];

  const SUPPRESSION_READERS = [
    "src/lib/ops-announce.ts",
    "src/app/(site)/unsubscribe/page.tsx",
    /* The operator screen for the list, and the route behind it. Neither sends
     * anything and neither imports the gate. */
    "src/app/portal/(app)/suppressions/page.tsx",
    "src/app/api/portal/suppressions/route.ts",
    /*
     * And the deletion request module, which WRITES to the list and never
     * reads the gate.
     *
     * Somebody asking to be forgotten has unambiguously asked not to be
     * written to, and stopping marketing is the one part of that the firm can
     * do immediately and without a ruling from counsel. So recording a request
     * suppresses the address in the same motion.
     *
     * It is a WRITER rather than a gate reader, and the split above is what
     * makes that distinction assertable: a transactional send must never
     * consult this list, and this file does not, because somebody who asked
     * to be forgotten is still owed the receipt for what they already paid
     * for.
     */
    "src/lib/deletion-requests.ts",
  ];

  const readers = [];
  const gateReaders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name).split("\\").join("/");
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const src = readSource(full);
        const imports = src.match(/import\s*\{([^}]*)\}\s*from\s*"[^"]*marketing-suppression"/);
        if (imports) {
          readers.push(full);
          if (imports[1].split(",").some((n) => n.trim() === SUPPRESSION_GATE)) gateReaders.push(full);
        } else if (/from "[^"]*marketing-suppression"/.test(src)) {
          /* A namespace or default import reaches everything, including the
           * gate, so it counts as both rather than slipping past the split. */
          readers.push(full);
          gateReaders.push(full);
        }
      }
    }
  };
  walk("src");

  const unexpected = readers.filter((r) => !SUPPRESSION_READERS.includes(r)).sort();
  const unexpectedGate = gateReaders.filter((r) => !SUPPRESSION_GATE_READERS.includes(r)).sort();

  /*
   * THE GATE FIRST, BECAUSE IT IS THE ONE THAT COSTS SOMEBODY A RECEIPT.
   */
  rec(
    `only the announcement path can ask whether an address is suppressed (${gateReaders.length} caller)`,
    unexpectedGate.length === 0 && gateReaders.length >= 1,
    unexpectedGate.length
      ? `${unexpectedGate.join(", ")} imports ${SUPPRESSION_GATE}. A transactional send must never consult it: somebody who unsubscribed from announcements is still owed their receipt.`
      : gateReaders.length === 0
        ? `nothing imports ${SUPPRESSION_GATE} at all, so the announcement path is not consulting the list either`
        : "",
  );

  /*
   * A VOIDED ROW MUST STOP COUNTING IN THE GATE, AND NOWHERE ELSE WILL DO.
   *
   * 0032 made a consent record undeletable and broke the one screen that had a
   * Remove action, for the narrow case of an operator mistyping an address on a
   * telephone call. 0034 keeps the row and marks it instead, which is better
   * than the delete it replaces because a deleted typo left no trace that
   * anybody had mistyped.
   *
   * The consequence is that the row has to stop counting SOMEWHERE, and there
   * is exactly one right place: isSuppressed, which is the only thing that asks
   * whether an address is suppressed. Put the filter on the screen instead and
   * the list looks corrected while the customer goes on hearing nothing, which
   * is the failure with a person attached.
   *
   * Asserted against the source of the gate rather than against a live row,
   * because the live half of this belongs to the suppression proof and this
   * audit's job is that the gate is shaped right.
   */
  {
    const src = readSource("src/lib/marketing-suppression.ts");
    const gate = src.slice(src.indexOf("export async function isSuppressed"));
    const body = gate.slice(0, gate.indexOf("\n}"));

    rec(
      "the suppression gate ignores a row somebody marked as a typing mistake",
      /\.is\("voided_at", null\)/.test(body),
      "0034 keeps a mistyped suppression rather than deleting it, so the gate is the one place it can stop counting",
    );

    /*
     * A VOID CANNOT LOSE THE REQUEST IT IS CORRECTING.
     *
     * Operator ruling at gate 2, and the failure it prevents is invisible: the
     * caller asked not to be contacted, the address was typed wrong, and
     * voiding the wrong row on its own un-suppresses somebody who never asked
     * while leaving the actual request nowhere. The list ends up accurate about
     * a mistake and silent about the thing the mistake was about.
     *
     * The schema refuses a void that names neither a replacement nor a reason
     * there is none, so this is not the guard. What this asserts is that the
     * APPLICATION cannot call the void without deciding, which is what makes
     * the refusal a sentence somebody reads rather than a database error at the
     * end of a telephone call.
     */
    const voidFn = src.slice(src.indexOf("export async function voidOperatorEntry"));
    const signature = voidFn.slice(0, voidFn.indexOf("): Promise"));

    rec(
      "voiding a suppression requires deciding what was meant instead",
      /replacement: VoidReplacement/.test(signature) && !/replacement\?:/.test(signature),
      "not optional and with no default, because a default would make the case that loses a request the easy one",
    );

    rec(
      "and the replacement is suppressed before the void, not after",
      voidFn.indexOf("await suppress(") !== -1 &&
        voidFn.indexOf("await suppress(") < voidFn.indexOf(".update({"),
      "if it went second, a failure would leave the list saying nothing rather than saying something wrong, and a lost request is the one nobody can see",
    );

    rec(
      "and nothing in the module deletes from the suppression list any more",
      !/from\("eng_marketing_suppressions"\)\s*\n?\s*\.delete\(\)/.test(src) && !/\.delete\(\)/.test(src),
      "0032 refuses it at the database; a call that would be refused is a screen that reports a failure to somebody who took a telephone call",
    );
  }

  rec(
    `and only declared surfaces read the suppression list at all (${readers.length} readers)`,
    unexpected.length === 0 && readers.length >= 2,
    unexpected.length
      ? `${unexpected.join(", ")} reads it. Managing the list is allowed from the operator surface built for it; anything else has to be argued for.`
      : "",
  );

  /*
   * And the positive half, because "nothing imports it" would also be true if
   * the module were deleted. The two named readers must actually be there.
   */
  const missingReaders = SUPPRESSION_READERS.filter((r) => !readers.includes(r));
  rec(
    "and the paths that should read it do",
    missingReaders.length === 0,
    missingReaders.length ? `not reading it: ${missingReaders.join(", ")}` : "",
  );

  rec(
    `no transactional template offers an unsubscribe (${templates.length - marketing.size} checked)`,
    leaked.length === 0,
    leaked.length
      ? `${leaked.join(", ")} carries one, and a receipt is not marketing`
      : marketing.size === 0
        ? "no marketing templates exist yet, so every template was checked"
        : `${marketing.size} marketing template(s) exempt`,
  );
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

  /*
   * The branded HTML part.
   *
   * This block used to be a tripwire: any template that grew an HTML part failed
   * on purpose, with the note "add the render step", so that a branded email
   * could not ship before somebody wrote the check for it. This is that check.
   */
  rec(`${label}: has an HTML part`, typeof t.html === "string" && t.html.length > 0);
  if (!t.html) continue;

  // The logo, by absolute production URL. Never a CID attachment and never a
  // data URI: one arrives as a mystery file, the other is stripped by Gmail.
  rec(
    `${label}: logo served from the production domain`,
    t.html.includes(`src="${PRODUCTION_ORIGIN}/brand/`),
  );
  rec(`${label}: logo is not a data URI or attachment`, !/src="(data:|cid:)/.test(t.html));

  /*
   * The right logo for the band it sits on.
   *
   * The header band is navy, so the reverse artwork is the correct one. The
   * light variant on navy is navy on navy and invisible, which is the exact
   * defect the site's own hero shipped once and no contrast tool caught.
   */
  const onNavyBand = /background:#14315d;padding:22px 28px;">\s*<img[^>]*logo-dark\.png/.test(
    t.html.replace(/\n/g, ""),
  );
  rec(`${label}: reverse logo variant on the navy header band`, onNavyBand);

  // Sized in the attribute AND the style, because Outlook honours one and Gmail
  // the other, and an unsized image in an email renders at its intrinsic width.
  rec(
    `${label}: logo has explicit width in both the attribute and the style`,
    /<img[^>]*width="\d+"[^>]*style="[^"]*width:\d+px/.test(t.html),
  );

  rec(`${label}: 600px maximum width`, t.html.includes("max-width:600px"));
  rec(`${label}: inline styles rather than a style block`, !/<style[\s>]/i.test(t.html));

  /*
   * Identity, checked against literals rather than against the config the
   * templates are built from.
   *
   * These two lines used to read `t.from === fromHeader(t.purpose)` and
   * `t.from.startsWith(sender.displayName + " <")`. Both compared a value to
   * itself and were harmless only because a separate check above pins every
   * template's From to a literal; delete that one line and these silently stopped
   * meaning anything. The rule is recorded in CLAUDE.md: an audit never imports
   * its expectation from the thing it audits.
   */
  rec(`${label}: From is the ruled sender`, t.from === "254 Engineering <notifications@254engineering.com>", t.from);
  rec(
    `${label}: From carries a display name, not a bare address`,
    /^[^<]+ <[^>]+@[^>]+>$/.test(t.from),
    t.from,
  );

  /*
   * The signature, and the version of this check that could not fail.
   *
   * It used to assert that the rendered signature matched signatureLines().
   * Changing the signer's name in the config to "Somebody Else" left it passing,
   * because the template renders FROM that config: both sides of the comparison
   * moved together and the assertion was a tautology. Caught by injection.
   *
   * What can actually go wrong is structural, and it is checked here: a human
   * facing template that forgets to ask for a signature at all. The other real
   * risk, a template hardcoding a name instead of reading the config, is a
   * source level question and is checked once below rather than per template.
   */
  const sig = signatureLines();
  if (t.purpose === "human") {
    const missing = sig.filter((line) => !t.html.includes(line) || !t.text.includes(line));
    rec(
      `${label}: signature block present in both parts`,
      missing.length === 0,
      missing.join(", "),
    );
  } else {
    // An operator notification is machine to operator. Nobody signs a message to
    // themselves, and a signature there would be the firm introducing itself to
    // the person who runs it.
    rec(
      `${label}: operator notification is not signed`,
      !t.html.includes(emailIdentity.signer.title),
    );
  }

  /*
   * THE EMPTY STRING HOLE, WHICH THIS FILE HAS ALREADY BEEN BITTEN BY ONCE.
   *
   * `includes(business.email)` is unconditionally true when business.email is
   * the empty string, so a config that lost its contact address would produce a
   * footer with no address and a green board. observability-audit records the
   * identical trap for release(): it was passing off a developer machine by
   * comparing "" to "".
   *
   * So the value is asserted non-empty BEFORE anything is matched against it,
   * and the address is separately pinned to a literal, because which mailbox
   * appears in the footer of every email this firm sends is a decision rather
   * than a detail.
   */
  rec(
    `${label}: the contact address is a real value before it is searched for`,
    typeof business.email === "string" && business.email.trim().length > 0,
    business.email,
  );
  rec(
    `${label}: footer carries the contact address and the site`,
    business.email.trim().length > 0 &&
      t.html.includes(business.email) &&
      t.html.includes(PRODUCTION_ORIGIN),
  );
}

/*
 * The compliance line, in both launch modes.
 *
 * The footer states the registration status through the same registrationLine()
 * the site footer uses, so one environment variable moves both surfaces. Testing
 * one mode would only prove the mode the audit happens to run in, and the
 * dangerous direction is the one nobody runs: a live build still telling
 * candidates the registration is pending, or a prelaunch build quietly dropping
 * the disclosure from every email the firm sends.
 *
 * Templates are re-rendered per mode rather than reused, because the line is
 * read at render time.
 *
 * LIVE MODE NEEDS THE CREDENTIALS, NOT JUST THE FLAG
 * ---------------------------------------------------
 * The first version of this check set LAUNCH_MODE=live and nothing else, and it
 * failed on all four templates. The code was right and the check was wrong:
 * tbpelsFirmNumber() returns null without TBPELS_FIRM_NUMBER whatever the mode,
 * so registrationLine() correctly kept saying pending. Live mode is the flag AND
 * the credentials, which is exactly how scripts/launch-audit.mjs sets it up, and
 * the same fixture values are used here so the two audits describe the same
 * state.
 */
{
  const original = {
    LAUNCH_MODE: process.env.LAUNCH_MODE,
    TBPELS_FIRM_NUMBER: process.env.TBPELS_FIRM_NUMBER,
    TBPELS_PE_LICENSE: process.env.TBPELS_PE_LICENSE,
  };
  const PENDING = "Firm registration pending";
  const seen = {};

  for (const mode of ["prelaunch", "live"]) {
    process.env.LAUNCH_MODE = mode;
    process.env.TBPELS_FIRM_NUMBER = mode === "live" ? "AUDIT-FIXTURE-NOT-A-REAL-NUMBER" : "";
    process.env.TBPELS_PE_LICENSE = mode === "live" ? "AUDIT-FIXTURE-NOT-A-REAL-LICENCE" : "";
    // A fresh import per mode: the module graph caches, so the query string is
    // what forces the template functions to be re-evaluated with the new env.
    const mod = await import(`../src/lib/email-templates.ts?mode=${mode}`);
    seen[mode] = mod.allTemplatesForAudit();
  }
  Object.assign(process.env, original);

  for (const t of seen.prelaunch) {
    rec(
      `${t.id}: prelaunch footer states the registration is pending`,
      (t.html || "").includes(PENDING) && t.text.includes(PENDING),
    );
  }
  for (const t of seen.live) {
    rec(
      `${t.id}: live footer drops the pending disclosure`,
      !(t.html || "").includes(PENDING) && !t.text.includes(PENDING),
    );
    // Not merely absent. An empty footer would satisfy the line above, so the
    // positive claim is asserted too.
    rec(
      `${t.id}: live footer states the firm registration number`,
      (t.html || "").includes("TBPELS Firm No.") && t.text.includes("TBPELS Firm No."),
    );
  }
}

/*
 * The 375px render.
 *
 * An email is read on a phone. A 600px table that does not collapse produces
 * exactly the sideways drag this firm just spent a workstream removing from the
 * site, except in a client where the reader cannot do anything about it.
 *
 * Measured the same way the site is: scrollWidth against clientWidth, never
 * against innerWidth, because the layout viewport expands to contain overflow
 * and the two would move together. That comparison shipped once already.
 */
{
  const browser = await chromium.launch();
  for (const width of [375, 600]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    for (const t of templates) {
      if (!t.html) continue;
      const page = await ctx.newPage();
      await page.setContent(t.html, { waitUntil: "domcontentloaded" });
      const m = await page.evaluate(() => ({
        sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        cw: document.documentElement.clientWidth,
      }));
      rec(
        `${t.id}: renders at ${width}px with no horizontal overflow`,
        m.sw - m.cw <= 1,
        `${m.sw} vs ${m.cw}`,
      );
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}

/*
 * No template hardcodes an identity.
 *
 * This is the half of the signature question that a rendered comparison cannot
 * answer. If a template writes "Robert Reyna" into its own copy, the rendered
 * output still matches the config today and silently stops matching on the day
 * the config changes. Read the source instead: the names and titles belong in
 * src/config/email-identity.ts and nowhere else.
 */
{
  const sources = ["src/lib/email-templates.ts", "src/lib/email-layout.ts"];
  const identityStrings = [emailIdentity.signer.name, emailIdentity.signer.title];
  for (const file of sources) {
    const text = readSource(file);
    const found = identityStrings.filter((v) => text.includes(v));
    rec(
      `${file}: does not hardcode a name or title from the identity config`,
      found.length === 0,
      found.join(", "),
    );
  }
}

// ===========================================================================
// A LINK IS SIGNED WHEN THE MESSAGE GOES OUT, NEVER WHEN IT IS COMPOSED.
//
// Operator ruling, 2026-09-09, after reading one of the 35 emails that went
// out of development by accident. It carried a signed link to an applicant's
// resume, good for seven days, minted when the message was COMPOSED. That one
// was composed on the 5th and delivered on the 9th, so it arrived with three of
// its seven days left and nothing said so.
// ===========================================================================
{
  /* Comments stripped before anything is matched. A check that finds the word
   * in a sentence about the word is a check on wording, and this section is
   * about code that is easy to describe and easy to leave undone. */
  const codeOnly = (text) =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");

  const applyRoute = codeOnly(readSource("src/app/api/apply/route.ts"));
  const handlers = codeOnly(readSource("src/lib/job-handlers.ts"));

  rec(
    "the application composer defers its links rather than signing them",
    /deferredLink\(file\.path\)/.test(applyRoute),
    "the storage path travels; the URL is minted at the door",
  );
  rec(
    "and it no longer signs anything itself",
    !/signedDownloadUrl\(/.test(applyRoute),
    "a composer that signs is a composer that starts the clock too early",
  );
  rec(
    "email.send resolves the deferred links",
    /resolveDeferred\(/.test(handlers) && /signedDownloadUrl/.test(handlers),
    "",
  );
  rec(
    "and it sends what it resolved rather than the payload it was handed",
    /text:\s*signedText/.test(handlers) && /html:\s*signedHtml/.test(handlers),
    "signing into a variable nobody sends would look identical and do nothing",
  );

  /* The mechanism itself, both ways, with a signer this file controls. */
  const { deferredLink, deferredPathsIn, resolveDeferred, DEFERRED_HOST } = await import(
    "../src/lib/deferred-links.ts"
  );
  const token = deferredLink("254/abc/resume-jane.pdf");

  rec(
    "a token names its path and carries no credential",
    deferredPathsIn(`see ${token} for the file`)[0] === "254/abc/resume-jane.pdf" &&
      !/token|signature|jwt|eyJ/i.test(token),
    token,
  );
  rec(
    "and it is an absolute URL at a host that can never resolve",
    token.startsWith("https://") && DEFERRED_HOST.includes(".invalid"),
    "an unresolved token must go nowhere, not somewhere somebody could register",
  );

  const resolved = await resolveDeferred(`Resume: ${token}`, async (path) =>
    `https://storage.example.com/${path}?token=fresh`,
  );
  rec(
    "a resolved message carries the signed URL and no token",
    resolved.includes("?token=fresh") && !resolved.includes(DEFERRED_HOST),
    resolved,
  );

  const unsignable = await resolveDeferred(`Resume: ${token}`, async () => null);
  rec(
    "and a path that cannot be signed keeps its token rather than losing the link",
    unsignable.includes(DEFERRED_HOST),
    "a message that silently drops its attachment reads as an application with no resume",
  );
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
