// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`, so it
// cannot run under plain node or under tsx without the react-server condition.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees, so this line and the
// invocation cannot drift apart.
// Forms end to end. Drives all four forms in a real browser at 390px and
// asserts on what leaves the page, not on what the component looks like.
//
//   BASE_URL=http://localhost:3225 node scripts/forms-audit.mjs
//
// WHAT IT ASSERTS AND WHY IN THIS ORDER
// -------------------------------------
// The three things a form can silently get wrong, in increasing cost:
//
//   1. It accepts a submission it should have refused. Caught by submitting
//      empty and asserting both the inline errors AND that nothing was posted.
//      A form that shows an error and posts anyway is the worst of both.
//   2. It posts something other than what was typed. Caught by reading the POST
//      body off the wire and comparing it field by field. Clicking a control
//      proves the control works; only the request proves the answer travels.
//   3. It loses the submission after posting. Caught by the round trip check at
//      the bottom, which reads the row back out of the database.
//
// The round trip is the leg that needs a database, so it reports SKIP rather
// than PASS where one is not configured. A skip is a different fact from a pass
// and the summary keeps them apart, because a run that quietly counts skips as
// passes is how a broken write path ships.
import { chromium } from "playwright";
import { auditClient } from "./lib/db-target.mjs";
import { careersChecks } from "./lib/careers-audit.mjs";
import { guardedSurfaces } from "./lib/surfaces.mjs";
import { intakeAnswer } from "../src/lib/intake.ts";

/*
 * The audit reads the same env file the server does, and this is not a
 * convenience.
 *
 * This audit drives real forms through a real browser at a running Next server.
 * That server loads .env.local, so every submission writes a real row into
 * whatever database those credentials point at. The audit process is a plain
 * node script and does NOT load .env.local on its own, so it saw no credentials,
 * skipped its own teardown, and reported green.
 *
 * Thirty audit rows accumulated in the production tables across one session
 * before anybody looked. The suite passed every single run.
 *
 * This is the same defect as the `configured` bug in the careers module: the
 * audit deciding what the server can do by reading its own environment instead
 * of the server's. Loading the file here makes the two agree.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Absent in CI, which is fine. What is not fine is skipping teardown after a
  // submission succeeded, and the round trip block below now refuses to.
}

const BASE = process.env.BASE_URL || "http://localhost:3225";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const recSkip = (name, note = "") => out.push({ name, ok: true, skipped: true, note });

/** A name no real person submits, so audit rows are identifiable and removable. */
const MARKER = "Zzq Formsaudit";

/**
 * Whether this run put a row in a real table.
 *
 * Set the moment a form reports success, because at that point the server has
 * written. The teardown reads it to decide whether missing credentials are a
 * skip or a finding: "not checked" and "rows created and not removable" are
 * different sentences and only one of them is safe to print in green.
 */
let submissionsSucceeded = false;

/*
 * ===================================================================
 * WHAT A SUBMISSION IS ANSWERED WITH WHEN IT REACHED NOTHING.
 *
 * Exercised by calling the decision, before any browser starts, because the
 * only other way to reach these branches is to take the database away from a
 * running server mid audit.
 *
 * The defect this closes was live until 2026-09-06: /api/lead returned 200
 * whatever happened, so a database outage answered a person exactly as a
 * successful write did. This audit's own charter is "no silent failures, no
 * false success", and it had no check for the one route that did both.
 * ===================================================================
 */
{
  const ADDRESS = "info@example.com";

  const written = intakeAnswer({ written: true, sent: false }, ADDRESS);
  rec("a written enquiry answers 200", written.ok === true && written.status === 200);
  rec(
    "and says nothing else, because there is nothing to explain",
    written.message === undefined,
  );

  /*
   * The one worth arguing about. The row did not land and a person has the
   * enquiry in their mail, which is what the sender was asking for.
   */
  const carried = intakeAnswer({ written: false, sent: true }, ADDRESS);
  rec("an enquiry the direct send carried still answers 200", carried.ok === true);

  const lost = intakeAnswer({ written: false, sent: false }, ADDRESS);
  rec(
    "an enquiry that reached NOTHING is not answered with success",
    lost.ok === false && lost.status === 503,
    "this is the defect: a submission that reached nothing answered exactly like one that landed",
  );
  rec(
    "and it says plainly that nothing was saved",
    /nothing was saved/i.test(lost.message ?? ""),
    "trying again against a database that is down loses the enquiry a second time",
  );
  rec(
    "and gives an address that is not a form",
    (lost.message ?? "").includes(ADDRESS),
    "the fallback has to be a route that does not pass through the thing that just failed",
  );
  rec(
    "and the address is the caller's, not one this module invented",
    !/254engineering/.test(lost.message ?? ""),
    "a hardcoded address here would be a second place the firm's contact address lives",
  );
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

/** Capture POST bodies to an endpoint so assertions can read the wire. */
function trackPosts(page, endpoint) {
  const posts = [];
  page.on("request", (req) => {
    if (req.url().endsWith(endpoint) && req.method() === "POST") {
      try {
        posts.push(JSON.parse(req.postData() || "{}"));
      } catch {
        posts.push({ unparseable: true });
      }
    }
  });
  return posts;
}

/** Zero horizontal scroll, measured the same way the mobile audit measures it. */
async function noHScroll(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
  );
}

async function openForm(path, endpoint) {
  const page = await ctx.newPage();
  const posts = trackPosts(page, endpoint);
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  // Hydration. A click before it lands does nothing, and "nothing happened"
  // reads identically to "the handler is broken".
  await page.waitForTimeout(1200);
  return { page, posts };
}

// ---------- the two forms a person meets before they hold a session ----------

/*
 * THESE HAD NEVER BEEN EXERCISED BY ANYTHING.
 *
 * Phase 11 gate 0: forms-audit covered /contact and /api/lead, which are the
 * marketing site's two forms. The sign in form and the set password form, whose
 * failure is the most expensive failure in this product, were audited by
 * nothing at all while this file's summary claimed "every input and state, no
 * silent failures, no false success".
 *
 * No account is created for these. Both are reachable signed out, and both are
 * exercised in their REFUSING states, which is the half that matters: a sign in
 * that fails silently, or a dead link that says nothing useful, is how somebody
 * decides the software is broken.
 */
/**
 * THE CREDENTIAL FORMS OF EVERY GUARDED SURFACE, DERIVED, AS OF 2026-09-07.
 *
 * This function checked the portal's two and nothing else, so the partner's
 * sign in and set password screens and the customer's had never been exercised
 * by the audit whose remit is every input and state, no silent failures and no
 * false success. Three principals, three credential stores, and only one of
 * them had its front door measured.
 *
 * The checks themselves are unchanged in substance. What changed is that the
 * surface, its paths and its endpoints come from scripts/lib/surfaces.mjs
 * rather than being written here, so a fourth principal cannot ship with an
 * unexercised sign in screen.
 */
async function credentialFormChecks(surface) {
  const label = surface.key;
  const loginPath = `${surface.prefix}/login`;
  const setPasswordPath = `${surface.prefix}/set-password`;
  const sessionApi = `/api${surface.prefix}/session`;
  const setPasswordApi = `/api${surface.prefix}/set-password`;

  // ---- sign in
  {
    const { page } = await openForm(loginPath, sessionApi);
    const submit = page.getByRole("button", { name: /sign in/i }).first();

    rec(`${label} sign in: the form is on the page`, (await submit.count()) > 0);

    /*
     * Empty submit. The browser's own required validation may take this, which
     * is fine and is still a refusal the person can see; what must NOT happen
     * is a silent nothing.
     */
    await submit.click({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(900);
    const stillOnLogin = new URL(page.url()).pathname.startsWith(loginPath);
    rec(`${label} sign in: an empty submit does not navigate anywhere`, stillOnLogin, page.url());

    // Wrong credentials must say so, and must not say which half was wrong.
    await page.fill('input[type="email"], input[name="email"]', "nobody@example.invalid").catch(() => {});
    await page.fill('input[type="password"], input[name="password"]', "not-the-password").catch(() => {});
    await submit.click({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1800);

    /*
     * ASSERTED AS BEHAVIOUR, NOT AS A WORD LIST.
     *
     * The first version of this check matched a list of likely phrasings and
     * failed on "Check the email and password.", which is the correct copy. It
     * was the check that was wrong, and a check that fails on correct software
     * teaches everybody to ignore it, which is worse than not having it.
     *
     * What actually matters is that a live region APPEARED with text in it. Any
     * wording satisfies that; silence does not.
     */
    const alert = page.locator("[role=\"alert\"]");
    const alertText = ((await alert.count()) ? await alert.first().textContent() : "") ?? "";
    rec(
      `${label} sign in: a wrong credential produces a visible refusal`,
      alertText.trim().length > 0,
      alertText.trim() || "nothing was announced; a form that does nothing on failure reads as broken software",
    );

    /*
     * And it must not say WHICH half was wrong. A refusal that distinguishes a
     * bad address from a bad password is an account enumeration oracle, and
     * this is asserted on the alert rather than on the whole document so a
     * word in unrelated page copy cannot fail it.
     */
    rec(
      `${label} sign in: and the refusal does not say which half was wrong`,
      !/no such (account|user)|unknown email|email not found|wrong password|password is incorrect/i.test(alertText),
      alertText.trim(),
    );
    rec(`${label} sign in: no horizontal scroll in the error state`, await noHScroll(page));
    await page.close();
  }

  // ---- set password, dead link
  {
    const { page } = await openForm(`${setPasswordPath}?token=not-a-real-token`, setPasswordApi);
    const body = (await page.textContent("body")) ?? "";

    /*
     * The three kinds of dead are different facts with different answers, and
     * the page already distinguishes them. Asserted so it keeps doing so.
     */
    rec(
      `${label} set password: a dead link says which kind of dead it is`,
      /expired|already been used|not valid/i.test(body),
      "invalid link alone sends people to an administrator who cannot tell either",
    );
    rec(
      `${label} set password: and offers a way onward`,
      (await page.getByRole("link", { name: /sign in/i }).count()) > 0,
      "a dead end with no next step is where somebody gives up",
    );
    rec(
      `${label} set password: no password field is offered on a dead link`,
      (await page.locator('input[type="password"]').count()) === 0,
    );
    rec(`${label} set password: no horizontal scroll`, await noHScroll(page));
    await page.close();
  }
}

// ---------- contact ----------

async function contactChecks() {
  const { page, posts } = await openForm("/contact", "/api/lead");
  const submit = page.getByRole("button", { name: /send message/i });

  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "contact: an empty submission shows inline errors on the fields",
    (await page.getByText("Enter your name.").isVisible().catch(() => false)) &&
      (await page.getByText("Enter your email address.").isVisible().catch(() => false)),
  );
  rec("contact: an empty submission posts nothing", posts.length === 0);

  await page.locator('input[name="email"]').fill("not-an-email");
  await page.locator('input[name="name"]').fill(MARKER);
  await page.locator('textarea[name="message"]').fill("Forms audit run.");
  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "contact: a malformed email is caught with its own message and blocks the post",
    (await page.getByText(/does not look right/i).isVisible().catch(() => false)) && posts.length === 0,
  );

  await page.locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await page.locator('input[name="phone"]').fill("21055");
  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "contact: a short phone number is caught and blocks the post",
    (await page.getByText(/looks short/i).isVisible().catch(() => false)) && posts.length === 0,
  );

  await page.locator('input[name="phone"]').fill("2105550100");
  await page.locator('input[name="city"]').fill("Corpus Christi");
  await page.locator('select[name="service"]').selectOption("Windstorm WPI-8 Certifications");
  rec("contact: the form clears 390px with no horizontal scroll", await noHScroll(page));

  await submit.click();
  const success = await page
    .getByText(/your message is with us/i)
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (success) submissionsSucceeded = true;
  rec("contact: the success state replaces the form", success);
  rec(
    "contact: the success state clears 390px with no horizontal scroll",
    await noHScroll(page),
  );

  const sent = posts[posts.length - 1];
  rec("contact: exactly one POST for one submission", posts.length === 1);
  rec(
    "contact POST: carries every answer that was typed",
    !!sent &&
      sent.form === "contact" &&
      sent.name === MARKER &&
      sent.email === "forms.audit@254engineering.com" &&
      sent.phone === "2105550100" &&
      sent.city === "Corpus Christi" &&
      sent.service === "Windstorm WPI-8 Certifications" &&
      sent.message === "Forms audit run.",
  );
  rec("contact POST: carries the page it was submitted from", sent?.landingPath === "/contact");

  await page.close();
}


// ---------- the design brief ----------

/*
 * THE THREE FLAGS ARE WHAT THIS SECTION IS FOR.
 *
 * An open insurance claim, active litigation, and a prior adverse report each
 * change what an engineer can properly produce, and the specification says the
 * customer is told in the first conversation rather than after paying. All
 * three are required booleans with NO default, so an untouched select must
 * block rather than record a quiet no.
 *
 * WHY NO SUCCESSFUL ROUND TRIP IS EXERCISED HERE, STATED RATHER THAN OMITTED.
 * A complete submission writes a row to eng_design_inquiries, which is a
 * business record kept pending counsel and carries no delete path. Every board
 * run would leave one behind forever, which is exactly the defect recorded
 * against /portal/clients: seven probe rows a run, 306 of them now, on a screen
 * that cannot page. Repeating a known mistake to gain a check is a bad trade.
 * What is asserted is the validation, which is where the flags live; the write
 * path itself is exercised by the round trip checks against /api/lead.
 */
async function designInquiryChecks() {
  const { page, posts } = await openForm("/design-inquiry", "/api/design-inquiry");

  const submit = page.getByRole("button", { name: /send this brief/i });
  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "design brief: an empty submission blocks and posts nothing",
    (await page
      .getByText("Enter your name.")
      .isVisible()
      .catch(() => false)) && posts.length === 0,
  );

  /*
   * Everything else filled in and the three flags untouched. This is the case
   * that would silently record three noes if the conversion used || instead of
   * mapping an empty select to undefined.
   */
  await page.locator('input[name="name"]').fill(MARKER);
  await page.locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await page.locator('input[name="propertyAddress"]').fill("1 Audit Street, Corpus Christi");
  await page.selectOption('select[name="askingAs"]', "owner");
  await page.selectOption('select[name="workKind"]', "addition");
  await page.selectOption('select[name="deliverable"]', "sealed_plans");
  await submit.click();
  await page.waitForTimeout(500);

  rec(
    "design brief: the three flags are required, so an untouched one blocks rather than recording a quiet no",
    posts.length === 0,
    posts.length === 0
      ? "nothing was posted with the three unanswered"
      : "a brief was submitted with flags nobody answered",
  );
  rec(
    "design brief: and the refusal names which question was missed",
    await page
      .getByText(/open insurance claim|active or threatened litigation|prior adverse|reported adversely/i)
      .first()
      .isVisible()
      .catch(() => false),
  );

  await page.close();
}
// ---------- windstorm brief, for an existing building ----------

/*
 * =========================================================================
 * THE FORM THAT DOES NOT PERSIST YET, AND IS PROVEN TO SAY SO.
 * Operator ruling, 2026-09-20.
 * =========================================================================
 *
 * `/api/windstorm-inquiry` validates a brief completely and then REFUSES it,
 * because `eng_windstorm_inquiries` does not exist and a migration on `main` is
 * never pending. The split was ruled deliberately: the questions are the
 * engineer's and are settled; the persistence is what the table is for.
 *
 * **THE THING THIS CHECK EXISTS FOR IS THAT THE REFUSAL IS HONEST.** A form
 * that answers 200 and drops a person's name, telephone number and property
 * address is the `customer_link.issued` defect, which cost a paying customer a
 * telephone call to find out nothing had been sent. So what is asserted is that
 * a valid brief is NOT accepted and that the person is told, on screen, that
 * nothing was saved.
 *
 * It is also what makes the surface-audit exemption honest: that check refuses
 * an exemption whose named owner does not actually reference the path.
 *
 * WHEN THE TABLE LANDS this check inverts: the brief is accepted, and what is
 * asserted becomes the row and the respond_by promise. It is written so that
 * the day somebody makes it persist, this goes red and names the reason.
 */
async function windstormInquiryChecks() {
  const { page, posts } = await openForm("/windstorm-inquiry", "/api/windstorm-inquiry");

  const submit = page.getByRole("button", { name: /send the brief/i });
  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "windstorm brief: an empty submission blocks and posts nothing",
    (await page
      .getByText("Enter your name.")
      .isVisible()
      .catch(() => false)) && posts.length === 0,
  );

  /*
   * THE EMAIL IS THE SAME LITERAL THE OTHER CHECKS USE, and the selects use
   * this file's `page.selectOption(selector, value)` idiom.
   *
   * The first version of this block referenced `PROBE_EMAIL`, a constant that
   * does not exist here, and forms-audit DIED ON THIS LINE before driving a
   * single form. Three working forms went unmeasured because of a check added
   * for a fourth. See the entry in CLAUDE.md: a check that has never run is not
   * a check, and a check that crashes takes its neighbours with it.
   */
  await page.locator('input[name="name"]').fill(MARKER);
  await page.locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await page.locator('input[name="propertyAddress"]').fill("11 Audit Street, Corpus Christi");
  /*
   * THE YEAR OF THE WORK, AND DELIBERATELY NOT THE YEAR BUILT.
   *
   * 1995 goes into `mostRecentWorkYear` and `yearBuilt` is left EMPTY, so the
   * read-back below can prove the row carries the work year and a null
   * construction year. A fixture that filled both could not tell the two apart,
   * and telling them apart is the whole correction of 2026-09-21.
   */
  await page.locator('input[name="mostRecentWorkYear"]').fill("1995");
  await page.locator('textarea[name="workDone"]').fill("Reroof in 2021 by a local contractor.");
  await page.locator('textarea[name="whatIsCovered"]').fill("Sheathing and deck attachment are covered.");
  await page.selectOption('select[name="askingAs"]', "owner");
  await page.selectOption('select[name="workYearUnknown"]', "no");
  await page.selectOption('select[name="openingsRated"]', "unknown");
  await page.selectOption('select[name="willOpenUp"]', "yes");
  await page.selectOption('select[name="openInsuranceClaim"]', "no");
  await page.selectOption('select[name="activeLitigation"]', "no");
  await page.selectOption('select[name="priorAdverseReport"]', "no");

  await submit.click();
  await page.waitForTimeout(900);

  rec(
    "and a complete brief passes validation and reaches the route",
    posts.length === 1,
    `${posts.length} post(s)`,
  );

  /*
   * THE FLAGS TRAVEL AS BOOLEANS, which is the same defect the design brief
   * check guards: a select mapped with || would send three noes for three
   * questions nobody answered.
   */
  const sent = posts[0] ?? {};
  rec(
    "and the answers that travel are the answers that were given",
    sent.mostRecentWorkYear === 1995 &&
      sent.workYearUnknown === false &&
      sent.yearBuilt === undefined &&
      sent.openInsuranceClaim === false,
    JSON.stringify({ work: sent.mostRecentWorkYear, unknown: sent.workYearUnknown, built: sent.yearBuilt }),
  );

  /*
   * =====================================================================
   * INVERTED 2026-09-21, WHEN 0054 GAVE IT A TABLE.
   * =====================================================================
   *
   * This asserted that a valid brief was REFUSED and that the person was told
   * nothing had been saved, which was the correct assertion while the table did
   * not exist. It now asserts the opposite, and the comment is kept because a
   * check that flips its meaning should say when and why rather than read as
   * though it always meant this.
   *
   * **IT ASSERTS THE ROW, NOT THE STATUS CODE.** A route can answer 200 and
   * write nothing: that is `customer_link.issued`, the defect this whole form
   * was built around, and a check reading only the response would pass over it
   * perfectly. So the brief is read back out of `eng_windstorm_inquiries` by
   * the marker this run wrote, and its answers are compared.
   */
  /*
   * THE ACKNOWLEDGEMENT IS ON SCREEN, WHICH THE FIRST VERSION DID NOT CHECK.
   *
   * That version asserted the ROUTE's sentence, and the route's sentence never
   * reached a screen: `useFormPost` discards the response body on success by
   * design, and this form had no success branch at all. So the row was written,
   * the check passed on the read-back, and a person submitting the form would
   * have seen nothing happen. Found by running it rather than by reading it.
   */
  const accepted = await page
    .getByText(/your brief is with us/i)
    .isVisible()
    .catch(() => false);
  rec(
    "and the person is told on screen that the brief arrived",
    accepted,
    accepted ? "" : "A ROW WITH NO ACKNOWLEDGEMENT is a form that looks broken to the person who filled it in",
  );
  /*
   * AND IT DOES NOT HAND THEM A SCOPE DETERMINATION. Telling a stranger their
   * work is in scope under 2210.251, from a form, is an opinion arriving from
   * the wrong place. Staff see it on the portal screen; the enquirer hears it
   * from a person.
   *
   * ASSERTED ON THE RESPONSE BODY RATHER THAN ON THE PAGE, and the first
   * version taught me why. It searched the rendered page for "in scope" and
   * "2210.251" and went red, because the page LEGITIMATELY explains the statute
   * above the form: that is the educational copy a reader needs, not a verdict
   * on their property. A matcher matching a name when it means something else,
   * in a check written to catch exactly that class.
   *
   * The response body cannot be confused with page copy. The route answers
   * `{ ok: true }` and nothing else, so a determination reaching the public
   * would have to appear here first.
   */
  const body = await page.evaluate(async (marker) => {
    const res = await fetch("/api/windstorm-inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: marker,
        email: "forms.audit@254engineering.com",
        askingAs: "owner",
        propertyAddress: "12 Audit Street, Corpus Christi",
        mostRecentWorkYear: 1995,
        workYearUnknown: false,
        workDone: "Reroof in 2021 by a local contractor.",
        whatIsCovered: "Sheathing and deck attachment are covered.",
        openingsRated: "unknown",
        willOpenUp: "yes",
        openInsuranceClaim: false,
        activeLitigation: false,
        priorAdverseReport: false,
      }),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }, MARKER);

  const keys = Object.keys(body.json ?? {}).sort().join(",");
  rec(
    "and the route hands the public no scope determination, only an acknowledgement",
    body.status === 200 && keys === "ok",
    `status ${body.status}, keys {${keys}}`,
  );

  /*
   * THE CLIENT IS ASSERTED RATHER THAN SKIPPED. Without it the write path is
   * unproven, and a check that quietly passes over "I could not look" is the
   * shape this repository spends its time removing. The lead round trip below
   * assumes a client for the same reason; this one says so out loud.
   */
  const db = auditClient("forms-audit");
  rec(
    "a database client exists to read the brief back with",
    Boolean(db),
    db ? "" : "WITHOUT ONE THE WRITE PATH IS UNPROVEN, and a 200 is not evidence of a row",
  );
  if (db) {
    const { data: rows } = await db
      .from("eng_windstorm_inquiries")
      .select("name, most_recent_work_year, year_built, openings_rated, will_open_up, open_insurance_claim, respond_by, responded_at")
      .eq("name", MARKER)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (rows ?? [])[0];

    rec(
      "and the brief is actually in the table, read back by this run's marker",
      Boolean(row),
      row ? "" : "A 200 WITH NO ROW IS customer_link.issued, which is what this form was built around",
    );

    /*
     * THE YEAR OF THE WORK IS THE ONE THAT MATTERS, so it is the one compared.
     * 1995 was typed into the work year field, not the construction year, and a
     * row carrying it under `year_built` would be the old defect wearing the
     * new column.
     */
    rec(
      "and the year it carries is the year of the WORK, not the year built",
      row?.most_recent_work_year === 1995 && row?.year_built === null,
      row ? `work ${row.most_recent_work_year}, built ${row.year_built}` : "no row",
    );

    rec(
      "and the answers that decide the job survived the round trip",
      row?.openings_rated === "unknown" &&
        row?.will_open_up === "yes" &&
        row?.open_insurance_claim === false,
      row ? `${row.openings_rated}, ${row.will_open_up}, claim ${row.open_insurance_claim}` : "no row",
    );

    /*
     * THE 24 HOUR PROMISE IS A COLUMN RATHER THAN A CONVENTION, and it arrives
     * unanswered. A row born with `responded_at` set would mean the promise was
     * discharged by the act of making it.
     */
    rec(
      "and it carries an unanswered 24 hour promise",
      Boolean(row?.respond_by) && row?.responded_at === null,
      row?.respond_by ? `respond_by ${String(row.respond_by).slice(0, 16)}, unanswered` : "no promise",
    );

    /*
     * TEARDOWN, AND IT SWEEPS THE MARKER RATHER THAN THE ID IT JUST WROTE.
     * The portal-probe lesson, applied here rather than rediscovered: deleting
     * exactly what the verification looks for is the only version where a run
     * that died before teardown is cleaned up by the next one. mfa-audit is the
     * counter-example, and it stranded a role for a day.
     */
    const { error: sweepError } = await db.from("eng_windstorm_inquiries").delete().eq("name", MARKER);
    const { data: left } = await db
      .from("eng_windstorm_inquiries")
      .select("id")
      .eq("name", MARKER);
    rec(
      "and the probe brief is swept, by marker rather than by id",
      !sweepError && (left ?? []).length === 0,
      sweepError ? sweepError.message : `${(left ?? []).length} left behind`,
    );
  }

  await page.close();
}

// ---------- waitlist ----------

async function waitlistChecks() {
  const { page, posts } = await openForm(
    "/waitlist?service=" + encodeURIComponent("Roof Inspections and Certifications"),
    "/api/lead",
  );

  rec(
    "waitlist: the service arrives preselected from the service page link",
    (await page.locator('select[name="service"]').inputValue()) ===
      "Roof Inspections and Certifications",
  );

  // An arbitrary query string must not become the selected value. The page falls
  // through to no selection rather than reflecting somebody else's text.
  const rogue = await ctx.newPage();
  await rogue.goto(BASE + "/waitlist?service=Totally%20Made%20Up%20Service", {
    waitUntil: "networkidle",
  });
  rec(
    "waitlist: an unknown service in the query string falls through to no selection",
    (await rogue.locator('select[name="service"]').inputValue()) === "",
  );
  await rogue.close();

  const submit = page.getByRole("button", { name: /join the waitlist/i });
  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "waitlist: an empty submission blocks and posts nothing",
    (await page.getByText("Enter your name.").isVisible().catch(() => false)) && posts.length === 0,
  );

  await page.locator('input[name="name"]').fill(MARKER);
  await page.locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await submit.click();
  const success = await page
    .getByText(/we have your details/i)
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (success) submissionsSucceeded = true;
  rec("waitlist: the message field is optional and the form submits without it", success);

  const sent = posts[posts.length - 1];
  rec(
    "waitlist POST: marked as a waitlist entry, not a contact",
    !!sent && sent.form === "waitlist",
  );
  rec(
    "waitlist POST: carries the preselected service",
    !!sent && sent.service === "Roof Inspections and Certifications",
  );

  await page.close();
}

// ---------- honeypot ----------

async function honeypotChecks() {
  const { page, posts } = await openForm("/contact", "/api/lead");

  const honey = page.locator('input[name="company"]');
  const present = (await honey.count()) === 1;
  const hidden = present
    ? await honey.evaluate((el) => el.tabIndex === -1 && el.getBoundingClientRect().left < 0)
    : false;
  rec("honeypot: field present, off screen, and out of the tab order", present && hidden);

  await page.locator('input[name="name"]').fill("Bot Submitter");
  await page.locator('input[name="email"]').fill("bot@254engineering.com");
  await page.locator('textarea[name="message"]').fill("spam");
  await honey.evaluate((el) => (el.value = "spammy"));
  await page.getByRole("button", { name: /send message/i }).click();

  const accepted = await page
    .getByText(/your message is with us/i)
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  rec(
    "honeypot: a filled honeypot is answered with success rather than an error",
    accepted,
    "a bot told it failed learns; one told it succeeded goes away",
  );
  rec(
    "honeypot: the value rides the POST so the server can drop it",
    posts.some((p) => p.company === "spammy"),
  );

  await page.close();
}

// ---------- careers ----------

// ---------- server side guards ----------

async function apiGuardChecks() {
  const post = (path, body) =>
    fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // The form validates, and so does the route, because a form is an HTTP
  // endpoint and anyone can post to it.
  const empty = await post("/api/lead", { form: "contact" });
  rec("API: /api/lead refuses an empty body server side", empty.status === 422, String(empty.status));

  const badEmail = await post("/api/lead", {
    form: "contact",
    name: "Direct Post",
    email: "nope",
    message: "hi",
  });
  rec("API: /api/lead refuses a malformed email server side", badEmail.status === 422);

  const malformed = await fetch(BASE + "/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  rec("API: /api/lead answers 400 on a malformed body rather than throwing", malformed.status === 400);

}

// ---------- database round trip ----------

/**
 * The one leg that proves a submission survives past the HTTP 200.
 *
 * Everything above asserts on the request. This asserts on the row, which is the
 * only check that would catch a route that answers 200 and writes nothing, and
 * that is precisely the failure mode the intake layer is designed to produce on
 * purpose when the database is unreachable.
 */
async function roundTripChecks() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    /*
     * A skip here used to be unconditional, and it was wrong whenever the
     * submissions above had succeeded.
     *
     * If a submission returned success, the server wrote a row. Skipping then
     * does not mean "this leg was not checked", it means "rows were created and
     * this run has no way to remove them". Those are different sentences and
     * only one of them is safe to print in green.
     */
    if (submissionsSucceeded) {
      rec(
        "round trip: audit rows are removed afterward",
        false,
        "submissions succeeded, so rows were written, but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set for this run and the rows cannot be removed",
      );
      return;
    }
    recSkip(
      "round trip: a submitted lead lands in eng_leads",
      "no submission succeeded and no credentials for this run",
    );
    recSkip("round trip: a submitted application lands in eng_applications", "same");
    return;
  }

  const db = auditClient("forms-audit");

  const { data: leads } = await db
    .from("eng_leads")
    .select("id, site, form, name, service")
    .eq("site", "254")
    .eq("name", MARKER);

  rec(
    "round trip: a submitted lead lands in eng_leads under site 254",
    Array.isArray(leads) && leads.length >= 2 && leads.every((r) => r.site === "254"),
    `${leads?.length ?? 0} row(s)`,
  );
  rec(
    "round trip: the contact and the waitlist rows are distinguishable by form",
    Array.isArray(leads) &&
      leads.some((r) => r.form === "contact") &&
      leads.some((r) => r.form === "waitlist"),
  );

  const { data: apps } = await db
    .from("eng_applications")
    .select("id, site, role, name, payload")
    .eq("site", "254")
    .eq("name", MARKER);

  rec(
    "round trip: the technician application lands in eng_applications under site 254",
    Array.isArray(apps) && apps.length >= 1 && apps.every((r) => r.site === "254"),
    `${apps?.length ?? 0} row(s)`,
  );
  rec(
    "round trip: the structured answers land in the payload column",
    Array.isArray(apps) &&
      apps.some(
        (r) =>
          r.role === "field_technician" &&
          Array.isArray(r.payload?.countiesServed) &&
          r.payload.countiesServed.length === 18 &&
          r.payload.backgroundOther === "Storm restoration",
      ),
  );
  rec(
    "round trip: the row id is the id the uploads were keyed to",
    Array.isArray(apps) && apps.some((r) => r.id === r.payload?.applicationId),
  );

  /*
   * Teardown, rows and objects.
   *
   * Two separate leaks, fixed on two branches, and both are kept here.
   *
   * The objects: once the engineer submit stopped being a skip and performed a
   * real upload, the audit wrote a resume into eng-uploads on every run and
   * removed only the row that pointed at it, leaving a private bucket filling
   * with orphaned PDFs no record referenced. Uploads are keyed by application
   * id, so the ids collected above are exactly the prefixes to remove and
   * nothing else in the bucket is touched.
   *
   * The rows: the check on the row delete asserted `!error`, and a delete that
   * matches nothing does not error, so it passed through every run that left
   * rows behind. Thirty of them accumulated in the production tables before
   * anybody looked. The assertion counts what survives instead.
   */
  const appIds = Array.isArray(apps) ? apps.map((r) => r.id).filter(Boolean) : [];

  await db.from("eng_leads").delete().eq("site", "254").eq("name", MARKER);
  await db.from("eng_applications").delete().eq("site", "254").eq("name", MARKER);

  const { count: leadsLeft } = await db
    .from("eng_leads")
    .select("id", { count: "exact", head: true })
    .eq("name", MARKER);
  const { count: appsLeft } = await db
    .from("eng_applications")
    .select("id", { count: "exact", head: true })
    .eq("name", MARKER);

  rec(
    "round trip: audit rows are removed afterward",
    leadsLeft === 0 && appsLeft === 0,
    `${leadsLeft ?? "?"} lead(s) and ${appsLeft ?? "?"} application(s) still present`,
  );

  let objectsRemoved = 0;
  let objectError = "";
  for (const id of appIds) {
    const listed = await db.storage.from("eng-uploads").list(`254/${id}`);
    if (listed.error) {
      objectError = listed.error.message;
      continue;
    }
    const paths = (listed.data ?? []).map((o) => `254/${id}/${o.name}`);
    if (paths.length === 0) continue;
    const removed = await db.storage.from("eng-uploads").remove(paths);
    if (removed.error) objectError = removed.error.message;
    else objectsRemoved += paths.length;
  }
  rec(
    "round trip: uploaded documents are removed afterward",
    objectError === "",
    objectError || `${objectsRemoved} object(s) removed across ${appIds.length} application(s)`,
  );
}

// ---------- run ----------

try {
  await contactChecks();
  await waitlistChecks();
  await designInquiryChecks();
  await windstormInquiryChecks();
  await honeypotChecks();
  // The careers flows moved to their own module when they became five step
  // applications with uploads. They are long enough that leaving them inline
  // would have buried the lead and waitlist checks under them.
  await careersChecks(ctx, BASE, rec, recSkip);
  await apiGuardChecks();
  await roundTripChecks();

  /*
   * LAST, DELIBERATELY, AND THE REASON IS RECORDED RATHER THAN GUESSED.
   *
   * Placed before the marketing form checks, this block made careersChecks time
   * out waiting for the application flow submit button. Isolated to one line:
   * the deliberate wrong credential submit. With the whole block present but
   * that single fill disabled, 89 of 89 pass. With it enabled and the block
   * running first, careers fails.
   *
   * THE MECHANISM IS NOT ESTABLISHED. It is not the login rate limiter, which
   * is keyed by address and identity and which /api/apply does not consult.
   * Running these last removes the interference, and is the better order
   * regardless, since the portal pre-session forms have nothing to do with the
   * public intake forms.
   *
   * Recorded in BACKLOG rather than left here, because an unexplained
   * interaction between two audits is something somebody has to look at rather
   * than a fact about this file.
   */
  /*
   * Every guarded surface, not just the portal. A surface whose sign in screen
   * cannot be found is a FAILURE rather than a skip: it means the inventory and
   * the routes disagree, which is the thing the inventory exists to prevent.
   */
  for (const surface of guardedSurfaces()) {
    await credentialFormChecks(surface);
  }
} finally {
  await browser.close();
}

console.log("=== FORMS E2E ===");
for (const r of out) {
  const state = r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL";
  console.log(`  ${state}: ${r.name}${r.note ? " (" + r.note + ")" : ""}`);
}
const fails = out.filter((r) => !r.ok);
const skips = out.filter((r) => r.skipped);
const ran = out.length - skips.length;
console.log(`\n${ran - fails.length}/${ran} pass${skips.length ? `, ${skips.length} skipped` : ""}`);
process.exitCode = fails.length ? 1 : 0;
