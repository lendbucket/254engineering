/**
 * PROOF: THE TWO STATES ARE TWO FACTS, AND THE DATABASE KNOWS THE DIFFERENCE.
 *
 * Operator ruling, 2026-09-16. Draft means the engineer has not signed.
 * awaiting_engineer means he has signed the document and has not yet approved
 * it in the platform. A status vocabulary that lacks a word for the situation
 * you are in makes somebody choose the nearest lie.
 *
 * WHY IT RUNS IN A REPLAYED DATABASE rather than against development. These are
 * INSERTS that must be REFUSED, and the interesting ones are refusals. Proving
 * them live would mean writing protocol rows into a real database to watch them
 * bounce, and the rows that did not bounce would have to be cleaned up. The
 * replay is thrown away, which is the same treatment eng_partner_entries and
 * the sealed work triggers already get.
 *
 * WHAT IT WOULD CATCH. Somebody widening the status check without the
 * constraints, which is the natural way to add a state: the word would exist
 * and mean nothing, and a signed protocol could still sit in draft.
 *
 * ===========================================================================
 * IT ASSERTS THE PROTECTION, NOT THE MECHANISM. Operator ruling, 2026-09-23.
 * ===========================================================================
 *
 * A signed protocol cannot be altered, WHICHEVER LAYER REFUSES. Until this
 * ruling several checks here matched the refusal message against a named CHECK
 * CONSTRAINT. 0052 then added a trigger that refuses the same insert EARLIER,
 * with its own message, so the guarantee got STRICTER and this proof reported a
 * failure.
 *
 * It was written at 0049 and nothing ran it while the schema moved to 0058, so
 * nobody saw it until scripts/proofs-audit.mjs was built on 2026-09-23 and ran
 * every proof for the first time. Asserting the refusal rather than its wording
 * makes the proof survive a tightening, which is the direction the schema is
 * supposed to move. Printing the refusal is what stops that becoming vague.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DIR = join(process.cwd(), "supabase", "migrations");

const db = new PGlite();

/*
 * The Supabase objects the migrations reference, exactly as migration-audit
 * creates them. Minimal, and outside anything this proof asserts.
 */
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key,
    name text,
    public boolean,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
`);

for (const f of readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(DIR, f), "utf8"));
}

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/*
 * A KNOWN DIFFERENCE WITH AN END DATE, NOT A PASS AND NOT A FAILURE.
 *
 * Operator ruling, 2026-09-23. One assertion below fails today because of a
 * defect in the SCHEMA rather than in this proof, the fix is a migration, and a
 * migration is applied in a sitting with the operator. Leaving it FAIL would
 * hold a merge on work nobody can do unattended; deleting it would lose the
 * finding.
 *
 * THE DATE IS NOT HERE. It lives in src/config/parked-work.ts, and
 * scripts/proofs-audit.mjs refuses an acknowledgement whose park is missing or
 * expired. An acknowledgement with its expiry written beside it is one somebody
 * edits to make a red go away.
 */
const ACKNOWLEDGED = [];
const acknowledge = (name, parkId, note) => {
  ACKNOWLEDGED.push(parkId);
  console.log(`ACKNOWLEDGED  ${name} [park: ${parkId}]${note ? ` (${note})` : ""}`);
};

/**
 * WHAT REFUSED IT, SAID OUT LOUD.
 *
 * The check asserts only that the database refused. This names the layer that
 * did, so a reader can still see WHICH guard fired without the check depending
 * on it. That is the whole difference between surviving a tightening and being
 * vague about what is guaranteed.
 */
function refusalNote(r) {
  const first = String(r.message).split("\n")[0].trim();
  const named = first.match(/constraint "([^"]+)"/);
  if (named) return `refused by constraint ${named[1]}`;
  return `refused: ${first.replace(/^eng:\s*/, "").slice(0, 90)}`;
}

/** Runs a statement and answers whether the database refused it, and why. */
async function refused(sql) {
  try {
    await db.exec(sql);
    return { refused: false, message: "" };
  } catch (err) {
    return { refused: true, message: err instanceof Error ? err.message : String(err) };
  }
}

const base = `insert into eng_protocol_templates (service_slug, name, version, status`;

/* ------------------------------------------ the new word exists at all */

const draftOk = await refused(
  `${base}) values ('proof-a', 'Unsigned draft', 1, 'draft');`,
);
check("an unsigned protocol may sit in draft", draftOk.refused === false, "draft still means unsigned");

const awaitingOk = await refused(
  `${base}, document_signed_at) values ('proof-b', 'Signed, not approved here', 1, 'awaiting_engineer', '2026-09-14');`,
);
check(
  "a signed protocol may sit in awaiting_engineer",
  awaitingOk.refused === false,
  "the state the vocabulary was missing",
);

/* ------------- 1. a record whose document carries a signature is not a draft */

const signedDraft = await refused(
  `${base}, document_signed_at) values ('proof-c', 'Signed but called a draft', 1, 'draft', '2026-09-14');`,
);
check(
  "a protocol whose document carries a signature CANNOT sit in draft",
  signedDraft.refused,
  signedDraft.refused ? refusalNote(signedDraft) : "IT WAS ACCEPTED",
);

/* --------------- 2. awaiting_engineer is not in force, so nothing dispatches */

const awaitingApproved = await refused(
  `${base}, document_signed_at, approved_by, approved_at)
   values ('proof-d', 'Awaiting but claiming an approver', 1, 'awaiting_engineer', '2026-09-14', gen_random_uuid(), now());`,
);
check(
  "a protocol in awaiting_engineer cannot claim an approver",
  awaitingApproved.refused,
  awaitingApproved.refused ? refusalNote(awaitingApproved) : "IT WAS ACCEPTED",
);

const awaitingPublishedAt = await refused(
  `${base}, document_signed_at, published_at)
   values ('proof-e', 'Awaiting but published', 1, 'awaiting_engineer', '2026-09-14', now());`,
);
check(
  "nor a publication date, which is what in force means and therefore what dispatch reads",
  awaitingPublishedAt.refused,
  awaitingPublishedAt.refused ? refusalNote(awaitingPublishedAt) : "IT WAS ACCEPTED",
);

/* ------------------------- 3. in force means somebody approved it, by name */

const publishedNoApprover = await refused(
  `${base}, document_signed_at, published_at)
   values ('proof-f', 'Published with nobody behind it', 1, 'published', '2026-09-14', now());`,
);
check(
  "a published protocol cannot be born in force with nobody behind it",
  publishedNoApprover.refused,
  publishedNoApprover.refused ? refusalNote(publishedNoApprover) : "IT WAS ACCEPTED",
);

/* ---------------------------------------------- and the old words still work */

/*
 * ===========================================================================
 * A RETIRED PROTOCOL WITH NO ITEMS CANNOT BE INSERTED, AND THAT IS A DEFECT.
 * Operator ruling, 2026-09-23. Split into its own check and ACKNOWLEDGED.
 * ===========================================================================
 *
 * WHAT REFUSES IT. `eng_protocol_in_force_holds_items`, the deferred constraint
 * trigger added by 0052, whose guard reads
 *
 *     if v_status not in ('published', 'retired') then return null; end if;
 *
 * so it treats RETIRED as in force and demands items. The exception it raises
 * says "is in force with no items" about a row whose status says it is not in
 * force. Retired is the opposite of in force.
 *
 * WHY IT IS A DEFECT RATHER THAN A TIGHTENING. The guard conflates two rules. A
 * protocol IN FORCE must hold its items, which is right and is what the message
 * describes. A protocol that WAS in force must keep them, which is also
 * defensible and is about not REMOVING items. Firing on INSERT enforces a third
 * thing neither rule says: that a retired protocol may never be RECORDED
 * without items. On UPDATE the behaviour is correct.
 *
 * WHAT IT COSTS TODAY: nothing reachable. Nothing in the product inserts or
 * moves a protocol to retired; the lifecycle reaches it by UPDATE from
 * published, which already holds items. It would bite on recording a historical
 * protocol retired before this platform existed.
 *
 * THE FIX IS A MIGRATION, applied in a sitting with the operator together with
 * the register entry, because both touch production. So this is acknowledged
 * with an end date rather than left red or deleted. The date lives in
 * src/config/parked-work.ts and proofs-audit refuses an acknowledgement whose
 * park is missing or expired.
 */
const retiredOk = await refused(`${base}) values ('proof-g', 'Retired', 1, 'retired');`);
if (retiredOk.refused === false) {
  check("a retired protocol with no items can be inserted", true, "accepted, as it should be");
} else {
  acknowledge(
    "a retired protocol with no items can be inserted",
    "protocol-retired-insert-requires-items",
    `${refusalNote(retiredOk)}. eng_protocol_in_force_holds_items, added by 0052, treats retired as in force on INSERT`,
  );
}

const nonsense = await refused(`${base}) values ('proof-h', 'Nonsense', 1, 'in_review');`);
check(
  "and a status the vocabulary does not have is still refused",
  nonsense.refused,
  "widening the list did not open it",
);

await db.close();

/*
 * THE ACKNOWLEDGED IDS ARE PRINTED IN A SHAPE proofs-audit PARSES, so it can
 * refuse an acknowledgement whose park has expired or been deleted. Printed
 * even when empty, because a runner that treats a missing line as "none" cannot
 * tell silence from a proof that failed before reaching here.
 */
console.log(`\nACKNOWLEDGED-PARKS: ${ACKNOWLEDGED.join(",")}`);
console.log(wrong === 0 ? "All checks correct." : `${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
