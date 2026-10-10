/**
 * A FILE UNDER REVIEW BELONGS TO THE ENGINEER WHO TOOK IT INTO REVIEW.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-review-belongs-to-its-engineer.mjs
 *
 * An access defect from the product audit, 2026-10-10: canReview carried an
 * assignedEngineerId it never read, decideReview passed the caller's own id as
 * the assignee, and openReview opened a second session on a file already under
 * another engineer's review. So any account in the engineer role could take
 * over and decide another engineer's file.
 *
 * Asked through the product's own functions on development: engineer A takes a
 * demonstration file into review; engineer B is refused opening it and refused
 * deciding it; A, the control, still opens it. B's decision is refused before
 * anything is written, so nothing here can leave a determination behind.
 * Probes on @audit-probe.invalid; the file carries the DEMO segment; all of it
 * removed and read back.
 */
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { auditClient, isProduction } = await import("../lib/db-target.mjs");
const db = auditClient("the review ownership proof", { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no development database client in this environment, so nothing was proved.");
  process.exit(0);
}
if (isProduction(process.env.SUPABASE_URL)) throw new Error("refusing: production");

const { openReview, decideReview } = await import("../../src/lib/ops-engineer.ts");

const STAMP = Date.now();
const users = [];
let fileId = null;

async function engineer(tag) {
  const email = `review-proof-${tag}-${STAMP}@audit-probe.invalid`;
  const made = await db.auth.admin.createUser({ id: randomUUID(), email, password: `p-${randomUUID()}`, email_confirm: true });
  if (made.error || !made.data?.user) throw new Error(`createUser ${tag}: ${made.error?.message}`);
  users.push(made.data.user.id);
  const { error } = await db.from("eng_profiles").insert({
    id: made.data.user.id, email, display_name: `Review proof engineer ${tag}, not a real person`,
    role: "engineer", status: "active", is_demo: true,
  });
  if (error) throw new Error(`profile ${tag}: ${error.message}`);
  const { data: row } = await db.from("eng_profiles").select("*").eq("id", made.data.user.id).single();
  const { data: grants } = await db.from("eng_role_grants").select("action").eq("role_key", "engineer");
  return { ...row, email, grants: new Set((grants ?? []).map((g) => g.action)) };
}

try {
  const a = await engineer("a");
  const b = await engineer("b");
  const { data: client } = await db.from("eng_clients").select("id").eq("is_demo", true).limit(1).maybeSingle();
  if (!client) throw new Error("development holds no demonstration client");
  fileId = randomUUID();
  const { error: fErr } = await db.from("eng_files").insert({
    id: fileId, file_number: `254-DEMO-RV${String(STAMP).slice(-6)}`, is_demo: true, client_id: client.id,
    /* A line with no protocol in force, so no determination is required and the
     * decision reaches the ownership rule itself rather than being refused for
     * a missing determination first. */
    service_slug: "structural-letters", property_address: "1 Review Proof Way", county: "Kenedy", status: "evidence_submitted",
  });
  if (fErr) throw new Error(`file: ${fErr.message}`);

  const openedA = await openReview(a, fileId);
  const { data: f1 } = await db.from("eng_files").select("status, assigned_engineer_id").eq("id", fileId).single();
  check("engineer A takes the file into review", openedA.ok && f1?.status === "under_review" && f1?.assigned_engineer_id === a.id, openedA.ok ? `${f1?.status}, assigned ${f1?.assigned_engineer_id === a.id ? "A" : f1?.assigned_engineer_id}` : openedA.error);

  const openedB = await openReview(b, fileId);
  check("engineer B is refused opening a file under A's review", !openedB.ok, openedB.ok ? "B OPENED A SESSION ON A'S FILE" : openedB.error);

  const decidedB = await decideReview(b, fileId, "revisions", "Engineer B tries to send back a file under A's review.");
  check(
    "and engineer B is refused deciding it, by the ownership rule and not by anything else",
    !decidedB.ok && /another engineer/i.test(decidedB.error ?? ""),
    decidedB.ok ? "B DECIDED A'S FILE" : decidedB.error,
  );
  const { count: determinations } = await db.from("eng_determinations").select("id", { count: "exact", head: true }).eq("file_id", fileId);
  check("and nothing was written by the attempt", (determinations ?? 0) === 0, `${determinations ?? 0} determination(s)`);

  const againA = await openReview(a, fileId);
  check("while engineer A, the control, still opens it", againA.ok, againA.ok ? "" : againA.error);
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof could not complete (${e.message})`);
} finally {
  if (fileId) {
    await db.from("eng_review_sessions").delete().eq("file_id", fileId);
    await db.from("eng_files").delete().eq("id", fileId);
  }
  const { data: leftFile } = fileId ? await db.from("eng_files").select("id").eq("id", fileId) : { data: [] };
  for (const id of users) {
    await db.from("eng_profiles").delete().eq("id", id);
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
  let leftUsers = 0;
  for (const id of users) if ((await db.auth.admin.getUserById(id)).data?.user) leftUsers += 1;
  check("the file and both probes are removed, read back", (leftFile ?? []).length === 0 && leftUsers === 0, `${(leftFile ?? []).length} file(s), ${leftUsers} user(s) left`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a file under review belongs to the engineer who took it into review.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
