/**
 * AN OFFER WITHOUT A RATE CANNOT BE ACCEPTED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-offer-without-a-rate-cannot-be-accepted.mjs
 *
 * Operator ruling, 2026-10-09, on a money defect the product audit found: an
 * offer is made with a null rate whenever no scheduled rate covers the work,
 * acceptOffer took it anyway, and submitEvidence writes the technician's pay
 * entry only when a rate exists. A technician could accept, do the visit,
 * submit, and be owed nothing on any record, on a screen promising "you will
 * see the flat rate before you accept".
 *
 * It TRIES it, on development, through acceptOffer itself: a demonstration file
 * and an offer with no rate, accepted as the technician it was offered to. The
 * acceptance must be refused naming the rate, and the file must still be
 * unclaimed. Then the control, so the refusal cannot pass for any other reason:
 * the same shape WITH a rate is accepted by the same technician.
 *
 * Probes on @audit-probe.invalid; the files carry the DEMO segment 0027
 * requires; everything made is removed and read back.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the offer rate proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { acceptOffer } = await import("../../src/lib/ops-field.ts");
const { destroyProbes } = await import("../lib/portal-probe.mjs");

const STAMP = Date.now();
const users = [];
const files = [];

try {
  const email = `rate-proof-${STAMP}@audit-probe.invalid`;
  const made = await db.auth.admin.createUser({ id: randomUUID(), email, password: `p-${randomUUID()}`, email_confirm: true });
  if (made.error || !made.data?.user) throw new Error(`createUser: ${made.error?.message}`);
  users.push(made.data.user.id);
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: made.data.user.id, email, display_name: "Offer rate proof technician, not a real person",
    role: "field_tech", status: "active", is_demo: true,
  });
  if (pErr) throw new Error(`profile: ${pErr.message}`);
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", made.data.user.id).single();
  const { data: grants } = await db.from("eng_role_grants").select("action").eq("role_key", "field_tech");
  const tech = { ...row, email, grants: new Set((grants ?? []).map((g) => g.action)) };

  const { data: client } = await db.from("eng_clients").select("id").eq("is_demo", true).limit(1).maybeSingle();
  if (!client) throw new Error("development holds no demonstration client to hang a file on");

  const fileWith = async (n, rateCents) => {
    const id = randomUUID();
    const { error: fErr } = await db.from("eng_files").insert({
      id, file_number: `254-DEMO-RP${String(STAMP).slice(-6)}${n}`, is_demo: true, client_id: client.id,
      service_slug: "roof-inspections", property_address: `${n} Rate Proof Way`, county: "Kenedy",
    });
    if (fErr) throw new Error(`file: ${fErr.message}`);
    files.push(id);
    const offerId = randomUUID();
    const { error: aErr } = await db.from("eng_assignments").insert({
      id: offerId, file_id: id, tech_id: tech.id, state: "offered", offer_amount_cents: rateCents,
    });
    if (aErr) throw new Error(`offer: ${aErr.message}`);
    return { fileId: id, offerId };
  };

  // 1. No rate: refused, naming the rate, and nothing claimed.
  const bare = await fileWith(1, null);
  const refused = await acceptOffer(tech, bare.offerId);
  check(
    "an offer with no rate is refused when the technician accepts it",
    !refused.ok && /no rate/i.test(refused.error ?? ""),
    refused.ok ? "ACCEPTED" : refused.error,
  );
  const { data: f1 } = await db.from("eng_files").select("assigned_tech_id").eq("id", bare.fileId).single();
  const { data: a1 } = await db.from("eng_assignments").select("state").eq("id", bare.offerId).single();
  check("and the file is still unclaimed, the offer still open", f1?.assigned_tech_id === null && a1?.state === "offered", `assigned ${f1?.assigned_tech_id ?? "nobody"}, offer ${a1?.state}`);

  // 2. The control: the same shape with a rate is accepted.
  const priced = await fileWith(2, 18_500);
  const accepted = await acceptOffer(tech, priced.offerId);
  const { data: f2 } = await db.from("eng_files").select("assigned_tech_id").eq("id", priced.fileId).single();
  check(
    "and the same offer with a rate is accepted by the same technician, so the refusal above is about the rate",
    accepted.ok && f2?.assigned_tech_id === tech.id,
    accepted.ok ? "accepted" : accepted.error,
  );
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  for (const id of files) {
    await db.from("eng_assignments").delete().eq("file_id", id);
    await db.from("eng_files").delete().eq("id", id);
  }
  const { data: leftFiles } = files.length ? await db.from("eng_files").select("id").in("id", files) : { data: [] };
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {});
  await destroyProbes("offer-rate-proof").catch(() => {});
  let leftUsers = 0;
  for (const id of users) if ((await db.auth.admin.getUserById(id)).data?.user) leftUsers += 1;
  check("the demonstration files and the probe are removed, read back", (leftFiles ?? []).length === 0 && leftUsers === 0, `${(leftFiles ?? []).length} file(s), ${leftUsers} user(s) left`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: an offer without a rate cannot be accepted.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
