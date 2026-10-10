/**
 * A DECIDED REVIEW THAT CREDITED NOTHING REACHES THE OFFICE, NAMED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-uncredited-review-reaches-the-office.mjs
 *
 * Operator ruling 2 of 2026-10-10: a windstorm file recording neither
 * completed nor ongoing credits the engineer nothing and tells him why, and it
 * must ALSO land on the administrators' attention list naming the file and
 * what is missing, so an operator fixes the record and the credit is written
 * then.
 *
 * Live on development, through the product's own function (uncreditedReviews,
 * which the dashboard's attention entry and the Billing panel both read): a
 * probe windstorm file with no deliverable and an ended review session with a
 * decision and no ledger row is created, found by name with the missing fact
 * and the two choices, and removed. A control file whose credit WAS written is
 * not listed. Nothing is credited here: a production ledger row refuses DELETE,
 * so this proof never presses the button, and the crediting path is exercised
 * by the transaction proof beside it.
 *
 * The probe is NOT demonstration-marked, because the list rightly leaves
 * demonstration files out; it is named as a probe, on @audit-probe.invalid, and
 * every row is removed and read back.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the uncredited review proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { uncreditedReviews } = await import("../../src/lib/ops-engineer.ts");

const STAMP = Date.now();
const TAIL = String(STAMP).slice(-6);
let userId = null;
let clientId = null;
const fileIds = [];

try {
  const email = `uncredited-proof-${STAMP}@audit-probe.invalid`;
  const made = await db.auth.admin.createUser({ id: randomUUID(), email, password: `p-${randomUUID()}`, email_confirm: true });
  if (made.error || !made.data?.user) throw new Error(`createUser: ${made.error?.message}`);
  userId = made.data.user.id;
  const { error: pErr } = await db.from("eng_profiles").insert({
    id: userId, email, display_name: "Uncredited proof engineer, not a real person", role: "engineer", status: "active",
  });
  if (pErr) throw new Error(`profile: ${pErr.message}`);

  clientId = randomUUID();
  const { error: cErr } = await db.from("eng_clients").insert({ id: clientId, kind: "individual", name: "Uncredited proof client, not a real person" });
  if (cErr) throw new Error(`client: ${cErr.message}`);

  async function decided(tag, slug, deliverable) {
    const id = randomUUID();
    const { error } = await db.from("eng_files").insert({
      id, file_number: `254-PROBE-UC${tag}${TAIL}`, client_id: clientId, service_slug: slug, deliverable,
      property_address: "1 Uncredited Proof Way", county: "Nueces", status: "revisions_requested",
    });
    if (error) throw new Error(`file ${tag}: ${error.message}`);
    fileIds.push(id);
    const { data: s, error: sErr } = await db
      .from("eng_review_sessions")
      .insert({ file_id: id, engineer_id: userId, ended_at: new Date().toISOString(), decision: "revisions", minutes: 10 })
      .select("id")
      .single();
    if (sErr) throw new Error(`session ${tag}: ${sErr.message}`);
    return { id, sessionId: s.id, fileNumber: `254-PROBE-UC${tag}${TAIL}` };
  }

  const windstorm = await decided("W", "windstorm-wpi-8", null);
  const listed = (await uncreditedReviews()).find((r) => r.sessionId === windstorm.sessionId);
  check(
    "a windstorm review with no deliverable is on the office's list, naming its file",
    Boolean(listed) && listed.fileNumber === windstorm.fileNumber,
    listed ? listed.fileNumber : "NOT LISTED",
  );
  check(
    "and it says what is missing, and offers the two deliverables to choose between",
    Boolean(listed) && /deliverable/.test(listed.missing ?? "") && listed.choices.includes("completed") && listed.choices.includes("ongoing") && listed.dueCents === null,
    listed ? `"${listed.missing}"; choices ${listed.choices.join(", ")}` : "",
  );
  const roof = await decided("R", "roof-inspections", "standard");
  const roofListed = (await uncreditedReviews()).find((r) => r.sessionId === roof.sessionId);
  check(
    "a review whose credit is due and was never written is listed too, with the figure due",
    Boolean(roofListed) && roofListed.missing === null && roofListed.dueCents === 17_500,
    roofListed ? `${roofListed.dueCents} cents due` : "NOT LISTED",
  );
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  for (const id of fileIds) {
    await db.from("eng_review_sessions").delete().eq("file_id", id);
    await db.from("eng_files").delete().eq("id", id);
  }
  if (clientId) await db.from("eng_clients").delete().eq("id", clientId);
  if (userId) {
    await db.from("eng_profiles").delete().eq("id", userId);
    await db.auth.admin.deleteUser(userId).catch(() => {});
  }
  const { data: lf } = fileIds.length ? await db.from("eng_files").select("id").in("id", fileIds) : { data: [] };
  const { data: lc } = clientId ? await db.from("eng_clients").select("id").eq("id", clientId) : { data: [] };
  const lu = userId ? (await db.auth.admin.getUserById(userId)).data?.user : null;
  check(
    "the probe files, client and engineer are removed, read back",
    (lf ?? []).length === 0 && (lc ?? []).length === 0 && !lu,
    `${(lf ?? []).length} file(s), ${(lc ?? []).length} client(s), ${lu ? 1 : 0} user(s) left`,
  );
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a decided review that credited nothing reaches the office, named, with what is missing.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
