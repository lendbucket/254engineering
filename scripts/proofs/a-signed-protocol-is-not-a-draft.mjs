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
  signedDraft.refused && /signed_is_not_draft/.test(signedDraft.message),
  signedDraft.refused ? "refused by its own named constraint" : "IT WAS ACCEPTED",
);

/* --------------- 2. awaiting_engineer is not in force, so nothing dispatches */

const awaitingApproved = await refused(
  `${base}, document_signed_at, approved_by, approved_at)
   values ('proof-d', 'Awaiting but claiming an approver', 1, 'awaiting_engineer', '2026-09-14', gen_random_uuid(), now());`,
);
check(
  "a protocol in awaiting_engineer cannot claim an approver",
  awaitingApproved.refused,
  awaitingApproved.refused ? "refused" : "IT WAS ACCEPTED",
);

const awaitingPublishedAt = await refused(
  `${base}, document_signed_at, published_at)
   values ('proof-e', 'Awaiting but published', 1, 'awaiting_engineer', '2026-09-14', now());`,
);
check(
  "nor a publication date, which is what in force means and therefore what dispatch reads",
  awaitingPublishedAt.refused && /awaiting_is_not_in_force/.test(awaitingPublishedAt.message),
  awaitingPublishedAt.refused ? "refused by its own named constraint" : "IT WAS ACCEPTED",
);

/* ------------------------- 3. in force means somebody approved it, by name */

const publishedNoApprover = await refused(
  `${base}, document_signed_at, published_at)
   values ('proof-f', 'Published with nobody behind it', 1, 'published', '2026-09-14', now());`,
);
check(
  "a published protocol must name who approved it and when",
  publishedNoApprover.refused && /published_is_approved/.test(publishedNoApprover.message),
  publishedNoApprover.refused ? "refused by its own named constraint" : "IT WAS ACCEPTED",
);

/* ---------------------------------------------- and the old words still work */

const retiredOk = await refused(`${base}) values ('proof-g', 'Retired', 1, 'retired');`);
check("retired is untouched", retiredOk.refused === false, "the migration widened rather than replaced");

const nonsense = await refused(`${base}) values ('proof-h', 'Nonsense', 1, 'in_review');`);
check(
  "and a status the vocabulary does not have is still refused",
  nonsense.refused,
  "widening the list did not open it",
);

await db.close();
console.log(wrong === 0 ? "\nAll checks correct." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
