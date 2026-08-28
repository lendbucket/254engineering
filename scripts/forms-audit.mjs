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
import { careersChecks } from "./lib/careers-audit.mjs";

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
  await honeypotChecks();
  // The careers flows moved to their own module when they became five step
  // applications with uploads. They are long enough that leaving them inline
  // would have buried the lead and waitlist checks under them.
  await careersChecks(ctx, BASE, rec, recSkip);
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
