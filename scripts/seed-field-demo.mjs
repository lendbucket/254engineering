/**
 * Populate the development project with enough to work the field flow end to
 * end: a protocol, a fee, a client, three technicians, and files at each stage.
 *
 *   npx tsx scripts/seed-field-demo.mjs
 *   npx tsx scripts/seed-field-demo.mjs --reset
 *
 * DEVELOPMENT ONLY, AND NO FLAG OPENS IT
 * --------------------------------------
 * This writes fake people with fake coverage into the tables dispatch reads.
 * A single run against production would put three technicians who do not exist
 * into the roster and into every future dispatch plan, and the audit trail rows
 * it produces cannot be deleted. `neverProduction` is checked before
 * ALLOW_PRODUCTION_DB is even looked at, the same standing as roles-audit.
 *
 * WHY THE NAMES ARE OBVIOUSLY FAKE
 * --------------------------------
 * Every seeded person is "Demo" something at an example.com address, and every
 * property is on a street that does not exist. Seed data that looks real is seed
 * data somebody eventually mistakes for real, and this repo has a standing rule
 * against fabricated people appearing anywhere they could be believed.
 */
import { sweepLegacyResidue } from "./lib/probe-ledger.mjs";
import { auditClient, describeTarget } from "./lib/db-target.mjs";

const db = auditClient("seed-field-demo", { neverProduction: true });

/** Compared exactly, the way ALLOW_PRODUCTION_DB is, so "true" is a refusal. */
const KEEP_EXISTING = process.env.KEEP_EXISTING === "1";
if (!db) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
console.error(`seeding against ${describeTarget(process.env.SUPABASE_URL)}`);

/*
 * --reset is kept as a no-op alias so an old invocation does not fail. The
 * reset now happens every run unless KEEP_EXISTING says otherwise.
 */
void process.argv.includes("--reset");

/*
 * A known password for the demo technicians, so the phone flow can actually be
 * walked rather than described.
 *
 * Safe to write down, and only because of what surrounds it: these are
 * example.com accounts on a project this script refuses to run against anything
 * but, and `neverProduction` is checked before ALLOW_PRODUCTION_DB is even
 * read. If that guard is ever weakened, this line becomes a real credential and
 * has to go with it.
 */
const DEMO_PASSWORD = "demo-field-2026-dev-only";

const TECHS = [
  {
    email: "demo.tech.coastal@example.com",
    name: "Demo Tech, Coastal Bend",
    counties: ["Nueces", "San Patricio", "Aransas", "Kleberg", "Refugio", "Bee"],
    baseCity: "Corpus Christi",
    baseCounty: "Nueces",
    lat: 27.8006,
    lng: -97.3964,
    certified: true,
    status: "active",
  },
  {
    email: "demo.tech.valley@example.com",
    name: "Demo Tech, Rio Grande Valley",
    counties: ["Cameron", "Hidalgo", "Willacy", "Nueces"],
    baseCity: "Harlingen",
    baseCounty: "Cameron",
    lat: 26.1906,
    lng: -97.6961,
    certified: true,
    status: "active",
  },
  {
    // Present, covers the county, and NOT certified. This one exists so the
    // dispatch screen has something real in its ineligible list, which is the
    // half of that screen most likely to be built wrong and never noticed.
    email: "demo.tech.uncertified@example.com",
    name: "Demo Tech, Not Yet Certified",
    counties: ["Nueces", "Jim Wells"],
    baseCity: "Robstown",
    baseCounty: "Nueces",
    lat: 27.7903,
    lng: -97.6683,
    certified: false,
    status: "active",
  },
];

const SERVICE = "windstorm-wpi-8";

const PROTOCOL_ITEMS = [
  {
    item_key: "elevations",
    kind: "photo",
    label: "All four elevations of the structure",
    instructions: "Stand back far enough that the roof line and the ground are both in frame.",
    required: true,
    min_count: 4,
    sort_order: 0,
  },
  {
    item_key: "roof_covering",
    kind: "photo",
    label: "Roof covering, close and wide",
    instructions: "One frame showing the whole slope, one close enough to identify the material.",
    required: true,
    min_count: 2,
    sort_order: 1,
  },
  {
    item_key: "deck_attachment",
    kind: "photo",
    label: "Deck attachment where it can be seen",
    instructions: "From the attic if there is access. If there is none, photograph what blocks it.",
    required: true,
    min_count: 1,
    sort_order: 2,
  },
  {
    item_key: "roof_pitch",
    kind: "measurement",
    label: "Roof pitch",
    unit: "in12",
    min_value: 0,
    max_value: 24,
    required: true,
    sort_order: 3,
  },
  {
    item_key: "opening_protection",
    kind: "note",
    label: "Opening protection, described",
    instructions: "What is installed, on which openings, and how it is fixed.",
    required: true,
    sort_order: 4,
  },
  {
    item_key: "site_conditions",
    kind: "note",
    label: "Anything else worth recording",
    required: false,
    sort_order: 5,
  },
];

const FILES = [
  {
    file_number: "254-DEMO-0001",
    property_address: "1400 Demo Bayfront Lane",
    city: "Corpus Christi",
    county: "Nueces",
    status: "needs_dispatch",
    notes: "Seeded for the dispatch screen. Nothing here is a real property.",
    /*
     * The three seeded files carry three different money states on purpose, so
     * the billing screen demonstrates all of them rather than only the happy one.
     *
     * This one has all three figures, so it has a knowable margin.
     */
    client_price_cents: 45000,
    tech_cost_cents: 18500,
    engineer_cost_cents: 9000,
  },
  {
    file_number: "254-DEMO-0002",
    property_address: "88 Demo Windward Court",
    city: "Port Aransas",
    county: "Nueces",
    status: "needs_dispatch",
    notes: "Seeded. Second file so the dispatch list is not a single row.",
    /*
     * This one carries coordinates and 9001 does not, on purpose. Between them
     * the dispatch screen demonstrates both states it can be in: ranked by
     * workload and then distance, and ranked by workload alone while saying so.
     * The point is roughly Port Aransas; the address is invented, so the
     * coordinate is only ever as real as the street it belongs to.
     */
    latitude: 27.8339,
    longitude: -97.0611,
    /*
     * Priced and dispatched, with no engineer production figure. This is the
     * common real state today, because production rates exist for one service
     * line. It is excluded from every total rather than counted as costing
     * nothing, which is the whole point of ops-money.
     */
    client_price_cents: 45000,
    tech_cost_cents: 18500,
    engineer_cost_cents: null,
  },
  {
    // A third, so there is always one sitting at needs_dispatch after the other
    // two have been worked through a demonstration.
    file_number: "254-DEMO-0003",
    property_address: "312 Demo Harbour Row",
    city: "Rockport",
    county: "Aransas",
    status: "needs_dispatch",
    notes: "Seeded. Kept at needs dispatch so the dispatch screen always has something on it.",
    /*
     * Nothing priced at all. A file at intake that nobody has quoted, which must
     * not read as a job worth zero dollars.
     */
    client_price_cents: null,
    tech_cost_cents: null,
    engineer_cost_cents: null,
  },
];

/**
 * An insert that cannot fail quietly.
 *
 * The coherent firm section below wrote eng_assignments rows with a column
 * called status. That column is called state. Supabase returned an error for
 * every one, nothing read it, the script reported success, and development
 * ended up with three files and no assignments while the console said
 * otherwise.
 *
 * A seed that lies about what it seeded is worse than a seed that crashes,
 * because the next thing to touch it is a screenshot.
 */
async function mustInsert(table, rows) {
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function mustUpdate(table, patch, column, value) {
  const { error } = await db.from(table).update(patch).eq(column, value);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function idOf(table, match, insert) {
  const { data: found } = await db.from(table).select("id").match(match).maybeSingle();
  if (found) return found.id;
  const { data, error } = await db.from(table).insert(insert).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id;
}

/*
 * RESET RUNS EVERY TIME, and is no longer a flag.
 *
 * Operator ruling, 2026-09-05: one idempotent script that removes probe residue
 * and reseeds a coherent firm. A reset you have to remember to ask for is a
 * reset that produces a different database depending on who ran it last.
 *
 * KEEP_EXISTING=1 is the way past it, spelled the way ALLOW_PRODUCTION_DB is,
 * and is for the case where somebody is mid demonstration and wants the seed
 * topped up rather than rebuilt.
 */
if (!KEEP_EXISTING) {
  console.error("removing anything this script seeded earlier");
  const { data: seeded } = await db
    .from("eng_files")
    .select("id")
    .or("file_number.like.254-DEMO-%,file_number.like.254-2026-90%");
  for (const f of seeded ?? []) {
    /*
     * Threads first. A file thread holds messages and participants, and the
     * cascade from eng_threads takes those, but nothing takes the thread when
     * the file goes if the reference is set null rather than cascade. Doing it
     * explicitly costs one query and removes the doubt.
     */
    await db.from("eng_threads").delete().eq("file_id", f.id);
    await db.from("eng_file_inputs").delete().eq("file_id", f.id);
    await db.from("eng_evidence_items").delete().eq("file_id", f.id);
    await db.from("eng_assignments").delete().eq("file_id", f.id);
    await db.from("eng_tech_pay_ledger").delete().eq("file_id", f.id);
    await db.from("eng_files").delete().eq("id", f.id);
  }

  /*
   * AND THE RESIDUE NOTHING ELSE WILL EVER REMOVE.
   *
   * Files whose property address begins with ten or more digits, which is a
   * unix timestamp where a street number belongs. Every probe file has one and
   * no real address ever will. These were created by throwaway screenshot
   * scripts that held no ledger, took 0007 to 0009 out of the real sequence,
   * and appeared in the Phase 11 walk as a timestamp on the documents screen.
   *
   * scripts/lib/probe-ledger.mjs is what stops this recurring: a run now
   * records what it creates and removes exactly that. This clears the history
   * that predates it, once.
   */
  const swept = await sweepLegacyResidue("seed-field-demo");
  console.error(
    swept.ok
      ? `  residue: removed ${swept.removed.files} probe file(s)`
      : `  residue: NOT CLEAR, ${swept.note}`,
  );

  /*
   * Threads whose participants are all gone. A direct thread between two probe
   * accounts outlives both of them, because deleting a profile does not delete
   * a conversation, and it should not: on a real database that would be
   * somebody erasing a record by leaving.
   */
  const { data: allThreads } = await db.from("eng_threads").select("id, kind, file_id");
  const { data: parts } = await db.from("eng_thread_participants").select("thread_id, profile_id");
  const alive = new Set((parts ?? []).map((p) => p.thread_id));
  const orphans = (allThreads ?? []).filter((t) => !t.file_id && !alive.has(t.id));
  if (orphans.length) {
    await db.from("eng_threads").delete().in("id", orphans.map((t) => t.id));
  }
  console.error(`  residue: removed ${orphans.length} thread(s) whose people are all gone`);
}

// --- a demonstration administrator ------------------------------------------

/*
 * Separate from the real first administrator on purpose. Walking the dispatch
 * flow needs an account somebody can sign into, and resetting the operator's own
 * password to do it would be taking their credential to save writing ten lines.
 */
{
  const email = "demo.admin@example.com";
  const { data: existing } = await db.from("eng_profiles").select("id").eq("email", email).maybeSingle();
  let id = existing?.id ?? null;
  if (!id) {
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`auth ${email}: ${error.message}`);
    id = created.user.id;
  } else {
    await db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD });
  }
  await db.from("eng_profiles").upsert(
    { id, email, display_name: "Demo Administrator", role: "admin", status: "active" },
    { onConflict: "id" },
  );
  console.error("  administrator: Demo Administrator");
}

// --- the technicians -------------------------------------------------------

const techIds = [];
for (const tech of TECHS) {
  const { data: existing } = await db
    .from("eng_profiles")
    .select("id")
    .eq("email", tech.email)
    .maybeSingle();

  let id = existing?.id ?? null;

  if (!id) {
    /*
     * eng_profiles.id references auth.users, so the auth user comes first. The
     * password is random and never printed: these accounts are dispatch targets
     * for a demonstration, not accounts anybody signs into. A technician who
     * needs to sign in gets a real invitation through the people screen.
     */
    const { data: created, error } = await db.auth.admin.createUser({
      email: tech.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`auth ${tech.email}: ${error.message}`);
    id = created.user.id;
  } else {
    await db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD });
  }

  await db.from("eng_profiles").upsert(
    {
      id,
      email: tech.email,
      display_name: tech.name,
      role: "field_tech",
      status: tech.status,
      coverage_counties: tech.counties,
      base_city: tech.baseCity,
      base_county: tech.baseCounty,
      base_lat: tech.lat,
      base_lng: tech.lng,
      certification_status: tech.certified ? "certified" : "none",
    },
    { onConflict: "id" },
  );

  if (tech.certified) {
    const { data: cert } = await db
      .from("eng_certifications")
      .select("id")
      .eq("profile_id", id)
      .eq("service_slug", SERVICE)
      .maybeSingle();
    if (!cert) {
      await db.from("eng_certifications").insert({
        profile_id: id,
        service_slug: SERVICE,
        status: "certified",
        certified_at: new Date().toISOString(),
      });
    }
  }

  techIds.push({ id, ...tech });
  console.error(`  technician: ${tech.name}${tech.certified ? "" : " (uncertified, on purpose)"}`);
}

// --- the protocol ----------------------------------------------------------

const { data: published } = await db
  .from("eng_protocol_templates")
  .select("id")
  .eq("service_slug", SERVICE)
  .eq("status", "published")
  .maybeSingle();

let protocolId = published?.id ?? null;
if (!protocolId) {
  const { data: template, error } = await db
    .from("eng_protocol_templates")
    .insert({
      service_slug: SERVICE,
      name: "Windstorm evidence, coastal",
      version: 1,
      status: "published",
      summary: "What a technician captures on a windstorm inspection in the designated area.",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`protocol: ${error.message}`);
  protocolId = template.id;
  await db.from("eng_protocol_items").insert(
    PROTOCOL_ITEMS.map((i) => ({ ...i, template_id: protocolId })),
  );
  console.error(`  protocol: 1 published with ${PROTOCOL_ITEMS.length} items`);
} else {
  console.error("  protocol: already published");
}

// --- the fee ---------------------------------------------------------------

await idOf(
  "eng_fee_schedule",
  { kind: "tech_pay", service_slug: SERVICE },
  {
    kind: "tech_pay",
    service_slug: SERVICE,
    amount_cents: 18500,
    note: "Seeded development rate. Not a real rate card.",
  },
);
console.error("  fee: technician pay for the windstorm line");

// --- a client and the files ------------------------------------------------

const clientId = await idOf(
  "eng_clients",
  { name: "Demo Coastal Roofing (seeded)" },
  {
    kind: "organization",
    name: "Demo Coastal Roofing (seeded)",
    client_type: "roofer",
    city: "Corpus Christi",
    county: "Nueces",
    notes: "Seeded for development. Not a real company.",
  },
);

for (const file of FILES) {
  const { data: existing } = await db
    .from("eng_files")
    .select("id")
    .eq("file_number", file.file_number)
    .maybeSingle();
  if (existing) {
    console.error(`  file: ${file.file_number} already present`);
    continue;
  }
  /*
   * Money comes from the file's own record above rather than from a constant
   * here. It used to be one price and one technician cost applied to all three,
   * which meant every seeded file was in the same money state and the screens
   * that distinguish "not entered" from "zero" had nothing to show.
   */
  const { error } = await db.from("eng_files").insert({
    ...file,
    client_id: clientId,
    service_slug: SERVICE,
    twia_county: true,
    protocol_template_id: protocolId,
    evidence_due_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`file ${file.file_number}: ${error.message}`);
  console.error(`  file: ${file.file_number} at ${file.status}`);
}


// --- credentials, so the fourth dispatch gate has something to read ---------

/*
 * Phase 3 added credentials as a hard dispatch gate. Without these rows every
 * seeded technician is correctly ineligible and the demonstration looks broken,
 * which is the gate working rather than a defect.
 *
 * One of them carries a lapsed insurance certificate on purpose, so the
 * ineligible list has a credential reason in it as well as a certification one.
 * A dispatch screen whose exclusions are all the same kind is one where the
 * other kinds have never been looked at.
 */
const iso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const CREDENTIALS = {
  "demo.tech.coastal@example.com": [
    { kind: "drivers_license", expires_on: iso(500) },
    { kind: "vehicle_insurance", expires_on: iso(120) },
    { kind: "w9", expires_on: null },
    { kind: "ic_agreement", expires_on: null },
  ],
  "demo.tech.valley@example.com": [
    { kind: "drivers_license", expires_on: iso(300) },
    // Expiring inside the warning window, so the roster panel has something to
    // show and it can be seen NOT blocking.
    { kind: "vehicle_insurance", expires_on: iso(20) },
    { kind: "w9", expires_on: null },
    { kind: "ic_agreement", expires_on: null },
  ],
  "demo.tech.uncertified@example.com": [
    { kind: "drivers_license", expires_on: iso(400) },
    // Lapsed on purpose. This technician is now excluded for two independent
    // reasons, which is the realistic case and the one most likely to be
    // reported badly.
    { kind: "vehicle_insurance", expires_on: iso(-14) },
    { kind: "w9", expires_on: null },
    { kind: "ic_agreement", expires_on: null },
  ],
};

for (const tech of techIds) {
  const wanted = CREDENTIALS[tech.email] ?? [];
  for (const c of wanted) {
    const { data: existing } = await db
      .from("eng_credentials")
      .select("id")
      .eq("profile_id", tech.id)
      .eq("kind", c.kind)
      .maybeSingle();
    const row = {
      profile_id: tech.id,
      kind: c.kind,
      label: "Seeded for development",
      expires_on: c.expires_on,
      status: "verified",
      verified_at: new Date().toISOString(),
    };
    if (existing) await db.from("eng_credentials").update(row).eq("id", existing.id);
    else await db.from("eng_credentials").insert(row);
  }
  console.error(`  credentials: ${tech.name}, ${wanted.length} on file`);
}

// --- the certification check on the published protocol ----------------------

const QUESTIONS = [
  {
    prompt: "How many elevations of the structure does this protocol require?",
    options: ["Two, front and back", "Four, one per face", "As many as look useful"],
    correct_index: 1,
    rationale:
      "Four, one per face. An engineer cannot rule out damage on a face nobody photographed, so a missing elevation means the file cannot be sealed.",
  },
  {
    prompt: "There is no attic access, so you cannot photograph the deck attachment. What do you do?",
    options: [
      "Skip the item and note it in the observations",
      "Photograph whatever blocks the access",
      "Guess the attachment from the roof covering",
    ],
    correct_index: 1,
    rationale:
      "Photograph the obstruction. The engineer needs to see WHY there is no deck shot, and a skipped item with a note looks identical to one you forgot.",
  },
  {
    prompt: "The roof measures a pitch of zero. What do you enter?",
    options: ["Zero", "Leave it blank, because zero is not a reading", "The nearest whole number above zero"],
    correct_index: 0,
    rationale:
      "Enter zero. It is a reading and the platform records it as one. A blank is a missing item and holds the whole package.",
  },
  {
    prompt: "You have finished everything the checklist asks for. What submits the package?",
    options: [
      "Leaving the app; it submits by itself",
      "Pressing submit, once every required item is captured and uploaded",
      "Telling the office by phone",
    ],
    correct_index: 1,
    rationale:
      "Pressing submit. It stays disabled until every required item is captured and everything queued on your phone has uploaded, and it tells you which item is missing.",
  },
];

{
  const { data: existing } = await db
    .from("eng_protocol_questions")
    .select("id")
    .eq("template_id", protocolId)
    .limit(1);
  if (existing?.length) {
    console.error("  check questions: already present");
  } else {
    await db.from("eng_protocol_questions").insert(
      QUESTIONS.map((q, i) => ({ ...q, template_id: protocolId, sort_order: i })),
    );
    console.error(`  check questions: ${QUESTIONS.length} on the published protocol`);
  }
}

// --- an application to walk the onboarding path with ------------------------

{
  const email = "demo.applicant@example.com";
  const { data: existing } = await db
    .from("eng_applications")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    console.error("  application: already present");
  } else {
    await db.from("eng_applications").insert({
      site: "254",
      role: "Field Inspection Technician",
      name: "Demo Applicant",
      email,
      phone: null,
      city: "Victoria",
      counties: "Victoria, Calhoun, Refugio and sometimes Goliad",
      experience: "Seeded application. Not a real person.",
      drone_license: false,
      reliable_vehicle: true,
      status: "new",
    });
    console.error("  application: one waiting to be invited");
  }
}

console.error("");
// --- the firm at three points in its own process -----------------------------

/*
 * WHY THIS SECTION EXISTS, AND WHAT IT IS NOT.
 *
 * Until now every seeded file sat at needs_dispatch. The spread of statuses
 * anybody remembers seeing came from throwaway screenshot scripts pushing files
 * around by hand, which is why development ended up with timestamps where street
 * numbers belong: the example data was never coherent, it was a seed plus a
 * pile of ad hoc mutations.
 *
 * Operator ruling, 2026-09-05: the seed reseeds a coherent firm. So the three
 * files become three points in the process, chosen because they are the three
 * a person actually needs to see:
 *
 *   0001  submitted, reviewed, DECLINED. A finished piece of engineering
 *         judgment with its reason, and an evidence binder to produce.
 *   0002  dispatched and ACCEPTED, mid capture. What a technician sees.
 *   0003  needs dispatch. What an operator picks up.
 *
 * NOTHING IS SEALED, and nothing here will be. isPrelaunch refuses it, and a
 * seeded seal would be a claim that a Professional Engineer certified work at
 * an address, written into the same tables a real one goes in. A declined
 * decision is real, available today, and the more interesting thing to show:
 * it is the decision that carries the same weight and gets less attention.
 */
{
  const fileId = async (number) => {
    const { data } = await db.from("eng_files").select("id").eq("file_number", number).maybeSingle();
    return data?.id ?? null;
  };

  const coastal = await db
    .from("eng_profiles")
    .select("id")
    .eq("email", "demo.tech.coastal@example.com")
    .maybeSingle();
  const engineer = await db
    .from("eng_profiles")
    .select("id")
    .eq("email", "demo.engineer@example.com")
    .maybeSingle();
  const techId = coastal.data?.id ?? null;
  const engineerId = engineer.data?.id ?? null;

  const { data: template } = await db
    .from("eng_protocol_templates")
    .select("id")
    .eq("status", "published")
    .limit(1)
    .maybeSingle();
  const { data: protocolItems } = template
    ? await db.from("eng_protocol_items").select("id, item_key, kind, min_count").eq("template_id", template.id)
    : { data: [] };

  // ---------------------------------------------- 0001: reviewed and declined
  const declined = await fileId("254-DEMO-0001");
  if (declined && techId && engineerId && template) {
    await db
      .from("eng_files")
      .update({
        status: "refused",
        protocol_template_id: template.id,
        assigned_tech_id: techId,
        dispatched_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        evidence_submitted_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        refused_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      })
      .eq("id", declined);

    /*
     * The column is state, not status, and the allowed values are offered,
     * accepted, declined, withdrawn and expired. The first version of this used
     * status and every insert was rejected in silence.
     */
    await mustInsert("eng_assignments", {
      file_id: declined,
      tech_id: techId,
      state: "accepted",
      offered_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      responded_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    });

    /*
     * Evidence against the protocol's own items, so the binder shows what was
     * asked for and what came back rather than a list of loose photographs.
     * No storage key: these are rows describing captures, and inventing an
     * object that is not in the bucket would make the binder claim a file it
     * cannot produce.
     */
    for (const item of protocolItems ?? []) {
      await mustInsert("eng_evidence_items", {
        file_id: declined,
        protocol_item_id: item.id,
        item_key: item.item_key,
        kind: item.kind,
        value_text: item.kind === "note" ? "Seeded capture. Not a real observation." : null,
        value_number: item.kind === "measurement" || item.kind === "reading" ? 6 : null,
        unit: item.kind === "measurement" ? "in" : null,
        captured_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        captured_by: techId,
        status: "submitted",
      });
    }

    console.error(`  file: 254-DEMO-0001 declined, ${(protocolItems ?? []).length} evidence item(s)`);
  }

  // -------------------------------------------- 0002: accepted and mid capture
  const working = await fileId("254-DEMO-0002");
  if (working && techId && template) {
    await db
      .from("eng_files")
      .update({
        status: "evidence_in_progress",
        protocol_template_id: template.id,
        assigned_tech_id: techId,
        dispatched_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      })
      .eq("id", working);

    /*
     * ACCEPTED, which is what makes /portal/jobs/[id] reachable at all. The
     * Phase 11 verdict table has that row blank because the walk could not
     * reach it without one.
     */
    await mustInsert("eng_assignments", {
      file_id: working,
      tech_id: techId,
      state: "accepted",
      offered_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      responded_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    });

    // Two of the protocol's items captured, so the checklist shows both states.
    for (const item of (protocolItems ?? []).slice(0, 2)) {
      await mustInsert("eng_evidence_items", {
        file_id: working,
        protocol_item_id: item.id,
        item_key: item.item_key,
        kind: item.kind,
        value_text: item.kind === "note" ? "Seeded capture. Not a real observation." : null,
        value_number: item.kind === "measurement" || item.kind === "reading" ? 4 : null,
        unit: item.kind === "measurement" ? "in" : null,
        captured_at: new Date().toISOString(),
        captured_by: techId,
        status: "submitted",
      });
    }

    console.error("  file: 254-DEMO-0002 accepted and mid capture");
  }

  // ------------------------------------------- a conversation on a file thread
  if (declined && techId) {
    const { data: thread } = await db
      .from("eng_threads")
      .insert({ kind: "file", file_id: declined, created_by: techId })
      .select("id")
      .single();

    if (thread) {
      await mustInsert("eng_thread_participants", [
        { thread_id: thread.id, profile_id: techId },
        ...(engineerId ? [{ thread_id: thread.id, profile_id: engineerId }] : []),
      ]);

      await mustInsert("eng_messages", [
        {
          thread_id: thread.id,
          author_id: techId,
          body: "The covering has a prior repair the order did not mention. Photograph attached.",
          mentions: [],
        },
        ...(engineerId
          ? [
              {
                thread_id: thread.id,
                author_id: engineerId,
                body: "Seen. That is what the decision turns on, so I am declining rather than asking for more.",
                mentions: [],
              },
            ]
          : []),
      ]);

      console.error("  conversation: one file thread with two messages");
    }
  }
}

console.error("Seeded. Everything above is obviously fake by design: Demo names,");
console.error("example.com addresses, and streets that do not exist.");
console.error("");
console.error(`Sign in on development, administrator: demo.admin@example.com / ${DEMO_PASSWORD}`);
console.error(`Sign in on development, technician:    ${TECHS[0].email} / ${DEMO_PASSWORD}`);
