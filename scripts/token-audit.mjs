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

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
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
const readNormalised = (path) => readFileSync(path, "utf8").split("\r\n").join("\n");

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
 * precisely the change worth catching. These nineteen names ARE the palette.
 */
const EXPECTED_COLOUR_TOKENS = [
  "--navy", "--navy-hover", "--ink-navy",
  "--gold", "--gold-bright", "--gold-deep",
  "--warn-bg", "--warn-border", "--warn-ink",
  "--ink", "--secondary", "--muted",
  "--border", "--border-strong", "--row-rule", "--row-hover", "--canvas",
  "--green", "--red",
];

const missingFromDoc = EXPECTED_COLOUR_TOKENS.filter((t) => !documented.has(t));
const extraInDoc = [...documented.keys()].filter((t) => !EXPECTED_COLOUR_TOKENS.includes(t));
rec(
  "the document defines exactly the nineteen colours of the palette",
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
const PORTAL_DIRS = [
  "src/app/portal",
  "src/components/portal",
  "src/app/account",
  "src/app/(site)/order",
  "src/components/order",
];
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
  // Every portal and customer surface. The list existed so the audit could be
  // real while the port was partial; it now names everything.
  "src/app/(site)/order/[reference]/page.tsx",
  "src/app/(site)/order/start/[slug]/page.tsx",
  "src/app/account/SignOutButton.tsx",
  "src/app/account/layout.tsx",
  "src/app/account/login/AccountLoginForm.tsx",
  "src/app/account/login/page.tsx",
  "src/app/account/order/BulkOrderClient.tsx",
  "src/app/account/order/page.tsx",
  "src/app/account/orders/[reference]/page.tsx",
  "src/app/account/page.tsx",
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
  return readFileSync(path, "utf8")
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
const ALLOWED_RADIUS_PX = new Set([2, 3, 4, 8, 12, 16, 18]);

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
  for (const m of code.matchAll(/text-\[([0-9.]+)px\]/g)) {
    if (!ALLOWED_FONT_PX.has(Number(m[1]))) rawFont.push(`${file}: ${m[0]}`);
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
    /style: \["normal", "italic"\]/.test(readFileSync("src/app/layout.tsx", "utf8")),
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
