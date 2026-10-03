/**
 * The design tokens, and whether anything has escaped them.
 *
 *   npx tsx scripts/token-audit.mjs
 *
 * WHAT THIS IS FOR
 * ----------------
 * A design system stops being a system the first time somebody types a hex code
 * into a component. It does not fail loudly; it fails by accumulating, and six
 * months later there are four navies and nobody can say which is right.
 *
 * So there are three checks, and the first one is the one that matters most:
 *
 *   1. The token file agrees with the standards DOCUMENT, value for value. The
 *      document is parsed, not trusted. If somebody edits one and not the other,
 *      the build fails naming the token, which is the only way two files that
 *      must agree actually stay agreeing.
 *
 *   2. No portal component contains a raw colour, a raw radius, or a raw font
 *      size. The tokens are the only way to get one.
 *
 *   3. The nine colours that exist under two names, once in the site's Tailwind
 *      theme and once under the standards name, hold the same value. That
 *      duplication is deliberate and explained in src/styles/portal.css; this is
 *      what stops it becoming a drift.
 *
 * Pure. No server, no database, no network, so it runs in phase zero.
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { readSource } from "./lib/read-source.mjs";
import { measurableSurfaces, sourceDirsOf } from "./lib/surfaces.mjs";
import { join } from "node:path";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const STANDARDS = "docs/PORTAL_DESIGN_STANDARDS.md";
const TOKENS = "src/styles/portal.css";

// =========================================================================
// 1. THE TOKEN FILE AGREES WITH THE STANDARDS DOCUMENT
// =========================================================================

rec("the standards document is in the repository", existsSync(STANDARDS));
rec("and the token file exists", existsSync(TOKENS));

/**
 * Read with the line endings normalised, and that is not a detail.
 *
 * This audit passed on the branch and failed the moment the branch merged,
 * because git re-checked the standards document out with CRLF and the fence
 * pattern below wanted a bare newline straight after the css fence. Nothing
 * about the document had changed.
 *
 * The same audit would have failed for anyone cloning this repository fresh on
 * Windows, which is a portability defect rather than a formatting one: a check
 * that depends on how git happened to write a file is a check that reports on
 * the checkout instead of on the content.
 */
const readNormalised = (path) => readSource(path).split("\r\n").join("\n");

const standardsText = readNormalised(STANDARDS);
const tokenText = readNormalised(TOKENS);

/**
 * The document's own CSS block, parsed.
 *
 * Deliberately reading the fenced ```css block rather than a list somebody
 * transcribed. The point of this check is that the DOCUMENT is the authority,
 * so the document is what gets read.
 */
const cssBlock = standardsText.match(/```css\n([\s\S]*?)```/);
rec("the standards document carries a css token block", Boolean(cssBlock));

const documented = new Map();
if (cssBlock) {
  for (const line of cssBlock[1].split("\n")) {
    const m = line.match(/^\s*(--[a-z-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/);
    if (m) documented.set(m[1], m[2].toLowerCase());
  }
}
/*
 * The exact set, not a count.
 *
 * A count passes when somebody deletes one token and adds another, which is
 * precisely the change worth catching. These twenty three names ARE the palette.
 *
 * The three --on-navy values were added 2026-09-05 and were not a new decision
 * either: DESIGN_SPEC.md section 2 has defined the on navy scale with measured
 * ratios since v5, and globals.css has carried it for the public site all
 * along. The PORTAL file simply never had it, so every surface rendering on
 * navy improvised, and contrast-audit found 33 violations from two colour pairs
 * the first day it was pointed at the portal.
 *
 * --gold-wash was the twentieth, added 2026-09-05. It was not a new decision:
 * DESIGN_SPEC.md section 2 already names accent-tint #FDF6E7 and records
 * --gold-deep on it at 4.90:1. Four screens were already writing
 * background: var(--gold-wash) against a token nothing declared, so the fill
 * silently fell back to transparent and read as almost right on a pale page.
 * Declaring it is what made this check fire, which is the check working.
 */
const EXPECTED_COLOUR_TOKENS = [
  "--navy", "--navy-hover", "--ink-navy",
  "--gold", "--gold-bright", "--gold-deep", "--gold-wash",
  "--on-navy", "--on-navy-muted", "--on-navy-dim",
  "--warn-bg", "--warn-border", "--warn-ink",
  "--ink", "--secondary", "--muted",
  "--border", "--border-strong", "--row-rule", "--row-hover", "--canvas",
  "--green", "--red",
];

const missingFromDoc = EXPECTED_COLOUR_TOKENS.filter((t) => !documented.has(t));
const extraInDoc = [...documented.keys()].filter((t) => !EXPECTED_COLOUR_TOKENS.includes(t));
rec(
  "the document defines exactly the twenty three colours of the palette",
  missingFromDoc.length === 0 && extraInDoc.length === 0,
  [...missingFromDoc.map((t) => `missing ${t}`), ...extraInDoc.map((t) => `extra ${t}`)].join(", ") ||
    `${documented.size} tokens`,
);

const implemented = new Map();
for (const line of tokenText.split("\n")) {
  const m = line.match(/^\s*(--[a-z-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/);
  if (m) implemented.set(m[1], m[2].toLowerCase());
}

for (const [name, value] of documented) {
  const mine = implemented.get(name);
  rec(
    `${name} is implemented`,
    mine !== undefined,
    mine === undefined ? "the document defines it and the token file does not" : "",
  );
  if (mine !== undefined) {
    rec(`${name} matches the document`, mine === value, mine === value ? value : `${mine} vs ${value}`);
  }
}

/*
 * The reverse direction. A token in the file that the document does not define
 * is not automatically wrong, because the file adds green-bg, green-border and
 * the whole type and shape scale, which the document states in prose rather
 * than in the css block. What IS wrong is a COLOUR the document does not know
 * about, because that is a palette expanding without a decision.
 */
const undocumentedColours = [...implemented.keys()].filter(
  (k) => !documented.has(k) && !["--green-bg", "--green-border"].includes(k),
);
rec(
  "no colour token exists that the document does not define",
  undocumentedColours.length === 0,
  undocumentedColours.join(", ") ||
    "green-bg and green-border are the two exceptions, stated in the document's prose",
);

// =========================================================================
// 2. NOTHING ESCAPED THE TOKENS
// =========================================================================

/** Every portal component, which is what this system governs. */
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(tsx|css)$/.test(entry)) acc.push(full.split("\\").join("/"));
  }
  return acc;
}

/*
 * The customer surfaces are governed too.
 *
 * The account screens are Phase 8 Section 1 and postdate the design entirely;
 * the order flow and the tracking page predate it. All three are surfaces of
 * the same product a customer meets, and leaving them on the old styling would
 * mean the design stops at the staff door, which is not where a brand stops.
 */
/**
 * DERIVED FROM THE SURFACE INVENTORY, AS OF 2026-09-07.
 *
 * This was five hand written directories, and it omitted the partner portal
 * entirely: src/app/partner and src/components/partner were held to no part of
 * the design system, so a partner screen could use any colour, any type size
 * and any spacing value and this audit would have reported the design intact.
 * Nobody decided that. The list was written before the partner portal existed
 * and nothing asked it to grow.
 *
 * scripts/lib/surfaces.mjs is what knows the surfaces now. The site is excluded
 * because the public pages are the brand's own visual system rather than the
 * portal design system, which is the distinction this audit was built around.
 */
const PORTAL_DIRS = sourceDirsOf(measurableSurfaces());
const allPortalFiles = PORTAL_DIRS.flatMap((d) => walk(d)).filter((f) => f !== TOKENS);

/**
 * The files that have been ported to the design system, and are therefore held
 * to it.
 *
 * WHY THIS LIST EXISTS INSTEAD OF CHECKING EVERYTHING
 * ---------------------------------------------------
 * The portal shipped across eight phases before this design existed. Holding
 * every file to the system on day one would mean an audit that is red until the
 * last screen is ported, and an audit that is expected to be red is an audit
 * nobody reads. It would also make the suite red for the whole workstream,
 * which is worse than useless.
 *
 * So the list starts empty and grows as screens are ported. What makes it
 * honest rather than a way to hide work:
 *
 *   The token agreement checks above run against the DOCUMENT and are not
 *   scoped by this list. They are true from the first commit.
 *
 *   The list may only grow. UNPORTED below is derived, so a file cannot be
 *   quietly removed from the list to make a check pass; removing it puts it
 *   back in the unported count, which is reported on every run.
 *
 *   The report prints the remaining count, so progress is visible and so is
 *   stalling.
 */
const PORTED = [
  // Brought in 2026-09-07 with the surface inventory. The partner surface had
  // never been held to the design system at all, and seven portal screens built
  // since the list was last touched had quietly fallen outside it.
  // Brought in 2026-09-09 with Phase 12 Sections 2 and 3. New screens join the
  // list on the day they are built: a screen written today has no excuse for
  // being outside the design system, and the list may only grow.
  "src/app/portal/(app)/reports/page.tsx",
  "src/app/portal/(app)/suppressions/page.tsx",
  "src/app/portal/(app)/suppressions/SuppressionsClient.tsx",
  "src/app/portal/(app)/applications/page.tsx",
  "src/app/portal/(app)/partners/disputes/LookupForm.tsx",
  "src/app/portal/(app)/partners/disputes/page.tsx",
  "src/app/portal/(app)/partners/NewPartner.tsx",
  "src/app/portal/(app)/partners/page.tsx",
  "src/app/portal/(app)/partners/[id]/page.tsx",
  "src/app/portal/(app)/partners/[id]/PartnerActions.tsx",
  "src/components/portal/design/Composer.tsx",
  "src/components/portal/design/Sheet.tsx",
  "src/components/portal/ScrollMemory.tsx",
  "src/app/partner/(app)/agreement/AcceptForm.tsx",
  "src/app/partner/(app)/agreement/page.tsx",
  "src/app/partner/(app)/layout.tsx",
  "src/app/partner/(app)/materials/CopyBlock.tsx",
  "src/app/partner/(app)/materials/page.tsx",
  "src/app/partner/(app)/materials/SubmitForm.tsx",
  "src/app/partner/(app)/page.tsx",
  "src/app/partner/(app)/referrals/page.tsx",
  "src/app/partner/(app)/statements/page.tsx",
  "src/app/partner/(app)/statements/[reference]/page.tsx",
  "src/app/partner/(public)/login/page.tsx",
  "src/app/partner/(public)/login/PartnerLoginForm.tsx",
  "src/app/partner/(public)/set-password/page.tsx",
  "src/app/partner/(public)/set-password/PartnerSetPasswordForm.tsx",
  "src/app/partner/layout.tsx",
  "src/components/partner/PartnerChrome.tsx",
  // Every portal and customer surface. The list existed so the audit could be
  // real while the port was partial; it now names everything.
  "src/app/(site)/order/[reference]/page.tsx",
  "src/app/(site)/order/start/[slug]/page.tsx",
  "src/app/account/SignOutButton.tsx",
  "src/app/account/layout.tsx",
  /*
   * The forgot password pair, 2026-09-29, added the same day the screen was
   * built. The customer V10 declaration named them and this list did not, and
   * the check caught it for the SECOND time in one session, on files that were
   * hours old. That is the useful shape: a new screen is exactly the thing most
   * likely to be missing from an inventory, because nobody has had a reason to
   * think about it yet.
   */
  "src/app/account/forgot-password/ForgotPasswordForm.tsx",
  "src/app/account/forgot-password/page.tsx",
  "src/app/account/login/AccountLoginForm.tsx",
  "src/app/account/login/page.tsx",
  "src/app/account/order/BulkOrderClient.tsx",
  "src/app/account/order/page.tsx",
  "src/app/account/orders/[reference]/page.tsx",
  /*
   * The orders list, built 2026-10-02. It was added to CUSTOMER_V10 and not to
   * this list, so the audit DECLARED it a customer V10 screen and then never
   * read it: neither the type scale nor the no-colour rule touched a file both
   * were supposed to govern. "Every file declared as customer V10 is one this
   * audit reads" is the check that caught it, which is the whole reason that
   * check exists.
   */
  "src/app/account/orders/page.tsx",
  "src/app/account/page.tsx",
  /*
   * The sign up pair joined on 2026-09-29, when stage 1 restyled them. They had
   * never been on this list, so nothing had ever held them to a scale, and the
   * customer V10 declaration named them while this one did not. The new check
   * "every file declared as customer V10 is one this audit reads" went red and
   * named both, which is that check earning its keep on its first run.
   */
  "src/app/account/sign-up/SignUpForm.tsx",
  "src/app/account/sign-up/page.tsx",
  "src/app/account/set-password/SetPasswordForm.tsx",
  "src/app/account/set-password/page.tsx",
  "src/app/account/settings/SettingsClient.tsx",
  "src/app/account/settings/page.tsx",
  "src/app/account/statements/PayStatementButton.tsx",
  "src/app/account/statements/page.tsx",
  "src/app/portal/(app)/accounts/AccountsClient.tsx",
  "src/app/portal/(app)/accounts/page.tsx",
  "src/app/portal/(app)/audit/page.tsx",
  "src/app/portal/(app)/billing/page.tsx",
  "src/app/portal/(app)/certification/CertificationClient.tsx",
  "src/app/portal/(app)/certification/page.tsx",
  "src/app/portal/(app)/charge-log/ChargeLogClient.tsx",
  "src/app/portal/(app)/charge-log/page.tsx",
  "src/app/portal/(app)/clients/ClientsClient.tsx",
  "src/app/portal/(app)/clients/page.tsx",
  "src/app/portal/(app)/documents/binder/[fileId]/page.tsx",
  "src/app/portal/(app)/documents/page.tsx",
  "src/app/portal/(app)/files/DispatchPanel.tsx",
  "src/app/portal/(app)/files/FileClient.tsx",
  "src/app/portal/(app)/files/page.tsx",
  // Phase 10 Section 1, the telephone call path.
  "src/app/portal/(app)/roles/page.tsx",
  "src/app/portal/(app)/roles/RolesClient.tsx",
  "src/app/portal/(app)/intake/page.tsx",
  "src/app/portal/(app)/intake/IntakeClient.tsx",
  "src/app/portal/(app)/jobs/JobsClient.tsx",
  "src/app/portal/(app)/jobs/[id]/CaptureClient.tsx",
  "src/app/portal/(app)/jobs/[id]/page.tsx",
  "src/app/portal/(app)/jobs/page.tsx",
  "src/app/portal/(app)/layout.tsx",
  "src/app/portal/(app)/messages/MessagesClient.tsx",
  "src/app/portal/(app)/messages/page.tsx",
  "src/app/portal/(app)/not-found.tsx",
  "src/app/portal/(app)/onboarding/OnboardingClient.tsx",
  "src/app/portal/(app)/onboarding/page.tsx",
  "src/app/portal/(app)/orders/OrdersClient.tsx",
  "src/app/portal/(app)/orders/page.tsx",
  "src/app/portal/(app)/page.tsx",
  "src/app/portal/(app)/pay/page.tsx",
  "src/app/portal/(app)/people/PeopleClient.tsx",
  "src/app/portal/(app)/people/page.tsx",
  "src/app/portal/(app)/profile/PasswordForm.tsx",
  "src/app/portal/(app)/profile/PreferencesForm.tsx",
  "src/app/portal/(app)/profile/page.tsx",
  "src/app/portal/(app)/protocols/ProtocolsClient.tsx",
  "src/app/portal/(app)/protocols/page.tsx",
  "src/app/portal/(app)/queue/QueueClient.tsx",
  "src/app/portal/(app)/queue/page.tsx",
  "src/app/portal/(app)/review/ReviewClient.tsx",
  "src/app/portal/(app)/review/page.tsx",
  "src/app/portal/(app)/status/StatusClient.tsx",
  "src/app/portal/(app)/status/page.tsx",
  "src/app/portal/(app)/tasks/TasksClient.tsx",
  "src/app/portal/(app)/tasks/page.tsx",
  "src/app/portal/(app)/techs/TechsClient.tsx",
  "src/app/portal/(app)/techs/page.tsx",
  "src/app/portal/(public)/login/LoginForm.tsx",
  "src/app/portal/(public)/login/page.tsx",
  "src/app/portal/(public)/set-password/SetPasswordForm.tsx",
  "src/app/portal/(public)/set-password/page.tsx",
  "src/app/portal/layout.tsx",
  "src/components/order/OrderFlow.tsx",
  "src/components/portal/CoverageMap.tsx",
  "src/components/portal/Dashboard.tsx",
  "src/components/portal/Mispointed.tsx",
  "src/components/portal/PortalChrome.tsx",
  "src/components/portal/design/Primitives.tsx",
  "src/components/portal/design/Record.tsx",
  "src/components/portal/design/RestrictedMode.tsx",
  "src/components/portal/design/Table.tsx",
  "src/components/portal/surfaces.tsx",
];

/**
 * The one file the COLOUR rule does not govern, and why.
 *
 * CoverageMap draws a choropleth: five greys from "nobody covers this county"
 * to "four or more technicians". That is a DATA ramp, not interface chrome, and
 * the standards palette does not define one. Forcing five steps onto four navy
 * tokens would make two of them indistinguishable, which in a map is not a
 * style problem but a legibility one: telling the steps apart is the entire
 * job of the thing.
 *
 * Exempted from the colour rule only. It still gets every other one: no
 * gradient, no shadow, no off scale type, no CSS uppercase.
 */
const COLOUR_EXEMPT = ["src/components/portal/CoverageMap.tsx"];

const portalFiles = allPortalFiles.filter((f) => PORTED.includes(f));
const unported = allPortalFiles.filter((f) => !PORTED.includes(f));

rec("there are portal components to check", allPortalFiles.length > 0, `${allPortalFiles.length} files total`);

/*
 * AND THE DERIVED DIRECTORY LIST STILL COVERS EVERY SURFACE IT SHOULD.
 *
 * The list above is derived, which removes the memory problem and introduces a
 * quieter one: a surface whose dirs are misdeclared contributes no files and
 * this audit goes on passing over a smaller set. So each surface is asked for
 * its own files by name.
 */
for (const surface of measurableSurfaces()) {
  const mine = allPortalFiles.filter((f) =>
    (surface.sourceDirs ?? []).some((d) => f.startsWith(d)),
  );
  rec(
    `the ${surface.key} surface contributes files to the design check`,
    mine.length > 0,
    `${mine.length} file(s)`,
  );
}
rec(
  "every file named as ported actually exists",
  PORTED.every((f) => allPortalFiles.includes(f)),
  PORTED.filter((f) => !allPortalFiles.includes(f)).join(", ") || "none stale",
);
console.log(
  `  NOTE: ${PORTED.length} of ${allPortalFiles.length} portal files are ported to the design system. ` +
    `${unported.length} still on the old styling.`,
);

/** Source with comments removed, so prose about a colour is not read as one. */
function codeOnly(path) {
  return readSource(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/*
 * The size scale a component may name directly, as bare numbers inside a
 * Tailwind arbitrary value. Anything else has to come from a token.
 *
 * This list is the standards file's scale and nothing else. It is short on
 * purpose: a component wanting 14.5px is a component inventing a step.
 */
const ALLOWED_FONT_PX = new Set([11, 12, 12.5, 13.5, 15, 16, 17, 24, 30]);

/**
 * THE CUSTOMER SCALE. Operator ruling, 2026-09-29, and it is a SECOND scale
 * rather than a widening of the first.
 *
 * 12, 13, 14, 15, 16, 17, 20, 26, 32. Recorded in
 * docs/PORTAL_DESIGN_STANDARDS.md with the reasoning, including why 16 is in it
 * (below 16px Safari zooms the viewport on focus, and this platform does not
 * lock zoom because locking it is an accessibility failure).
 *
 * WHY A SECOND SCALE AND NOT A LONGER ONE. Merging the two would mean every
 * staff screen silently gained 20, 26 and 32, and every customer screen gained
 * 11, 12.5, 13.5, 24 and 30. That is not one system, it is the absence of one:
 * fourteen steps is a scale in name only. The two surfaces have different
 * readers and never show each other's screens.
 *
 * WHICH SCALE A FILE IS HELD TO IS DECLARED BELOW, and the declaration may only
 * grow, exactly as PORTED does and for the reason given there.
 */
const CUSTOMER_FONT_PX = new Set([12, 13, 14, 15, 16, 17, 20, 26, 32]);

/**
 * The customer surface files restyled to V10 and therefore held to the customer
 * scale. Everything else on PORTED stays on the staff scale.
 *
 * IT GROWS AS STAGE 1 RESTYLES SCREENS, and the remainder is reported on every
 * run so stalling is visible. A customer screen NOT on this list is not
 * unchecked: it is checked against the staff scale, which is what it still is.
 *
 * THE TWO LISTS ARE DISJOINT AND THAT IS ASSERTED. Without it, a staff screen
 * wanting 20px could be declared a customer file, and the second scale would
 * become a way to widen the first one file at a time.
 */
const CUSTOMER_V10 = [
  "src/app/account/login/page.tsx",
  "src/app/account/sign-up/page.tsx",
  "src/app/account/sign-up/SignUpForm.tsx",
  "src/app/account/page.tsx",
  "src/app/account/SignOutButton.tsx",
  "src/components/order/OrderFlow.tsx",
  "src/app/(site)/order/[reference]/page.tsx",
  "src/app/(site)/order/start/[slug]/page.tsx",
  /* The credential screens, restyled 2026-09-29. Every account door's link and
   * both reset paths land on set-password, so leaving it in the old card style
   * would have put a visual seam at the end of every one of them. */
  "src/app/account/forgot-password/page.tsx",
  "src/app/account/forgot-password/ForgotPasswordForm.tsx",
  "src/app/account/set-password/page.tsx",
  "src/app/account/set-password/SetPasswordForm.tsx",
  /*
   * THE FOUR SIGNED IN SHELLS, 2026-09-29. Header, headings and footer on V10.
   *
   * The note that used to sit here said their INTERIORS were not on this list
   * and that each screen read as a V10 shell around an older middle. That was
   * true and is no longer: the interiors went on V10 on 2026-10-02 and are
   * listed below.
   */
  "src/app/account/settings/page.tsx",
  "src/app/account/statements/page.tsx",
  "src/app/account/orders/[reference]/page.tsx",
  "src/app/account/order/page.tsx",
  /*
   * THE INTERIORS, 2026-10-02, stage 1 item 4.
   *
   * Tinted panels removed, section headings given the 2px ink rule, colour as
   * status removed, and the type scale brought onto the customer steps: every
   * 13.5px became 14 and every 12.5px became 13, rounded UP because that is the
   * legible direction and both were off the scale the operator ruled.
   *
   * ADDING A FILE HERE IS WHAT SUBJECTS IT TO THE CUSTOMER SCALE AND THE COLOUR
   * RULE BELOW, so this list is what makes a restyle enforced rather than merely
   * done. A screen restyled and not listed can drift back on the next edit with
   * nothing saying so.
   */
  "src/app/account/settings/SettingsClient.tsx",
  "src/app/account/order/BulkOrderClient.tsx",
  "src/app/account/login/AccountLoginForm.tsx",
  "src/app/account/statements/PayStatementButton.tsx",
  "src/app/account/orders/page.tsx",
];
const ALLOWED_RADIUS_PX = new Set([2, 3, 4, 8, 12, 16, 18]);

/*
 * ===========================================================================
 * NO RED, GREEN OR AMBER ON A CUSTOMER SURFACE, AND NOTHING CHECKED IT.
 * ===========================================================================
 *
 * Operator ruling, 2026-10-02: "no red text anywhere, including errors.
 * DESIGN_V10.md says no red, green or amber in the UI, and urgency is carried by
 * weight and words."
 *
 * TWO DOCUMENTS ALREADY SAID SO AND FOURTEEN PLACES DISOBEYED THEM.
 * DESIGN_V10.md line 29: "No status colors. No red, green or amber anywhere in
 * the UI... Brand navy and gold are the only colors." PORTAL_DESIGN_STANDARDS.md
 * line 61 says the same in its own words.
 *
 * The rule was written twice, in reviewed files, and had NO CHECK. So fourteen
 * uses of `--red`, `--green` and the `--warn-*` family sat on customer screens
 * through every board, and the code's own comments argued FOR them, citing
 * contrast ratios. Contrast answers whether a colour is legible, not whether it
 * is permitted, and a session reading those comments took them as the authority
 * over both documents. This repository's lesson is usually that a declaration
 * nothing reads stops being true; here the declaration was right and the code
 * was wrong, and the missing piece was the same: nothing compared them.
 *
 * GOLD IS NOT IN THIS LIST, because gold is a brand colour the rule explicitly
 * allows. `--gold-deep` is `#8d610f`, which DESIGN_SPEC.md added precisely as
 * "gold as text on light" at 4.81:1, so it clears AA as well as the palette.
 *
 * NAMED TOKENS RATHER THAN A HEX SWEEP, because a screen writes `var(--red)` and
 * a hex scan would not see it. The raw hex scan above still runs alongside.
 */
const FORBIDDEN_COLOUR = [
  { token: "--red", why: "red is not a colour this design has, including for errors" },
  { token: "--green", why: "green is not a colour this design has, including for success" },
  { token: "--green-bg", why: "a green tint is a tinted box and a status colour at once" },
  { token: "--warn-bg", why: "an amber tint is a tinted box and a status colour at once" },
  { token: "--warn-ink", why: "amber text is a status colour" },
  { token: "--warn-border", why: "an amber border is a status colour" },
];

const forbiddenColour = [];
const forbiddenFont = [];

const rawColour = [];
const rawFont = [];
const rawRadius = [];

for (const file of portalFiles) {
  const code = codeOnly(file);

  if (!COLOUR_EXEMPT.includes(file)) {
    for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      rawColour.push(`${file}: ${m[0]}`);
    }
    for (const m of code.matchAll(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/g)) {
      rawColour.push(`${file}: ${m[0]}`);
    }
  }
  /*
   * The forbidden palette, on customer files only. The portal still carries
   * status dots on the screens V10 has not reached yet, which the operator
   * recorded on 2026-09-30 as work to come in stages 2 to 4 rather than as a
   * defect per screen, so failing them here would be failing him for a decision
   * he has already made.
   */
  if (CUSTOMER_V10.includes(file)) {
    for (const { token, why } of FORBIDDEN_COLOUR) {
      if (code.includes(`var(${token})`)) {
        forbiddenColour.push(`${file}: ${token}, and ${why}`);
      }
    }
    /*
     * NO MONOSPACE, and it is the colour rule's twin in every respect including
     * how it was found. DESIGN_V10.md's type section reads "Inter, weights 400,
     * 500, 600, 700. No monospace anywhere, including file numbers, times and
     * money." Twelve uses survived on files already declared V10, on exactly the
     * three things that sentence names, and nothing compared the document to the
     * code. The rule was right, the code was wrong, and the missing piece was a
     * check, which is the same account the colour note above gives.
     *
     * THE SCOPE IS THE DECLARED LIST, NOT THE SOURCE TREE. Fifty-four further
     * uses sit on staff and partner screens V10 has not reached. Those are the
     * old standard rather than violations of the new one, exactly as the colour
     * rule above is scoped, and they come in with stages 2 to 4.
     */
    for (const m of code.matchAll(/\bfont-mono\b/g)) {
      forbiddenFont.push(`${file}: ${m[0]}, and V10 names no monospace face`);
    }
  }

  /*
   * THE FILE DECIDES WHICH SCALE, and the scale it is judged against is named
   * in the finding. A red saying only "off the scale" leaves the reader asking
   * which of two, which is how a correct size gets "fixed" into a wrong one.
   */
  const customer = CUSTOMER_V10.includes(file);
  const scale = customer ? CUSTOMER_FONT_PX : ALLOWED_FONT_PX;
  for (const m of code.matchAll(/text-\[([0-9.]+)px\]/g)) {
    if (!scale.has(Number(m[1]))) {
      rawFont.push(`${file}: ${m[0]} (${customer ? "customer" : "staff"} scale)`);
    }
  }
  for (const m of code.matchAll(/rounded-\[([0-9.]+)px\]/g)) {
    if (!ALLOWED_RADIUS_PX.has(Number(m[1]))) rawRadius.push(`${file}: ${m[0]}`);
  }
}

rec(
  "no portal component contains a raw colour",
  rawColour.length === 0,
  rawColour.slice(0, 6).join("  |  ") || "none",
);

rec(
  "no customer screen uses red, green or amber",
  forbiddenColour.length === 0,
  forbiddenColour.length === 0
    ? `${CUSTOMER_V10.length} customer file(s) checked against ${FORBIDDEN_COLOUR.length} forbidden token(s). Gold is permitted and excluded: it is brand, and --gold-deep is the spec's own gold-as-text-on-light at 4.81:1`
    : forbiddenColour.slice(0, 6).join("  |  "),
);

/*
 * AND THE CHECK ABOVE MUST BE LOOKING AT SOMETHING. A customer list that emptied,
 * or a forbidden list that emptied, would make it pass for ever over nothing,
 * which is the vacuous green this repository keeps meeting. Both floors are
 * asserted rather than assumed.
 */
rec(
  "and that check has a subject",
  CUSTOMER_V10.length >= 10 && FORBIDDEN_COLOUR.length >= 6,
  `${CUSTOMER_V10.length} customer file(s), ${FORBIDDEN_COLOUR.length} forbidden token(s). Below either floor the check passes over nothing`,
);

rec(
  "no customer screen sets a monospace face",
  forbiddenFont.length === 0,
  forbiddenFont.length === 0
    ? `${CUSTOMER_V10.length} customer file(s). V10 names one family and no monospace, and a reference, a time and a total are the three things it names as still not earning one`
    : forbiddenFont.slice(0, 6).join("  |  "),
);
/*
 * ===========================================================================
 * THE TWO SCALES, AND WHAT STOPS THE SECOND ONE EATING THE FIRST.
 * ===========================================================================
 */

/*
 * A CUSTOMER FILE MUST BE A FILE THIS AUDIT ACTUALLY SWEEPS. A name here that
 * is not on PORTED is a declaration over nothing: the file is never read, the
 * customer scale is never applied to it, and the list grows while the coverage
 * does not. Same shape as a probe that names a route which does not exist.
 */
const customerNotPorted = CUSTOMER_V10.filter((f) => !PORTED.includes(f));
rec(
  "every file declared as customer V10 is one this audit reads",
  customerNotPorted.length === 0,
  customerNotPorted.join(", ") || `${CUSTOMER_V10.length} customer file(s), all on PORTED`,
);

/*
 * AND THE CUSTOMER SET IS NOT EMPTY. An empty list makes every customer scale
 * check below a green over nothing, which reads exactly like a scale being
 * enforced. This is the vacuity guard, and it is the check that would fire if
 * somebody emptied the list to make a red go away.
 */
rec(
  "and the customer scale has files to enforce against",
  CUSTOMER_V10.length > 0,
  `${CUSTOMER_V10.length} file(s) on the customer scale, ${PORTED.length - CUSTOMER_V10.length} still on the staff scale`,
);

/*
 * THE TWO SCALES DIFFER, which is the whole reason there are two. If somebody
 * edited them to the same values, every check here would pass forever and the
 * split would be decoration. Asserted on the SETS rather than on their lengths,
 * because two scales of nine steps each can still be identical.
 */
const sameSteps =
  CUSTOMER_FONT_PX.size === ALLOWED_FONT_PX.size &&
  [...CUSTOMER_FONT_PX].every((n) => ALLOWED_FONT_PX.has(n));
rec(
  "the customer scale is genuinely a different scale from the staff one",
  !sameSteps,
  `customer only: ${[...CUSTOMER_FONT_PX].filter((n) => !ALLOWED_FONT_PX.has(n)).join(", ")}  |  staff only: ${[...ALLOWED_FONT_PX].filter((n) => !CUSTOMER_FONT_PX.has(n)).join(", ")}`,
);

/*
 * AND A STAFF FILE MAY NOT REACH FOR A CUSTOMER STEP.
 *
 * This is the check that makes the split honest rather than a widening. Without
 * it, a staff screen wanting 20px has an obvious move available: add itself to
 * CUSTOMER_V10. The steps that exist only on the customer scale are therefore
 * forbidden in staff files by name, and the finding says which step and which
 * file rather than leaving somebody to work it out.
 *
 * It is the same assertion the main font check already makes, stated
 * separately so that its RED says something different: "this file is on the
 * wrong scale" rather than "this size is on no scale".
 */
const customerOnly = [...CUSTOMER_FONT_PX].filter((n) => !ALLOWED_FONT_PX.has(n));
const staffReachingOver = [];
for (const file of portalFiles) {
  if (CUSTOMER_V10.includes(file)) continue;
  const code = codeOnly(file);
  for (const m of code.matchAll(/text-\[([0-9.]+)px\]/g)) {
    if (customerOnly.includes(Number(m[1]))) staffReachingOver.push(`${file}: ${m[0]}`);
  }
}
rec(
  "no staff file uses a step that exists only on the customer scale",
  staffReachingOver.length === 0,
  staffReachingOver.slice(0, 6).join("  |  ") ||
    `${customerOnly.join(", ")} are customer only and appear in no staff file`,
);

rec(
  "no portal component names a font size outside the scale",
  rawFont.length === 0,
  rawFont.slice(0, 6).join("  |  ") || "none",
);
rec(
  "no portal component names a radius outside the scale",
  rawRadius.length === 0,
  rawRadius.slice(0, 6).join("  |  ") || "none",
);

// =========================================================================
// 3. THE TWINS AGREE
// =========================================================================
//
// Nine colours exist under two names: once in the site's Tailwind theme and
// once under the standards name. Merging them would mean renaming the palette
// across the public site, which this workstream is not allowed to do, so the
// duplication is asserted instead of tidied.

const globals = readNormalised("src/app/globals.css");
const siteTokens = new Map();
for (const line of globals.split("\n")) {
  const m = line.match(/^\s*(--color-[a-z-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/);
  if (m) siteTokens.set(m[1], m[2].toLowerCase());
}

const TWINS = [
  ["--navy", "--color-slate"],
  ["--navy-hover", "--color-slate-deep"],
  ["--ink-navy", "--color-slate-abyss"],
  ["--secondary", "--color-slate-muted"],
  ["--canvas", "--color-limestone"],
  ["--row-rule", "--color-limestone-sunk"],
  ["--border", "--color-limestone-line"],
  ["--border-strong", "--color-limestone-edge"],
  ["--gold", "--color-brass"],
  ["--gold-bright", "--color-brass-light"],
  ["--gold-deep", "--color-brass-ink"],
  ["--ink", "--color-ink"],
];

for (const [standard, site] of TWINS) {
  const a = implemented.get(standard);
  const b = siteTokens.get(site);
  rec(
    `${standard} and ${site} are the same colour`,
    a !== undefined && b !== undefined && a === b,
    a === b ? a : `${standard}=${a ?? "missing"} ${site}=${b ?? "missing"}`,
  );
}

// =========================================================================
// 4. THE RULES THE STANDARDS FILE STATES AS PROHIBITIONS
// =========================================================================

{
  const portalCss = tokenText;

  /*
   * No shadows on cards. Only two shadows exist in the system and both are
   * named for the overlay they belong to.
   */
  const shadowTokens = [...portalCss.matchAll(/--shadow-([a-z-]+)\s*:/g)].map((m) => m[1]);
  rec(
    "the only shadows in the system are the two overlay shadows",
    shadowTokens.length === 2 && shadowTokens.includes("menu") && shadowTokens.includes("modal"),
    shadowTokens.join(", "),
  );

  /*
   * A shadow is allowed only through one of the two overlay TOKENS.
   *
   * The first version banned every shadow-[...] outright, which caught the
   * dropdown, the notification panel and the command palette: three overlays
   * the standards file explicitly permits, written as three different hand
   * rolled rgba values. Banning them was wrong and allowing arbitrary ones
   * would be worse, so the rule is that the value must be a token. That also
   * collapses the three near identical values into the two the document names.
   */
  const rawShadows = [];
  for (const f of portalFiles) {
    for (const m of codeOnly(f).matchAll(/(?:drop-)?shadow-\[([^\]]+)\]/g)) {
      if (!/^var\(--shadow-(menu|modal)\)$/.test(m[1])) rawShadows.push(`${f}: ${m[0]}`);
    }
  }
  rec(
    "every shadow comes from one of the two overlay tokens",
    rawShadows.length === 0,
    rawShadows.slice(0, 4).join("  |  ") || "menu and modal only, and no card carries one",
  );

  /*
   * No gradients. The standards file says never, and a gradient is how a flat
   * institutional palette starts looking like a consumer app.
   */
  const gradients = portalFiles.filter((f) => /gradient|linear-gradient/.test(codeOnly(f)));
  rec("no portal component uses a gradient", gradients.length === 0, gradients.slice(0, 4).join(", ") || "none");

  /*
   * text-transform is not how sentence case is enforced. A CSS transform makes
   * the DOM disagree with the screen, which breaks screen readers and copy and
   * paste, and lets voice-audit read one thing while a person sees another.
   * The one legitimate use is the column header class in the token file.
   */
  const transforms = portalFiles.filter((f) => /\buppercase\b|\bcapitalize\b/.test(codeOnly(f)));
  rec(
    "sentence case is written, not CSS transformed",
    transforms.length === 0,
    transforms.slice(0, 6).join(", ") ||
      "the only uppercase treatments are .portal-kicker and .portal-column-header",
  );

  rec(
    "the mobile shape overrides live in the token file rather than in components",
    /@media \(max-width: 767px\)/.test(portalCss) && /--radius-card: 12px/.test(portalCss),
    "a component hard coding either radius would be wrong at the other width",
  );

  rec(
    "tabular numerals are on the portal surface",
    /font-variant-numeric: tabular-nums/.test(portalCss),
  );

  rec(
    "the italic face is loaded for the absent data chip",
    /style: \["normal", "italic"\]/.test(readSource("src/app/layout.tsx")),
    "a synthesised oblique on a 12px chip is the mush this system exists to avoid",
  );
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A design system stops being a system the first time something escapes it.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. The document and the code say the same thing.`);
