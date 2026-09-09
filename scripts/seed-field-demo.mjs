/**
 * Populate the development project with enough to work the field flow end to
 * end: a protocol, a fee, a client, three technicians, and files at each stage.
 *
 *   npm run seed-field-demo
 *
 * Through npm rather than tsx directly, because the script imports the
 * application's own password hashing and that module is marked server-only.
 * The npm script passes --conditions=react-server, which is what makes the
 * marker resolve to the no-op rather than the throw. Running it as
 * "npx tsx scripts/seed-field-demo.mjs" fails on the first import.
 *
 * DEVELOPMENT ONLY, AND NO FLAG OPENS IT
 * --------------------------------------
 * This writes fake people with fake coverage into the tables dispatch reads.
 * A single run against production would put three technicians who do not exist
 * into the roster and into every future dispatch plan, and the audit trail rows
 * it produces cannot be deleted. `neverProduction` is checked before
 * ALLOW_PRODUCTION_DB is even looked at, the same standing as roles-audit.
 *
 * NOTHING SEEDED IS EVER SEALED, AND THAT IS STANDING LAW
 * -------------------------------------------------------
 * Not this run's choice and not a thing the next session weighs again.
 * Operator ruling, 2026-09-05.
 *
 * A seal is a licensed Professional Engineer stating that they examined a
 * package and take responsibility for it. Seeding one writes that claim about a
 * real address into the same tables a real seal goes in, where nothing
 * downstream can tell the two apart, and it would be a false statement about a
 * regulated act rather than a convenient fixture. The firm has no registration
 * and no PE on staff, so it would also be a claim about a thing that has never
 * happened.
 *
 * A declined decision carries the same weight, is available today, and is the
 * more useful thing to show anyway. That is what 0001 is.
 *
 * Enforced at the end of this script rather than left to whoever edits it next:
 * refuseAnySeal() looks at what was actually written and throws if any of it is
 * sealed. A rule in a comment is a rule until somebody is in a hurry.
 *
 * WHY THE NAMES ARE OBVIOUSLY FAKE
 * --------------------------------
 * Every seeded person is "Demo" something at an example.com address, and every
 * property is on a street that does not exist. Seed data that looks real is seed
 * data somebody eventually mistakes for real, and this repo has a standing rule
 * against fabricated people appearing anywhere they could be believed.
 */
import { newPartnerPasswordRecord } from "../src/lib/partner-auth.ts";
import { publishAsset } from "../src/lib/ops-partner-assets.ts";
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
    is_demo: true,
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
    is_demo: true,
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
    is_demo: true,
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
    is_demo: true,
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
    is_demo: true,
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
    is_demo: true,
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

    /*
     * THE TECH PAY LEDGER IS NOT SWEPT, AND SAYS SO RATHER THAN FAILING QUIETLY.
     *
     * 0032 attached a delete refusal to it: what a technician is owed is a money
     * record, and a correction there is a new row rather than a removed one. So
     * a file this script created that ever accrued pay CANNOT be removed either,
     * because 0030 made the ledger's file_id ON DELETE RESTRICT.
     *
     * The attempt is still made and the error is READ, which is the whole point.
     * The version of this teardown that called delete and ignored the result
     * went on reporting success after 0032 landed, and two other audits did the
     * same thing on the production ledger for a whole board run before anybody
     * counted the rows. A cleanup nobody checks is a cleanup that reports
     * success by not speaking.
     */
    const { error: payErr } = await db.from("eng_tech_pay_ledger").delete().eq("file_id", f.id);
    const { error: fileErr } = await db.from("eng_files").delete().eq("id", f.id);
    if (payErr || fileErr) {
      console.error(
        `  KEPT ${f.file_number}: ${payErr ? `its technician pay cannot be deleted (${payErr.message.slice(0, 90)})` : ""}` +
          `${payErr && fileErr ? " and " : ""}` +
          `${fileErr ? `the file itself is held by it (${fileErr.message.slice(0, 90)})` : ""}` +
          ". This is 0032 and 0030 working: a demonstration file with earnings is kept, and is_demo keeps it out of every figure.",
      );
    }
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
      ? `  residue: removed ${swept.removed.files} probe file(s), ${swept.removed.partners} probe partner(s)${swept.note ? `. ${swept.note}` : ""}`
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
    is_demo: true,
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

// --- a referral partner, and the honest state of the programme ---------------

/*
 * WHY THERE IS A PARTNER HERE AND NO EARNINGS.
 *
 * Phase 9 Section 4 built the partner portal, and a portal with nothing in it
 * cannot be looked at. So the seed creates one partner, their terms, the
 * agreement, and one order credited to them.
 *
 * IT DELIBERATELY WRITES NO LEDGER ENTRIES, and the reason is worth stating
 * because "the demo has no earnings" looks like an omission.
 *
 * A commission accrues when a file reaches DELIVERED. GATED_STATUSES in
 * ops-files.ts lists sealed and delivered, and canTransition refuses both while
 * isPrelaunch() is true. So no file on this platform can reach delivered today,
 * and therefore no accrual can be produced by the platform's own code while
 * registration is pending.
 *
 * The alternative was writing ledger rows by hand so the screens had figures on
 * them. That would have put money records into the firm's ledger that no rule
 * produced, in the table whose entire purpose is that every figure came from a
 * stated rule, and it would have made the demonstration disagree with the
 * product. The empty states are the truth about this programme today, and they
 * are what the operator should be looking at.
 */
{
  const partnerCode = "demo-title";

  const { data: existing } = await db
    .from("eng_partners")
    .select("id")
    .eq("code", partnerCode)
    .maybeSingle();

  let partnerId = existing?.id ?? null;

  if (!partnerId) {
    const { data: made, error } = await db
      .from("eng_partners")
      .insert({
        organisation: "Demo Title Partners",
        contact_name: "Demo Partner Contact",
        contact_email: "demo.partner@example.com",
        code: partnerCode,
        status: "active",
        payout_method: "Cheque, posted",
        payout_reference: "Demo, not a real payee",
        notes: "Seeded by seed-field-demo. Not a real partner.",
      })
      .select("id")
      .single();
    if (error) throw new Error(`eng_partners: ${error.message}`);
    partnerId = made.id;
  }

  /*
   * Terms: a percentage, because it is the model that exercises the most of the
   * rule, and the one whose legality is the open question the operator is
   * getting answered. Nothing is paid on development either way.
   */
  const { data: terms } = await db
    .from("eng_partner_terms")
    .select("id")
    .eq("partner_id", partnerId)
    .limit(1)
    .maybeSingle();
  if (!terms) {
    await mustInsert("eng_partner_terms", {
      partner_id: partnerId,
      model: "percent_of_order",
      percent_bps: 250,
      holdback_days: 30,
      effective_from: "2026-01-01",
      note: "Seeded. Two and a half percent of order value, thirty day holdback.",
    });
  }

  /*
   * Two agreement versions with the OLDER accepted, so the portal shows both
   * states somebody has to be able to see: what an accepted agreement looks
   * like, and what happens when the firm publishes a new one.
   */
  const agreements = [
    {
      version: "2026-01",
      summary: "The original programme terms.",
      body: [
        "Demo Title Partners refers clients to 254 Engineering Services. 254 Engineering Services will perform and seal the work, contracts with the client, and is the firm of record on every engagement.",
        "The partner may use approved marketing material carrying both marks. The partner may not describe itself as an engineering firm, offer engineering services, or hold itself out as performing engineering work.",
        "Compensation is set out in the terms recorded on the partner's account and is paid on statements issued by the firm.",
      ].join("\n\n"),
      published_at: "2026-01-15T00:00:00.000Z",
    },
    {
      version: "2026-09",
      summary: "Adds the reversal and holdback language.",
      body: [
        "Demo Title Partners refers clients to 254 Engineering Services. 254 Engineering Services will perform and seal the work, contracts with the client, and is the firm of record on every engagement.",
        "The partner may use approved marketing material carrying both marks. The partner may not describe itself as an engineering firm, offer engineering services, or hold itself out as performing engineering work.",
        "A commission is earned when the firm delivers the referred work, not when an order is placed. Where money is returned to a client, the commission on the returned amount is reversed by a counter entry, and both entries remain visible on the partner's ledger.",
        "A commission becomes payable after the holdback period recorded on the partner's account.",
      ].join("\n\n"),
      published_at: "2026-09-01T00:00:00.000Z",
    },
  ];

  for (const agreement of agreements) {
    const { data: found } = await db
      .from("eng_partner_agreements")
      .select("version")
      .eq("version", agreement.version)
      .maybeSingle();
    if (!found) await mustInsert("eng_partner_agreements", agreement);
  }

  const { data: partnerRow } = await db
    .from("eng_partners")
    .select("agreement_version")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partnerRow?.agreement_version) {
    await mustUpdate(
      "eng_partners",
      { agreement_version: "2026-01", agreement_accepted_at: "2026-01-20T00:00:00.000Z" },
      "id",
      partnerId,
    );
  }

  /*
   * One order credited to them, so the referrals screen has a row. Paid and in
   * fulfilment, which is where a referral sits before anything can be
   * delivered, and delivered is the thing the compliance gate refuses.
   */
  const orderReference = "254-DEMO-ORDER-1";
  const { data: order } = await db
    .from("eng_service_orders")
    .select("id")
    .eq("reference", orderReference)
    .maybeSingle();

  if (!order) {
    await mustInsert("eng_service_orders", {
      site: "254engineering",
      reference: orderReference,
      is_demo: true,
      service_slug: "windstorm-inspection",
      order_type: "field",
      status: "in_fulfilment",
      customer_name: "Demo Referred Client",
      customer_email: "demo.client@example.com",
      property_address: "1400 Example Bay Drive",
      county: "Nueces",
      total_cents: 45000,
      partner_id: partnerId,
      partner_code: partnerCode,
      attributed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      attribution_reason:
        "Seeded. A link touch four days before the order, inside the thirty day window, with no earlier paid order for this customer.",
      placed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    });
  }

  /*
   * The person who signs in, with the same known development password the demo
   * technicians carry, hashed by the APPLICATION'S own function rather than by
   * a copy of it here. A seed that reimplements the hashing is a seed that can
   * drift from the thing it is seeding for, and the first symptom would be a
   * correct password being refused.
   */
  const { data: partnerUser } = await db
    .from("eng_partner_users")
    .select("id")
    .eq("email", "demo.partner@example.com")
    .maybeSingle();

  if (!partnerUser) {
    const record = newPartnerPasswordRecord(DEMO_PASSWORD);
    await mustInsert("eng_partner_users", {
      partner_id: partnerId,
      email: "demo.partner@example.com",
      display_name: "Demo Partner Contact",
      status: "active",
      password_hash: record.hash,
      password_salt: record.salt,
    });
  }

  /*
   * APPROVED MATERIAL, PUBLISHED THROUGH THE REAL PATH.
   *
   * publishAsset runs the same regulated and voice patterns the site's own
   * audits use and refuses anything that fails, so seeding through it proves
   * two things at once: the library has something in it, and the copy in this
   * seed is copy the firm could actually publish.
   *
   * Writing the rows directly would have been three lines shorter and would
   * have let a seeded paragraph carry a claim the product would have refused,
   * which is the demonstration disagreeing with the thing being demonstrated.
   */
  const { data: seedAdmin } = await db
    .from("eng_profiles")
    .select("id, role")
    .eq("email", "demo.admin@example.com")
    .maybeSingle();

  if (seedAdmin) {
    const actor = {
      id: seedAdmin.id,
      role: seedAdmin.role,
      status: "active",
      grants: [],
      email: "demo.admin@example.com",
    };

    const material = [
      {
        slug: "who-performs-the-work",
        title: "Who performs the work",
        kind: "copy_block",
        summary: "For the page where a client first meets the programme.",
        body:
          "Engineering work referred through this programme will be carried out by 254 Engineering Services, " +
          "a Texas firm serving all 254 counties. They contract with the client, hold the engagement, " +
          "and are the firm of record on every deliverable. Firm registration is pending with the Texas " +
          "Board of Professional Engineers and Land Surveyors.",
      },
      {
        slug: "what-a-referral-is",
        title: "What a referral is, in an email",
        kind: "email_snippet",
        summary: "For an introduction to a client who has asked who to use.",
        body:
          "I have sent your details to 254 Engineering Services, who will contact you directly. They " +
          "handle the engagement and the engineering from here, and I am told what stage it reaches " +
          "rather than what it finds.",
      },
    ];

    for (const item of material) {
      const result = await publishAsset(actor, item);
      if (!result.ok) throw new Error(`seeded asset "${item.slug}" was refused: ${result.error}`);
    }
    console.error(`  materials: ${material.length} approved asset(s) published through the real check`);
  }

  console.error("  partner: Demo Title Partners, one referral, no earnings (delivery is gated)");
}

/*
 * THE STANDING LAW AT THE TOP OF THIS FILE, CHECKED AGAINST THE DATABASE.
 *
 * Reads what was written rather than what was intended, for the same reason
 * sweep() looks instead of trusting: this script has already once printed
 * success over inserts the database rejected. If a future edit seeds a seal, or
 * a document carrying sealing facts, the run fails here and says why.
 */
async function refuseAnySeal() {
  const { data: files } = await db
    .from("eng_files")
    .select("id, file_number, status, sealed_at")
    .like("file_number", "254-DEMO-%");

  const sealedFiles = (files ?? []).filter((f) => f.status === "sealed" || f.sealed_at);
  if (sealedFiles.length) {
    throw new Error(
      `seeded a sealed file (${sealedFiles.map((f) => f.file_number).join(", ")}). ` +
        "Nothing seeded is ever sealed: it would be a claim that a Professional Engineer " +
        "certified work at an address, written where a real one goes.",
    );
  }

  const ids = (files ?? []).map((f) => f.id);
  if (ids.length) {
    const { data: docs } = await db
      .from("eng_documents")
      .select("id, title, sealed_at, sealed_by, seal_tier")
      .in("file_id", ids);
    const sealedDocs = (docs ?? []).filter((d) => d.sealed_at || d.sealed_by || d.seal_tier);
    if (sealedDocs.length) {
      throw new Error(
        `seeded a document carrying sealing facts (${sealedDocs.map((d) => d.title).join(", ")}). ` +
          "Nothing seeded is ever sealed.",
      );
    }
  }

  console.error(`  seals: none, across ${(files ?? []).length} seeded file(s). As required.`);
}

await refuseAnySeal();

console.error("Seeded. Everything above is obviously fake by design: Demo names,");
console.error("example.com addresses, and streets that do not exist.");
console.error("");
console.error(`Sign in on development, administrator: demo.admin@example.com / ${DEMO_PASSWORD}`);
console.error(`Sign in on development, technician:    ${TECHS[0].email} / ${DEMO_PASSWORD}`);
console.error(`Sign in on development, partner:       demo.partner@example.com / ${DEMO_PASSWORD}`);
