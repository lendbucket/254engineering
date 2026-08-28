/**
 * The careers application flows, driven end to end in a real browser.
 *
 * WHAT THIS COVERS AND WHAT IT HONESTLY CANNOT
 * --------------------------------------------
 * Both roles, all five steps, per step validation, the review read back, the
 * consent gate, state surviving back navigation, and zero horizontal scroll at
 * 390 on every step. The technician flow is driven all the way through submit
 * and the POST body is asserted field by field.
 *
 * The engineer flow stops at documents, and that is a real limitation stated
 * rather than papered over: a resume is required for that seat, uploading one
 * needs Supabase storage, and a checkout with no keys cannot complete it. What
 * IS asserted is that the requirement blocks, which is the property that matters
 * most, plus the upload failure state, which on an unconfigured checkout is the
 * path a real applicant would hit if storage were down.
 *
 * Launch modes: the application flow is deliberately identical in both, because
 * hiring is not gated on the firm registration. What differs is the notice above
 * it, and that is asserted by scripts/launch-audit.mjs where both modes are
 * actually booted. Driving the same flow twice here would measure one thing and
 * report two.
 */

const STEP_TIMEOUT = 12000;

/** Zero horizontal scroll, measured the way the mobile audit measures it. */
async function noHScroll(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
  );
}

/** The flow, scoped. The page has its own headings and buttons around it. */
const flowOf = (page) => page.getByTestId("application-flow");

async function continueStep(page) {
  await flowOf(page).getByRole("button", { name: /^continue$/i }).click({ timeout: STEP_TIMEOUT });
  await page.waitForTimeout(250);
}

/** The heading of the step currently on screen. */
async function stepHeading(page) {
  return (await flowOf(page).locator("h2").first().textContent().catch(() => "")) || "";
}

export async function careersChecks(ctx, BASE, rec, recSkip) {
  await technicianFlow(ctx, BASE, rec);
  await engineerFlow(ctx, BASE, rec, recSkip);
  await sharedChecks(ctx, BASE, rec);
}

// ------------------------------------------------------------- technician

async function technicianFlow(ctx, BASE, rec) {
  const page = await ctx.newPage();
  const posts = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/api/apply") && req.method() === "POST") {
      try {
        posts.push(JSON.parse(req.postData() || "{}"));
      } catch {
        posts.push({ unparseable: true });
      }
    }
  });

  await page.goto(`${BASE}/careers/field-inspection-technician`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const widths = [];

  // ---- step 1: contact ----
  rec("technician: flow opens on the contact step", /contact/i.test(await stepHeading(page)));
  widths.push(await noHScroll(page));

  await continueStep(page);
  rec(
    "technician step 1: an empty step blocks with named inline errors",
    (await page.getByText("Enter your full name.").isVisible().catch(() => false)) &&
      /contact/i.test(await stepHeading(page)),
  );
  rec("technician step 1: a blocked step posts nothing", posts.length === 0);

  await flowOf(page).locator('input[name="fullName"]').fill("Zzq Formsaudit");
  await flowOf(page).locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await flowOf(page).locator('input[name="phone"]').fill("21055");
  await flowOf(page).locator('input[name="city"]').fill("Corpus Christi");
  await flowOf(page).locator('input[name="countyOfResidence"]').fill("Nueces");
  await continueStep(page);
  rec(
    "technician step 1: a short phone number is caught with its own message",
    await page.getByText(/looks short/i).isVisible().catch(() => false),
  );

  await flowOf(page).locator('input[name="phone"]').fill("2105550100");
  await continueStep(page);
  rec("technician step 2 reached", /coverage/i.test(await stepHeading(page)));

  // ---- step 2: coverage ----
  widths.push(await noHScroll(page));
  await continueStep(page);
  rec(
    "technician step 2: at least one county is required",
    (await page.getByText(/at least one county/i).isVisible().catch(() => false)) &&
      /coverage/i.test(await stepHeading(page)),
  );

  // Open a region and take the whole thing, which is the two tap path the
  // picker exists to provide.
  await flowOf(page).getByRole("button", { name: /Coastal Bend/i }).click();
  await page.waitForTimeout(200);
  const allButtons = flowOf(page).getByRole("button", { name: /^All$/ });
  await allButtons.first().click();
  await page.waitForTimeout(200);
  rec(
    "technician step 2: the region select all takes every county in that region",
    await page.getByText(/18 counties selected/i).isVisible().catch(() => false),
  );

  await flowOf(page).locator('input[name="reliableVehicle"][value="yes"]').check();
  await flowOf(page).locator('input[name="willingToClimb"][value="yes"]').check();
  await continueStep(page);
  rec("technician step 3 reached", /experience/i.test(await stepHeading(page)));

  // ---- step 3: experience ----
  widths.push(await noHScroll(page));
  await continueStep(page);
  rec(
    "technician step 3: a background is required",
    await page.getByText(/at least one background/i).isVisible().catch(() => false),
  );

  await flowOf(page).getByText("Roofing", { exact: true }).click();
  await flowOf(page).getByText("Other", { exact: true }).click();
  await page.waitForTimeout(200);
  rec(
    "technician step 3: choosing Other reveals the free text field",
    (await flowOf(page).locator('input[name="backgroundOther"]').count()) === 1,
  );
  await flowOf(page).locator('input[name="backgroundOther"]').fill("Storm restoration");
  await flowOf(page).locator('select[name="yearsExperience"]').selectOption("5 to 10 years");
  await flowOf(page).locator('input[name="part107"][value="yes"]').check();
  await flowOf(page).locator('input[name="liabilityInsurance"][value="no"]').check();
  await continueStep(page);
  rec("technician step 4 reached", /documents/i.test(await stepHeading(page)));

  // ---- step 4: documents ----
  widths.push(await noHScroll(page));
  rec(
    "technician step 4: documents are optional for this role and do not block",
    true,
    "asserted by advancing without one, below",
  );
  await continueStep(page);
  rec("technician step 5 reached", /review/i.test(await stepHeading(page)));

  // ---- step 5: review ----
  widths.push(await noHScroll(page));
  const reviewText = await page.locator("body").innerText();
  rec(
    "technician review: reads back answers from every earlier step",
    reviewText.includes("Zzq Formsaudit") &&
      reviewText.includes("Nueces") &&
      reviewText.includes("Roofing") &&
      reviewText.includes("5 to 10 years"),
  );

  await flowOf(page).getByRole("button", { name: /submit application/i }).click();
  await page.waitForTimeout(400);
  rec(
    "technician review: consent is required and blocks submission",
    (await page.getByText(/tick the box/i).isVisible().catch(() => false)) && posts.length === 0,
  );

  // ---- back navigation keeps state ----
  await page.getByRole("button", { name: /^back$/i }).click();
  await page.waitForTimeout(300);
  rec("technician: back returns to the documents step", /documents/i.test(await stepHeading(page)));
  await continueStep(page);
  const afterBack = await page.locator("body").innerText();
  rec(
    "technician: answers survive back navigation",
    afterBack.includes("Zzq Formsaudit") && afterBack.includes("Storm restoration"),
  );

  // ---- submit ----
  await flowOf(page).locator('input[type="checkbox"]').last().check();
  await flowOf(page).getByRole("button", { name: /submit application/i }).click();

  /*
   * What happens next depends on whether this checkout has a database.
   *
   * With one, the application is written and the success state renders. Without
   * one, /api/apply deliberately returns 500 rather than a false success,
   * because an applicant who is told it worked when it did not walks away
   * believing they applied and there is nothing to reply to.
   *
   * Both are correct behaviour and the audit asserts whichever applies, rather
   * than calling the unconfigured case a failure. The honest failure state is
   * worth asserting in its own right: it is the path a real applicant hits the
   * day storage is down.
   *
   * Superseded in part: the choice of which path to assert is no longer made
   * from this process env at all. See the note directly below.
   */
  /*
   * WHICH OUTCOME IS UNDER TEST IS DECIDED BY WHAT HAPPENED, NOT BY THIS
   * PROCESS'S ENVIRONMENT.
   *
   * This block used to branch on `configured`, which reads the env of the AUDIT.
   * The outcome is decided by the env of the SERVER, and the two are not the
   * same thing: once .env.local existed locally, the server began succeeding
   * while the audit still believed there was no database, so it asserted the
   * failure path against a success screen and reported two failures on a working
   * application.
   *
   * Waiting for either state and then asserting the invariants of whichever one
   * arrived tests the property that actually matters, in both environments: the
   * applicant is never left with nothing, and is never told it worked when it
   * did not.
   */
  const outcome = await Promise.race([
    page
      .getByText(/your application is with us/i)
      .waitFor({ state: "visible", timeout: 20000 })
      .then(() => "success"),
    page
      .getByText(/did not save/i)
      .waitFor({ state: "visible", timeout: 20000 })
      .then(() => "honest-failure"),
  ]).catch(() => "silent");

  rec(
    "technician: the submit resolves to a stated outcome rather than silence",
    outcome !== "silent",
    outcome === "silent" ? "neither a success nor a failure message appeared" : outcome,
  );

  if (outcome === "success") {
    rec(
      "technician: a successful submit does not also show a failure message",
      !(await page
        .getByText(/did not save/i)
        .isVisible()
        .catch(() => false)),
    );
  } else if (outcome === "honest-failure") {
    rec(
      "technician: a failed submit is never dressed as a success",
      !(await page
        .getByText(/your application is with us/i)
        .isVisible()
        .catch(() => false)),
    );
    rec(
      "technician: a failed submit keeps the answers on the page for a retry",
      await flowOf(page)
        .getByText(/Zzq Formsaudit/)
        .first()
        .isVisible()
        .catch(() => false),
    );
  }
  rec("technician: exactly one POST for the whole application", posts.length === 1);

  const sent = posts[posts.length - 1];
  rec(
    "technician POST: identity and role",
    !!sent &&
      sent.role === "field_technician" &&
      sent.fullName === "Zzq Formsaudit" &&
      sent.city === "Corpus Christi" &&
      sent.countyOfResidence === "Nueces" &&
      /^[0-9a-f-]{36}$/i.test(sent.applicationId || ""),
  );
  rec(
    "technician POST: the county multi select rides as an array of 18",
    !!sent && Array.isArray(sent.countiesServed) && sent.countiesServed.length === 18,
  );
  rec(
    "technician POST: experience answers ride, including the Other text",
    !!sent &&
      Array.isArray(sent.backgrounds) &&
      sent.backgrounds.includes("Roofing") &&
      sent.backgroundOther === "Storm restoration" &&
      sent.yearsExperience === "5 to 10 years" &&
      sent.part107 === "yes" &&
      sent.liabilityInsurance === "no",
  );
  rec("technician POST: consent is recorded as true", !!sent && sent.consent === true);
  rec(
    "technician POST: attribution rides with the application",
    !!sent && sent.landingPath === "/careers/field-inspection-technician",
  );
  rec(
    "technician: every step cleared 390px with no horizontal scroll",
    widths.every(Boolean),
    `${widths.filter(Boolean).length}/${widths.length} steps`,
  );

  await page.close();
}

// --------------------------------------------------------------- engineer

async function engineerFlow(ctx, BASE, rec, recSkip) {
  const page = await ctx.newPage();
  const posts = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/api/apply") && req.method() === "POST") posts.push(1);
  });

  await page.goto(`${BASE}/careers/professional-engineer`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const widths = [await noHScroll(page)];

  await continueStep(page);
  rec(
    "engineer step 1: an empty step blocks with named inline errors",
    await page.getByText("Enter your full name.").isVisible().catch(() => false),
  );

  await flowOf(page).locator('input[name="fullName"]').fill("Zzq Formsaudit");
  await flowOf(page).locator('input[name="email"]').fill("forms.audit@254engineering.com");
  await flowOf(page).locator('input[name="phone"]').fill("2105550100");
  await flowOf(page).locator('input[name="city"]').fill("Austin");
  await flowOf(page).locator('input[name="state"]').fill("Texas");
  await continueStep(page);
  rec("engineer step 2 reached", /licensure/i.test(await stepHeading(page)));
  widths.push(await noHScroll(page));

  await continueStep(page);
  rec(
    "engineer step 2: the licence number is required",
    // Anchored on the error sentence, not the field name. The looser pattern
    // matched the label as well, which is always on screen, so the locator
    // resolved to two nodes and the strict mode violation read as a failure.
    await page
      .getByText(/Enter your Texas PE license number\./i)
      .first()
      .isVisible()
      .catch(() => false),
  );

  await flowOf(page).locator('input[name="peLicenseNumber"]').fill("PE123456");
  await flowOf(page).locator('input[name="yearFirstLicensedTexas"]').fill("1830");
  await flowOf(page).locator('select[name="discipline"]').selectOption("Structural");
  await flowOf(page).locator('input[name="tdiAppointed"][value="no"]').check();
  await flowOf(page).locator('input[name="tdiWilling"][value="yes"]').check();
  await continueStep(page);
  rec(
    "engineer step 2: an impossible licensure year is caught",
    await page.getByText(/does not look right/i).isVisible().catch(() => false),
  );

  await flowOf(page).locator('input[name="yearFirstLicensedTexas"]').fill("2014");
  await continueStep(page);
  rec("engineer step 3 reached", /experience/i.test(await stepHeading(page)));
  widths.push(await noHScroll(page));

  await continueStep(page);
  rec(
    "engineer step 3: the sealed work description is required",
    await page.getByText(/personally sealed/i).first().isVisible().catch(() => false),
  );

  await flowOf(page).locator('select[name="yearsStructural"]').selectOption("More than 10 years");
  await page
    .locator('textarea[name="sealedWork"]')
    .fill("Residential foundations and light commercial framing, sealed in Travis and Hays counties.");
  await flowOf(page).locator('input[name="employmentStatus"]').fill("Independent practice");
  await continueStep(page);
  rec("engineer step 4 reached", /documents/i.test(await stepHeading(page)));
  widths.push(await noHScroll(page));

  // The property that matters on this step for this seat.
  await continueStep(page);
  rec(
    "engineer step 4: a resume is required for this seat and blocks the step",
    /documents/i.test(await stepHeading(page)) && posts.length === 0,
  );

  rec(
    "engineer: every step reached cleared 390px with no horizontal scroll",
    widths.every(Boolean),
    `${widths.filter(Boolean).length}/${widths.length} steps`,
  );

  recSkip(
    "engineer: review, consent, and submit",
    "the resume is required and uploading one needs Supabase storage, which is not configured for this run",
  );

  await page.close();
}

// ----------------------------------------------------------------- shared

async function sharedChecks(ctx, BASE, rec) {
  // The upload route's guards, called directly, because the browser path cannot
  // reach them without storage configured.
  const post = (body) =>
    fetch(`${BASE}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const valid = {
    applicationId: "00000000-0000-4000-8000-000000000000",
    kind: "resume",
    filename: "resume.pdf",
    contentType: "application/pdf",
    size: 1024,
  };

  const badType = await post({ ...valid, contentType: "application/x-msdownload" });
  rec("upload API: refuses an executable content type", badType.status === 422);

  const tooBig = await post({ ...valid, size: 20 * 1024 * 1024 });
  rec("upload API: refuses a file over the 10MB limit", tooBig.status === 422);

  const badId = await post({ ...valid, applicationId: "../../etc/passwd" });
  rec(
    "upload API: refuses an application id that is not a UUID, so it cannot shape a path",
    badId.status === 422,
  );

  const badKind = await post({ ...valid, kind: "payroll" });
  rec("upload API: refuses an unknown document kind", badKind.status === 422);

  const malformed = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  rec("upload API: answers 400 on a malformed body rather than throwing", malformed.status === 400);

  // The application route's own guards.
  const applyPost = (body) =>
    fetch(`${BASE}/api/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const unknownRole = await applyPost({ role: "chief-wizard" });
  rec("apply API: refuses an unknown role rather than guessing a track", unknownRole.status === 400);

  const empty = await applyPost({ role: "field_technician" });
  rec("apply API: refuses an empty application server side", empty.status === 422);

  const wrongShape = await applyPost({
    role: "professional_engineer",
    applicationId: "00000000-0000-4000-8000-000000000000",
    fullName: "Direct Post",
    email: "forms.audit@254engineering.com",
    phone: "2105550100",
    city: "Austin",
    // Technician fields on an engineer application.
    countiesServed: ["Travis"],
  });
  rec(
    "apply API: validates against the schema for the declared role",
    wrongShape.status === 422,
    String(wrongShape.status),
  );

  // The careers hub must route to both positions rather than carrying forms.
  const hub = await (await fetch(`${BASE}/careers`)).text();
  rec(
    "careers hub: links to both position pages",
    hub.includes('href="/careers/professional-engineer"') &&
      hub.includes('href="/careers/field-inspection-technician"'),
  );
  rec(
    "careers hub: carries no application form of its own",
    !/<form\b/i.test(hub.slice(hub.indexOf("<main"), hub.lastIndexOf("<footer"))),
  );
}
