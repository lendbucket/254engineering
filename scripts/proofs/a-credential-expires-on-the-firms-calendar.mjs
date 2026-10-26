// @runtime react-server
//
// Declared because it imports src/lib/ops-onboarding.ts, which carries server-only.

/**
 * A TECHNICIAN'S CREDENTIAL EXPIRES ON THE FIRM'S CALENDAR, AND AN ONBOARDING
 * WHOSE ITEMS CANNOT BE READ IS NEVER READY.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-credential-expires-on-the-firms-calendar.mjs
 *
 * Robert's audit of 2026-10-24.
 *
 * F28. expiryState and daysUntilExpiry took "today" from the server's local
 *      day. Vercel's server is on UTC, so from about seven in the evening
 *      Central a credential on its last day already read expired and dispatch
 *      refused the technician. Run here with the process on UTC, as a
 *      deployment is: this machine is on Central time, where the old code
 *      would have passed.
 * F30. activationView ignored a failed read of the onboarding items, so the
 *      readiness check had nothing to refuse and the person read as ready.
 *
 * The onboarding half is against a fake PostgREST. Nothing reaches a database.
 */
process.env.TZ = "UTC";
process.env.SUPABASE_URL = "http://credential-dates-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "credential-dates-proof-not-a-key";
delete process.env.VERCEL_ENV;

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

check("the process really is on UTC, as a deployment is", new Date("2026-10-25T01:30:00Z").getDate() === 25, String(new Date("2026-10-25T01:30:00Z")));

const { expiryState, daysUntilExpiry } = await import("../../src/lib/ops-credentials.ts");

/* 01:30 UTC on the 25th is 20:30 Central on the 24th. */
const eveningOfLastDay = new Date("2026-10-25T01:30:00Z");
check("a credential on its last day is valid that evening in Texas", expiryState("2026-10-24", eveningOfLastDay) !== "expired", expiryState("2026-10-24", eveningOfLastDay));
check("with no days left, not minus one", daysUntilExpiry("2026-10-24", eveningOfLastDay) === 0, String(daysUntilExpiry("2026-10-24", eveningOfLastDay)));
/* 06:00 UTC on the 25th is 01:00 Central on the 25th. */
const nextMorning = new Date("2026-10-25T06:00:00Z");
check("and it reads expired once the 25th has begun in Texas", expiryState("2026-10-24", nextMorning) === "expired" && daysUntilExpiry("2026-10-24", nextMorning) === -1);
check("an expiry a year out is current", expiryState("2027-10-24", eveningOfLastDay) === "current");
check("an unreadable date is none, never current", expiryState("24/10/2026", eveningOfLastDay) === "none" && daysUntilExpiry("not a date", eveningOfLastDay) === null);

/* F30 */
const ONBOARDING = "00000000-0000-4000-8000-00000000cc01";
const state = { failItems: false };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "eng_onboardings") {
    return json([{ id: ONBOARDING, role: "field_tech", person_name: "Proof Technician", email: "credential-dates-proof@audit-probe.invalid", phone: null, status: "in_progress", coverage_counties: ["Nueces"], base_city: null, base_county: null, activated_at: null, profile_id: null }]);
  }
  if (table === "eng_onboarding_items") {
    if (state.failItems) return json({ message: "proof: the items read failed", code: "XX000" }, 500);
    return json([]);
  }
  return json([]);
};
const { activationView } = await import("../../src/lib/ops-onboarding.ts");
const admin = { id: "00000000-0000-4000-8000-00000000cc09", role: "admin", status: "active", grants: new Set(["profiles.create"]) };
state.failItems = true;
const unread = await activationView(admin, ONBOARDING);
check(
  "an onboarding whose items cannot be read is not ready, and says why",
  unread?.readiness.ready === false && /could not be read/.test(unread.readiness.blockers[0] ?? ""),
  JSON.stringify(unread?.readiness),
);
state.failItems = false;
const empty = await activationView(admin, ONBOARDING);
check("and one with no items read is not ready either, for its own reasons", empty?.readiness.ready === false && !/could not be read/.test(empty.readiness.blockers.join(" ")), JSON.stringify(empty?.readiness.blockers.slice(0, 2)));

console.log("");
if (wrong === 0) {
  console.log("PASS: a credential expires on the firm's calendar, and an onboarding whose items cannot be read is never ready.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
