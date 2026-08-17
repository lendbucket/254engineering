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
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL || "http://localhost:3225";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const recSkip = (name, note = "") => out.push({ name, ok: true, skipped: true, note });

/** A name no real person submits, so audit rows are identifiable and removable. */
const MARKER = "Zzq Formsaudit";

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

async function engineerChecks() {
  const { page, posts } = await openForm("/careers", "/api/apply");
  const section = page.locator("#professional-engineers");
  const submit = section.getByRole("button", { name: /submit application/i });

  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "PE application: an empty submission blocks and posts nothing",
    (await section.getByText("Enter your name.").isVisible().catch(() => false)) &&
      posts.length === 0,
  );

  await section.locator('input[name="name"]').fill(MARKER);
  await section.locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await section.locator('input[name="city"]').fill("Austin");
  await section.locator('input[name="licenseNumber"]').fill("PE123456");
  await section.locator('input[name="disciplines"]').fill("Structural, civil");
  await section.locator('input[name="availability"]').fill("Twenty hours a week");
  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "PE application: the TDI appointment question is required, not optional",
    (await section.getByText(/whether you hold a TDI windstorm appointment/i).isVisible().catch(() => false)) &&
      posts.length === 0,
  );

  await section.locator('input[name="tdiAppointed"][value="yes"]').check();
  rec(
    "PE application: the yes and no options are a real radio group in a fieldset",
    (await section.locator("fieldset legend").count()) > 0,
  );
  rec("PE application: the form clears 390px with no horizontal scroll", await noHScroll(page));

  await submit.click();
  const success = await page
    .getByText(/we have your application/i)
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  rec("PE application: the success state renders", success);

  const sent = posts[posts.length - 1];
  rec("PE application: exactly one POST", posts.length === 1);
  rec(
    "PE application POST: filed under the engineer track with every answer",
    !!sent &&
      sent.role === "professional_engineer" &&
      sent.name === MARKER &&
      sent.city === "Austin" &&
      sent.licenseNumber === "PE123456" &&
      sent.disciplines === "Structural, civil" &&
      sent.tdiAppointed === "yes" &&
      sent.availability === "Twenty hours a week",
  );

  await page.close();
}

async function technicianChecks() {
  const { page, posts } = await openForm("/careers", "/api/apply");
  const section = page.locator("#field-technicians");
  const submit = section.getByRole("button", { name: /submit application/i });

  await submit.click();
  await page.waitForTimeout(400);
  rec(
    "technician application: an empty submission blocks and posts nothing",
    (await section.getByText("Enter your name.").isVisible().catch(() => false)) &&
      posts.length === 0,
  );

  await section.locator('input[name="name"]').fill(MARKER);
  await section.locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await section.locator('input[name="city"]').fill("Lubbock");
  await section.locator('textarea[name="counties"]').fill("Lubbock, Hale, Hockley, Terry");
  await section.locator('textarea[name="experience"]').fill("Nine years roofing.");
  await section.locator('input[name="droneLicense"][value="yes"]').check();
  await section.locator('input[name="reliableVehicle"][value="yes"]').check();
  rec(
    "technician application: the form clears 390px with no horizontal scroll",
    await noHScroll(page),
  );

  await submit.click();
  const success = await page
    .getByText(/we have your application/i)
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  rec("technician application: the success state renders", success);

  const sent = posts[posts.length - 1];
  rec(
    "technician application POST: filed under the technician track with every answer",
    !!sent &&
      sent.role === "field_technician" &&
      sent.city === "Lubbock" &&
      sent.counties === "Lubbock, Hale, Hockley, Terry" &&
      sent.droneLicense === "yes" &&
      sent.reliableVehicle === "yes",
  );

  await page.close();
}

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

  const unknownRole = await post("/api/apply", { role: "chief-wizard", name: "X" });
  rec(
    "API: /api/apply refuses an unknown role rather than guessing a track",
    unknownRole.status === 400,
    String(unknownRole.status),
  );

  const wrongTrack = await post("/api/apply", {
    role: "professional_engineer",
    name: "Direct Post",
    email: "forms.audit@254engineering.com",
    city: "Austin",
    // No licence number, which the technician schema would not have asked for.
    counties: "Travis",
  });
  rec(
    "API: /api/apply validates against the schema for the declared track",
    wrongTrack.status === 422,
    String(wrongTrack.status),
  );
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
    recSkip(
      "round trip: a submitted lead lands in eng_leads",
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set for this run",
    );
    recSkip("round trip: a submitted application lands in eng_applications", "same");
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

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
    .select("id, site, role, name, license_number, counties, tdi_appointed, drone_license")
    .eq("site", "254")
    .eq("name", MARKER);

  rec(
    "round trip: both applications land in eng_applications under site 254",
    Array.isArray(apps) && apps.length >= 2,
    `${apps?.length ?? 0} row(s)`,
  );
  rec(
    "round trip: the engineer row keeps the licence and the boolean answer",
    Array.isArray(apps) &&
      apps.some((r) => r.role === "professional_engineer" && r.license_number === "PE123456" && r.tdi_appointed === true),
  );
  rec(
    "round trip: the technician row keeps the counties and the boolean answer",
    Array.isArray(apps) &&
      apps.some((r) => r.role === "field_technician" && r.drone_license === true && String(r.counties).includes("Hockley")),
  );

  // Teardown. Audit rows do not belong in a table an operator reads.
  const delLeads = await db.from("eng_leads").delete().eq("site", "254").eq("name", MARKER);
  const delApps = await db.from("eng_applications").delete().eq("site", "254").eq("name", MARKER);
  rec(
    "round trip: audit rows are removed afterward",
    !delLeads.error && !delApps.error,
    delLeads.error?.message || delApps.error?.message || "",
  );
}

// ---------- run ----------

try {
  await contactChecks();
  await waitlistChecks();
  await honeypotChecks();
  await engineerChecks();
  await technicianChecks();
  await apiGuardChecks();
  await roundTripChecks();
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
