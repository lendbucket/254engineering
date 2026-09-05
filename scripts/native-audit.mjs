/**
 * THE NATIVE STANDARD AT 390, ASSERTED.
 *
 *   node scripts/native-audit.mjs
 *
 * docs/PORTAL_DESIGN_STANDARDS.md, "The native standard at 390". Nine points,
 * written down before anything was built against them, because the operator
 * could describe the problem and no existing check could.
 *
 * WHY A SEPARATE AUDIT
 * --------------------
 * mobile-overflow-audit asserts no horizontal document scroll. mobile-audit
 * asserts WCAG 2.5.8 tap targets and clipping. Both pass on every portal screen
 * and have done throughout, while the operator was telling us the portal feels
 * like a desktop site. Those checks are true and they measure a different
 * thing.
 *
 * What separates a website that fits from an application is where the scroll
 * lives, whether a tap says anything, and whether a table is still a table on a
 * phone. None of that is an overflow or a target size, so it goes here rather
 * than being bolted onto an audit whose green already means something specific.
 *
 * EVERYTHING HERE IS AT 390 AND SIGNED IN. At lg the portal is deliberately an
 * ordinary scrolling document: the rail is there and a desktop browser scrolls
 * a page. A check that demanded an app shell at 1280 would be asserting a rule
 * nobody made.
 */

import fs from "node:fs";
import { chromium } from "playwright";
import { createProbe, cookieFor, destroyProbes } from "./lib/portal-probe.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3225";
const WIDTH = 390;
const HEIGHT = 844;

/**
 * Every signed in portal screen, with the role that can open it. The role is
 * part of the route: an administrator gets 404 on the review queue, and a
 * technician sees a different dashboard.
 */
const SCREENS = [
  { path: "/portal", role: "admin" },
  { path: "/portal/files", role: "admin" },
  { path: "/portal/clients", role: "admin" },
  { path: "/portal/intake", role: "admin" },
  { path: "/portal/people", role: "admin" },
  { path: "/portal/roles", role: "admin" },
  { path: "/portal/audit", role: "admin" },
  { path: "/portal/techs", role: "admin" },
  { path: "/portal/documents", role: "admin" },
  { path: "/portal/orders", role: "admin" },
  { path: "/portal/accounts", role: "admin" },
  { path: "/portal/billing", role: "admin" },
  { path: "/portal/queue", role: "admin" },
  { path: "/portal/status", role: "admin" },
  { path: "/portal/tasks", role: "admin" },
  { path: "/portal/messages", role: "admin" },
  { path: "/portal/profile", role: "admin" },
  { path: "/portal/onboarding", role: "admin" },
  { path: "/portal/charge-log", role: "admin" },
  { path: "/portal/pay", role: "admin" },
  { path: "/portal/review", role: "engineer" },
  { path: "/portal/protocols", role: "engineer" },
  { path: "/portal/jobs", role: "field_tech" },
  { path: "/portal/certification", role: "field_tech" },
];

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ THE NATIVE STANDARD AT 390 ================");
console.log(`${BASE}, ${SCREENS.length} signed in screens\n`);

/*
 * POINT 9. EVERY DESKTOP ACTION IS REACHABLE ON A PHONE.
 *
 * The operator's requirement is that the firm can be run remotely, so an
 * affordance that exists only on a wide screen is a gap rather than a choice.
 *
 * This is a COVERAGE check of the same shape as the perimeter list in
 * security-audit: every element hidden below lg is either accounted for in the
 * table below, with a reason, or this fails. It cannot tell whether the reason
 * is a good one. What it can do is make adding a desktop only affordance a
 * decision somebody writes down rather than a thing that happens.
 *
 * Read from source rather than from a browser, because the question is which
 * elements EXIST with that treatment, not which are painted on one route.
 */
{
  const ACCOUNTED = {
    "src/app/portal/(app)/layout.tsx": [
      "the navigation rail, replaced on a phone by the bottom tab bar and the More sheet",
      "the Data as of timestamp, which carries no action; omitting it on a phone is recorded as a decision",
    ],
    "src/components/portal/PortalChrome.tsx": [
      "the search button with its Ctrl K hint, replaced by the search icon at lg:hidden opening the same palette",
    ],
    "src/app/portal/(app)/files/page.tsx": [
      "list and detail columns, which a phone shows one at a time",
      "list and detail columns, which a phone shows one at a time",
    ],
    "src/app/portal/(app)/messages/page.tsx": [
      "list and detail columns, which a phone shows one at a time",
      "list and detail columns, which a phone shows one at a time",
    ],
    "src/app/portal/(app)/onboarding/page.tsx": [
      "list and detail columns, which a phone shows one at a time",
      "list and detail columns, which a phone shows one at a time",
    ],
    "src/app/portal/(app)/protocols/page.tsx": [
      "list and detail columns, which a phone shows one at a time",
      "list and detail columns, which a phone shows one at a time",
    ],
    "src/app/portal/(app)/review/page.tsx": [
      "list and detail columns, which a phone shows one at a time",
      "list and detail columns, which a phone shows one at a time",
    ],
    "src/components/portal/surfaces.tsx": [
      "a column label, whose information the card layout carries beside its value",
      "a column that drops at xl, carried by the card layout below md",
      "a column that drops at xl, carried by the card layout below md",
    ],
    /*
     * design/Table.tsx is deliberately NOT here. It hides its table half at md
     * rather than lg, which point 4 governs and this check does not see. The
     * first version of this table listed it anyway, and the stale check caught
     * that: a reason recorded for an element that does not exist is a reason
     * nobody will ever question.
     */
  };

  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name)) files.push(full);
    }
  };
  walk("src/app/portal");
  walk("src/components/portal");

  const found = {};
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    const hits = [...code.matchAll(/hidden[^"'`]*?\b(?:lg|xl):(?:flex|block|inline|inline-flex|grid|table|table-cell)/g)];
    if (hits.length) found[file.split("\\").join("/")] = hits.length;
  }

  const unaccounted = [];
  const stale = [];
  for (const [file, count] of Object.entries(found)) {
    const reasons = ACCOUNTED[file];
    if (!reasons) {
      unaccounted.push(`${file} (${count})`);
      continue;
    }
    if (reasons.length !== count) {
      unaccounted.push(`${file}: ${count} hidden below lg, ${reasons.length} accounted for`);
    }
  }
  for (const file of Object.keys(ACCOUNTED)) {
    if (!found[file]) stale.push(file);
  }

  rec(
    "every element hidden below lg is accounted for",
    unaccounted.length === 0,
    unaccounted.join(" | ") || `${Object.values(found).reduce((a, b) => a + b, 0)} across ${Object.keys(found).length} files`,
  );
  rec(
    "and nothing is accounted for that no longer exists",
    stale.length === 0,
    stale.join(", ") || "a reason for an element that is gone is a reason nobody will question",
  );
}

const sessions = {};
for (const role of ["admin", "engineer", "field_tech"]) {
  sessions[role] = await createProbe(BASE, role, "native-audit");
}
for (const role of Object.keys(sessions)) {
  rec(`a ${role} session was created`, Boolean(sessions[role]?.cookie));
}

const browser = await chromium.launch();

let measured = 0;
let screensWithControls = 0;
let totalControls = 0;

for (const screen of SCREENS) {
  const probe = sessions[screen.role];
  if (!probe?.cookie) continue;

  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await ctx.addCookies(cookieFor(probe, BASE));
  const page = await ctx.newPage();

  try {
    await page.goto(BASE + screen.path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(600);
  } catch (err) {
    rec(`${screen.path}: loads`, false, String(err.message).split("\n")[0]);
    await ctx.close();
    continue;
  }

  /*
   * A rejected cookie lands on the sign in screen, which is a perfectly good
   * app shell and would pass every check below while measuring nothing.
   */
  if (new URL(page.url()).pathname.startsWith("/portal/login")) {
    rec(`${screen.path}: measured as itself`, false, "bounced to the sign in screen");
    await ctx.close();
    continue;
  }

  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const region = document.querySelector("[data-portal-scroll]");
    const header = document.querySelector("header");
    /*
     * BY ITS OWN HOOK, not by aria-label. The desktop rail nav carries the
     * same label, querySelector returns the first match, and at 390 the rail
     * is display:none, so the first version of this measured a zero height
     * element and reported the tab bar as 844px from the bottom on every
     * screen. The check was wrong, not the shell.
     */
    const tabs = document.querySelector("[data-portal-tabs]");
    return {
      docScroll: doc.scrollHeight - doc.clientHeight,
      hasRegion: Boolean(region),
      regionScrolls: region ? region.scrollHeight > region.clientHeight : false,
      overflowY: region ? getComputedStyle(region).overflowY : null,
      headerInside: Boolean(region && header && region.contains(header)),
      tabsInside: Boolean(region && tabs && region.contains(tabs)),
      headerTop: header ? Math.round(header.getBoundingClientRect().top) : null,
      tabsGap: tabs ? Math.round(window.innerHeight - tabs.getBoundingClientRect().bottom) : null,
      headerPadTop: header ? getComputedStyle(header).paddingTop : null,
      tabsPadBottom: tabs ? getComputedStyle(tabs).paddingBottom : null,
      visibleTables: [...document.querySelectorAll("table")].filter((t) => {
        const r = t.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length,
    };
  });

  measured += 1;

  /*
   * POINT 1. The page never scrolls; the content region does.
   *
   * One pixel of slack. A sub pixel viewport height in an emulated device
   * rounds against you, and a failure that only reproduces at one device scale
   * factor is noise rather than a finding.
   */
  rec(
    `${screen.path}: the page itself does not scroll`,
    m.docScroll <= 1,
    m.docScroll <= 1 ? "" : `the document scrolls by ${m.docScroll}px`,
  );
  rec(
    `${screen.path}: there is one named scrolling region`,
    m.hasRegion && m.overflowY === "auto",
    m.hasRegion ? `overflow-y: ${m.overflowY}` : "no [data-portal-scroll] element",
  );
  rec(
    `${screen.path}: the chrome is outside it`,
    m.hasRegion && !m.headerInside && !m.tabsInside,
    m.headerInside || m.tabsInside ? "chrome is inside the scrolling region" : "",
  );
  rec(
    `${screen.path}: the chrome is anchored to both edges`,
    m.headerTop === 0 && m.tabsGap === 0,
    `header at ${m.headerTop}, tab bar ${m.tabsGap} from the bottom`,
  );

/*
   * POINT 2. Nothing scrolls sideways without saying so.
   *
   * CONFIRMED BY MEASURING, not assumed from the shell work. Point 1 stopped
   * the DOCUMENT scrolling; it says nothing about a container inside it, and
   * this repository has now found content clipped with no affordance three
   * times: the navigation rail, the notification list and the command palette,
   * and two data tables.
   *
   * Every element whose scrollWidth exceeds its clientWidth is collected. Each
   * one is allowed only if it declares itself: .scroll-x or an explicit
   * overflow-x of auto or scroll, AND a way for a keyboard to reach it, which
   * is tabindex. A div that scrolls and takes no focus is content a keyboard
   * user cannot reach at all, which is the axe rule this portal has already
   * failed twice.
   */
  const sideways = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      /*
       * Visually hidden text clips BY DESIGN. The sr-only pattern is a 1px box
       * with overflow hidden, so every screen reader label on the page reports
       * an overflow. Skipping anything that occupies no visible space removes
       * them without needing to know the class name.
       */
      if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
      const st = getComputedStyle(el);
      const declares = st.overflowX === "auto" || st.overflowX === "scroll";
      const reachable = el.hasAttribute("tabindex");
      if (declares && reachable) continue;
      out.push(
        `<${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}> ` +
          `class="${(el.getAttribute("class") || "").slice(0, 50)}" ` +
          `${declares ? "declares but cannot be focused" : "clips with no affordance"}`,
      );
    }
    return out.slice(0, 4);
  });

  rec(
    `${screen.path}: nothing scrolls sideways without an affordance`,
    sideways.length === 0,
    sideways.join(" | "),
  );

  /*
   * POINT 8. A list that can grow is bounded.
   *
   * Asserted on the ONE property that can be measured from outside: a screen
   * does not render an unbounded number of rows. The cap is generous, because
   * this is a check against a list that grew rather than a design opinion about
   * page size, and a firm with three hundred files should see a red line rather
   * than a slow phone.
   *
   * Scroll position surviving navigation is the other half of point 8 and is
   * not asserted here. It needs a navigation and a return, which is a different
   * shape of test, and claiming it from a resting page would be the kind of
   * check this phase exists to remove.
   */
  const rowCount = await page.evaluate(() => {
    const region = document.querySelector("[data-portal-scroll]");
    if (!region) return 0;
    /*
     * TOP LEVEL ROWS ONLY. Counting every li counted the audit trail twice,
     * because each event card holds a list of its own, and reported 400 rows on
     * a page that caps at 200 and says so. A nested list is part of a row, not
     * another row.
     */
    return [...region.querySelectorAll("li, tbody > tr")].filter((el) => {
      /*
       * VISIBLE rows only, and top level only.
       *
       * querySelectorAll matches the hidden half of a card and table pair, so a
       * screen showing 200 cards at 390 reported 400 rows: the cards plus the
       * table rows behind display:none. Point 8 is about what a phone actually
       * renders, so that is what is counted.
       */
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return !el.parentElement?.closest("li");
    }).length;
  });
  rec(
    `${screen.path}: the list is bounded`,
    rowCount <= 250,
    `${rowCount} row(s)`,
  );


  /*
   * POINT 4. Tables become cards.
   *
   * Asserted as absence: at 390 there is no visible table element anywhere in
   * the portal. That is stronger than checking a table does not scroll
   * sideways, because a table narrow enough to fit is still a table, with a
   * header row a person has to hold in their head while reading across.
   *
   * DataTable renders the card list below md and the table at md and up, so
   * the same component satisfies both this and the desk.
   */
  rec(
    `${screen.path}: no table is rendered at 390`,
    m.visibleTables === 0,
    m.visibleTables === 0 ? "" : `${m.visibleTables} visible table element(s)`,
  );

  /*
   * POINT 3. Safe areas come from the environment rather than a constant.
   *
   * Asserted as "a padding is declared and it resolves", not as a pixel value:
   * a desktop browser reports 0px for every inset, which is correct there, so
   * demanding a number would fail everywhere except on a notched device.
   */
  rec(
    `${screen.path}: the chrome declares both safe area insets`,
    m.headerPadTop !== null && m.tabsPadBottom !== null,
    `top ${m.headerPadTop}, bottom ${m.tabsPadBottom}`,
  );

  /*
   * POINT 5. Modals and pickers present as sheets.
   *
   * OPENED AND MEASURED, on the one overlay every portal screen carries: the
   * More menu in the header. A resting page has no dialog on it, so a check
   * that only looked would pass by finding nothing.
   *
   * Three properties, and each is a way this goes wrong. It has to announce
   * itself as a dialog, or a screen reader meets an unlabelled div. It has to
   * sit against the bottom edge rather than floating in the middle, which is
   * the difference the operator is describing. And it must not fill the screen,
   * because a sheet sized to the viewport rather than its content is a page
   * wearing a sheet's corners.
   */
  {
    const trigger = await page.$('button[aria-label="More"]');
    if (!trigger) {
      rec(`${screen.path}: the More sheet is reachable`, false, "no More trigger in the header");
    } else {
      await trigger.click();
      await page.waitForTimeout(400);
      const sheet = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return null;
        const r = d.getBoundingClientRect();
        return {
          bottomGap: Math.round(window.innerHeight - r.bottom),
          height: Math.round(r.height),
          viewport: window.innerHeight,
          labelled: Boolean(d.getAttribute("aria-label") || d.getAttribute("aria-labelledby")),
          modal: d.getAttribute("aria-modal") === "true",
        };
      });

      rec(`${screen.path}: opening More presents a dialog`, sheet !== null, sheet ? "" : "nothing with role=dialog appeared");
      if (sheet) {
        rec(
          `${screen.path}: and it is anchored to the bottom edge`,
          sheet.bottomGap <= 1,
          `${sheet.bottomGap}px from the bottom`,
        );
        rec(
          `${screen.path}: and it is sized to its content, not the screen`,
          sheet.height < sheet.viewport * 0.9,
          `${sheet.height} of ${sheet.viewport}px`,
        );
        rec(
          `${screen.path}: and it is a labelled modal`,
          sheet.labelled && sheet.modal,
          `labelled ${sheet.labelled}, aria-modal ${sheet.modal}`,
        );
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
      const closed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
      rec(`${screen.path}: and Escape closes it`, closed);
    }
  }

  /*
   * POINT 6. Every interaction has a pressed state.
   *
   * MEASURED BY PRESSING IT. The first version of this check collected every
   * :active selector in the stylesheets, stripped the :active, and asked
   * whether each control matched what remained. It passed on everything, and
   * it was worthless: globals.css carries a deliberate global rule,
   *
   *   a:active, button:active, [role="button"]:active, label:active
   *
   * so stripping :active left the bare selectors "a" and "button", which match
   * every link and button on the page. The check reported that every control
   * declared a pressed state because one rule declared it for all of them, and
   * it would have gone on reporting that if the rule had been deleted and
   * replaced by nothing.
   *
   * Worth recording rather than quietly rewriting, because it is the same
   * defect this whole phase is about: a check that passes while looking at the
   * wrong thing. It also corrected the standard, which claimed the portal had
   * two pressed state rules. It has a global one, and had all along.
   *
   * So this presses the control and compares. A real press changes something a
   * person can see: opacity, background, transform, or colour. Nothing
   * changing means nothing happens under a finger.
   */
  /*
   * ONE LOOP: scroll it into view, measure it, press it, immediately.
   *
   * The first version collected every bounding box first and pressed them
   * afterwards. Scrolling the second control into view moved the first one, so
   * every press after the first landed on stale coordinates, hit whatever was
   * actually there, and reported a perfectly responsive button as doing
   * nothing. It produced seven confident findings and all seven were this.
   *
   * Caught by pressing one button by hand and watching its opacity go from 1
   * to 0.72, which is the check's own definition of responding.
   */
  /*
   * DISABLED CONTROLS ARE EXCLUDED, because a disabled control not responding
   * to a press is correct rather than a defect. :active does not match a
   * disabled button and should not. Both remaining findings after the stale
   * coordinate fix were disabled buttons, "Take the job" with no job yet and
   * "Add" with an empty field.
   */
  const controls = (
    await page.$$("[data-portal-scroll] button, [data-portal-scroll] a[href]")
  ).filter(Boolean);
  let pressedCount = 0;
  let bare = 0;
  const bareNames = [];

  for (const el of controls.slice(0, 4)) {
    let box;
    try {
      await el.scrollIntoViewIfNeeded({ timeout: 5000 });
      box = await el.boundingBox();
    } catch {
      continue;
    }
    if (!box || box.width === 0 || box.height === 0) continue;
    if (await el.evaluate((n) => n.disabled === true || n.getAttribute("aria-disabled") === "true")) continue;

    const read = () =>
      el.evaluate((n) => {
        const st = getComputedStyle(n);
        return `${st.opacity}|${st.backgroundColor}|${st.transform}|${st.color}`;
      });

    let resting;
    let held;
    try {
      resting = await read();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      held = await read();
      /*
       * RELEASED SOMEWHERE ELSE, ON PURPOSE. A click fires only when the down
       * and the up land on the same element, so moving away first reads the
       * pressed state without following the link.
       */
      await page.mouse.move(1, 1);
      await page.mouse.up();
    } catch {
      continue;
    }

    pressedCount += 1;
    if (held === resting) {
      bare += 1;
      bareNames.push(await el.evaluate((n) => (n.textContent ?? "").trim().slice(0, 24) || n.tagName));
    }
  }

  rec(
    `${screen.path}: pressing a control changes something visible`,
    pressedCount === 0 || bare === 0,
    pressedCount === 0
      ? "no controls on this screen, so nothing was pressed"
      : bare === 0
        ? `${pressedCount} pressed, all responded`
        : `${bare} of ${pressedCount} did nothing: ${bareNames.join(" | ")}`,
  );

  if (pressedCount > 0) screensWithControls += 1;
  totalControls += pressedCount;

  console.log(
    `  ${screen.path.padEnd(24)} doc ${String(m.docScroll).padStart(5)}px  ` +
      `region ${m.hasRegion ? (m.regionScrolls ? "scrolls" : "fits   ") : "MISSING"}  ` +
      `tables ${m.visibleTables}`,
  );

  await ctx.close();
}

await browser.close();

rec("screens were actually measured", measured > 0, `${measured} of ${SCREENS.length}`);
rec(
  "the pressed state result is not vacuous",
  screensWithControls >= 12,
  `${totalControls} control(s) across ${screensWithControls} of ${measured} screens; the rest render empty states because the probe accounts hold no data`,
);

const swept = await destroyProbes("native-audit");
rec("the probe accounts were removed", swept.ok, swept.note);

console.log("");
const failed = out.filter((c) => !c.ok);
for (const c of failed) console.log(`  FAIL: ${c.name}${c.note ? ` (${c.note})` : ""}`);
console.log("");
console.log(
  failed.length
    ? `FAIL: ${failed.length} of ${out.length} checks.`
    : `PASS: ${out.length} checks. The portal behaves as an application at 390.`,
);
process.exit(failed.length ? 1 : 0);
