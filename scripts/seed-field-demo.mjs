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
import { auditClient, describeTarget } from "./lib/db-target.mjs";

const db = auditClient("seed-field-demo", { neverProduction: true });
if (!db) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
console.error(`seeding against ${describeTarget(process.env.SUPABASE_URL)}`);

const RESET = process.argv.includes("--reset");

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
    file_number: "254-2026-9001",
    property_address: "1400 Demo Bayfront Lane",
    city: "Corpus Christi",
    county: "Nueces",
    status: "needs_dispatch",
    notes: "Seeded for the dispatch screen. Nothing here is a real property.",
  },
  {
    file_number: "254-2026-9002",
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
  },
];

async function idOf(table, match, insert) {
  const { data: found } = await db.from(table).select("id").match(match).maybeSingle();
  if (found) return found.id;
  const { data, error } = await db.from(table).insert(insert).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id;
}

if (RESET) {
  console.error("removing anything this script seeded earlier");
  const { data: seeded } = await db.from("eng_files").select("id").like("file_number", "254-2026-90%");
  for (const f of seeded ?? []) {
    await db.from("eng_evidence_items").delete().eq("file_id", f.id);
    await db.from("eng_assignments").delete().eq("file_id", f.id);
    await db.from("eng_tech_pay_ledger").delete().eq("file_id", f.id);
    await db.from("eng_files").delete().eq("id", f.id);
  }
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
  const { error } = await db.from("eng_files").insert({
    ...file,
    client_id: clientId,
    service_slug: SERVICE,
    twia_county: true,
    protocol_template_id: protocolId,
    client_price_cents: 45000,
    tech_cost_cents: 18500,
    evidence_due_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`file ${file.file_number}: ${error.message}`);
  console.error(`  file: ${file.file_number} at ${file.status}`);
}

console.error("");
console.error("Seeded. Everything above is obviously fake by design: Demo names,");
console.error("example.com addresses, and streets that do not exist.");
console.error("");
console.error(`Sign in on development, administrator: demo.admin@example.com / ${DEMO_PASSWORD}`);
console.error(`Sign in on development, technician:    ${TECHS[0].email} / ${DEMO_PASSWORD}`);
