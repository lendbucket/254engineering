/**
 * ONE DEMONSTRATION ENGINEER, ONE PRICED FILE, ONE LEDGER ENTRY, KEPT FOREVER.
 *
 * Phase 12 Section 3, after 0032. Two audits used to build a money fixture per
 * run and delete it afterwards, and 0032 took the second half away:
 * eng_production_ledger refuses DELETE now, because it is what an engineer is
 * owed and a correction there is a new row rather than a removed one.
 *
 * THE FAILURE THAT MADE THIS NECESSARY WAS SILENT, WHICH IS THE PART WORTH
 * WRITING DOWN. Both audits went on passing after 0032 was applied, because
 * their teardown called `.delete()` and never looked at the error the client
 * hands back rather than throwing. The rows stayed, the boards were green, and
 * development had gained two orphaned ledger entries and their profiles and
 * files before anybody counted. A cleanup nobody checks is a cleanup that
 * reports success by not speaking.
 *
 * So the fixture is STANDING rather than disposable: one identity, reused, with
 * its period brought up to date each run because a period is an UPDATE and
 * updates are allowed. Development carries exactly one of each of these
 * forever, and the count does not grow with the number of board runs.
 *
 * WHY THAT IS SAFE, AND IT IS THE GATE 0 RULING RATHER THAN A NEW ARGUMENT.
 * Everything here carries is_demo, the file number carries the DEMO segment
 * 0027 requires, and the operator already accepted the consequence when the
 * ledger foreign keys became RESTRICT: a demonstration file with earnings is
 * kept, permanently, and is_demo keeps it out of every figure. These rows are
 * the thing demo-audit and dashboards-audit exist to prove is excluded, so
 * their being present is the fixture rather than a leak.
 */

/** The one identity. Fixed, so a second board run finds it rather than adding one. */
export const STANDING = {
  email: "standing.demo.engineer@demo-audit.invalid",
  displayName: "Standing Demo Engineer",
  clientName: "Standing Demo Client",
  clientEmail: "standing.demo.client@demo-audit.invalid",
  fileNumber: "254-DEMO-STANDING",
  address: "1 Standing Demo Way",
  county: "Nueces",
  service: "windstorm-wpi-8",
  amountCents: 888_00,
  priceCents: 1_500_00,
  techCents: 300_00,
  engineerCents: 400_00,
};

/**
 * Make sure the standing fixture exists and describes THIS period, and hand
 * back its ids. Creates only what is missing.
 *
 * Never deletes anything and never returns a cleanup function, deliberately.
 * A caller holding one would be a caller that thinks it can take this away.
 */
export async function standingDemo(db, period) {
  const notes = [];

  // ---- the engineer ------------------------------------------------------
  let userId = null;
  const { data: existingProfile } = await db
    .from("eng_profiles")
    .select("id")
    .eq("email", STANDING.email)
    .maybeSingle();

  if (existingProfile) {
    userId = existingProfile.id;
  } else {
    const { data: made, error } = await db.auth.admin.createUser({
      email: STANDING.email,
      password: `standing-${Math.random().toString(36).slice(2)}-Aa1!`,
      email_confirm: true,
    });
    if (error || !made?.user) {
      /*
       * The auth user can outlive the profile: a previous run may have removed
       * the profile row and left the login. Finding it is cheaper than failing.
       */
      const { data: list } = await db.auth.admin.listUsers();
      const found = (list?.users ?? []).find((u) => u.email === STANDING.email);
      if (!found) throw new Error(`standing demo auth user: ${error?.message ?? "not created and not found"}`);
      userId = found.id;
    } else {
      userId = made.user.id;
    }

    const { error: pErr } = await db.from("eng_profiles").insert({
      id: userId,
      email: STANDING.email,
      display_name: STANDING.displayName,
      role: "engineer",
      status: "active",
      tdi_appointment: "none",
      is_demo: true,
    });
    if (pErr) throw new Error(`standing demo profile: ${pErr.message}`);
    notes.push("created the standing demonstration engineer");
  }

  // ---- the client --------------------------------------------------------
  let clientId = null;
  const { data: existingClient } = await db
    .from("eng_clients")
    .select("id")
    .eq("email", STANDING.clientEmail)
    .maybeSingle();

  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: made, error } = await db
      .from("eng_clients")
      .insert({
        kind: "organization",
        name: STANDING.clientName,
        email: STANDING.clientEmail,
        status: "active",
        is_demo: true,
      })
      .select("id")
      .maybeSingle();
    if (error || !made) throw new Error(`standing demo client: ${error?.message}`);
    clientId = made.id;
    notes.push("created the standing demonstration client");
  }

  // ---- the file, priced, because an unpriced fixture moves no margin -----
  let fileId = null;
  const { data: existingFile } = await db
    .from("eng_files")
    .select("id")
    .eq("file_number", STANDING.fileNumber)
    .maybeSingle();

  if (existingFile) {
    fileId = existingFile.id;
  } else {
    const { data: made, error } = await db
      .from("eng_files")
      .insert({
        file_number: STANDING.fileNumber,
        client_id: clientId,
        service_slug: STANDING.service,
        property_address: STANDING.address,
        county: STANDING.county,
        status: "under_review",
        client_price_cents: STANDING.priceCents,
        tech_cost_cents: STANDING.techCents,
        engineer_cost_cents: STANDING.engineerCents,
        is_demo: true,
      })
      .select("id")
      .maybeSingle();
    if (error || !made) throw new Error(`standing demo file: ${error?.message}`);
    fileId = made.id;
    notes.push("created the standing demonstration file");
  }

  // ---- the ledger entry, moved to this period ---------------------------
  let entryId = null;
  const { data: existingEntry } = await db
    .from("eng_production_ledger")
    .select("id, period")
    .eq("engineer_id", userId)
    .eq("file_id", fileId)
    .maybeSingle();

  if (existingEntry) {
    entryId = existingEntry.id;
    if (existingEntry.period !== period) {
      /*
       * An UPDATE, which this table allows and always has. DELETE is what 0032
       * refuses, and moving the fixture forward is exactly the case that would
       * otherwise want one.
       */
      const { error } = await db
        .from("eng_production_ledger")
        .update({ period })
        .eq("id", entryId);
      if (error) throw new Error(`standing demo ledger period: ${error.message}`);
      notes.push(`moved the standing entry to ${period}`);
    }
  } else {
    const { data: made, error } = await db
      .from("eng_production_ledger")
      .insert({
        engineer_id: userId,
        file_id: fileId,
        amount_cents: STANDING.amountCents,
        period,
        status: "pending",
        decision: "seal",
      })
      .select("id")
      .maybeSingle();
    if (error || !made) throw new Error(`standing demo ledger: ${error.message}`);
    entryId = made.id;
    notes.push("created the standing demonstration ledger entry");
  }

  return { userId, clientId, fileId, entryId, notes };
}

/**
 * How many production ledger rows exist, so an audit can assert its own fixture
 * did not multiply.
 *
 * The number that matters is not zero, it is UNCHANGED. Two audits each keeping
 * one standing row is the design; either of them adding one per run is the
 * defect this counts.
 */
export async function ledgerRowCount(db) {
  const { count } = await db
    .from("eng_production_ledger")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}
