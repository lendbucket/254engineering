/**
 * A DESIGN JOB PAYS THE ENGINEER ONLY UNDER A SCOPE ADDENDUM HE SIGNED, AND
 * THE ADDENDUM IS SIGNED EXACTLY AS A PROTOCOL IS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-design-job-pays-only-under-a-signed-addendum.mjs
 *
 * Operator rulings of 2026-10-22 (migration 0082): custom design pays 35% of
 * the engineering fee under a signed scope addendum and nothing without it; the
 * engineer signs it in the portal under his own account with a fresh second
 * factor, recorded as a seal act exactly like a protocol signature.
 *
 * In an in-process Postgres with every migration replayed, as the signing
 * proof runs, so nothing touches development. INVENTED DATA ONLY: a fictional
 * address and @audit-probe.invalid contacts, by the operator's ruling; the real
 * job is written on production by the chat.
 */
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0082 included", files.at(-1).startsWith("0082_"), files.at(-1));

const ENG = "00000000-0000-4000-8000-0000000000e1";
const OTHER = "00000000-0000-4000-8000-0000000000e4";
const SEAL = "00000000-0000-4000-8000-0000000000e2";
const SIG = "00000000-0000-4000-8000-0000000000e3";
const OSEAL = "00000000-0000-4000-8000-0000000000e5";
const OSIG = "00000000-0000-4000-8000-0000000000e6";
const QUOTE = "00000000-0000-4000-8000-0000000000a9";
const h64 = "0".repeat(64);
await db.exec(`
  insert into auth.users (id) values ('${ENG}'), ('${OTHER}');
  insert into eng_profiles (id, email, display_name, role)
    values ('${ENG}', 'addendum-engineer@audit-probe.invalid', 'Addendum proof engineer, not a real person', 'engineer'),
           ('${OTHER}', 'addendum-other@audit-probe.invalid', 'Another proof engineer, not a real person', 'engineer');
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at)
    values ('${SEAL}', '${ENG}', 'seal', 'proof/a-seal.png', '${h64}', 1, 1, 1, now()),
           ('${SIG}', '${ENG}', 'signature', 'proof/a-sig.png', '${h64}', 1, 1, 1, now()),
           ('${OSEAL}', '${OTHER}', 'seal', 'proof/o-seal.png', '${h64}', 1, 1, 1, now()),
           ('${OSIG}', '${OTHER}', 'signature', 'proof/o-sig.png', '${h64}', 1, 1, 1, now());
  insert into eng_quote_requests (id, site, reference, service_slug, tier, customer_name, customer_email,
                                  property_address, city, county, quoted_cents, scope, status)
    values ('${QUOTE}', '254engineering', '254-Q2026-PROBE01', 'residential-light-commercial-design', 'custom-package',
            'Probe Contact, not a real person', 'design-probe@audit-probe.invalid',
            '100 Fictional Way', 'Probeville', 'Probe', 200000,
            'Framing check, attachment and uplift calculation, sealed letter.', 'sent');
`);

const addendum = async (by = ENG, scope = "Framing check, attachment and uplift calculation, sealed letter.") =>
  (
    await db.query(
      `insert into eng_scope_addenda (quote_id, deliverable, engineer_id, scope, fee_cents, share_bp, pay_cents)
       values ($1, 'residential-light-commercial-design/custom-package', $2, $3, 200000, 3500, 70000)
       returning id, addendum_text, content_sha256`,
      [QUOTE, by, scope],
    )
  ).rows[0];
const pay = async () => (await db.query("select * from eng_design_pay($1)", [QUOTE])).rows[0] ?? null;
const sign = (act, id, sha, by = ENG, seal = SEAL, sig = SIG) =>
  db.query("select eng_record_addendum_signature($1, $2, $3, $4, $5, $6, now())", [act, id, sha, by, seal, sig]);
const refusal = async (fn) => {
  try {
    await fn();
    return "";
  } catch (e) {
    return e.message;
  }
};

/* 1. The addendum and its text. */
const a = await addendum();
{
  const digest = createHash("sha256").update(a.addendum_text, "utf8").digest("hex");
  check("the database writes the addendum's text, and its SHA-256 is the text's", digest === a.content_sha256, a.content_sha256.slice(0, 12));
  check(
    "the text names the job, the scope, the $2,000 fee and the 35% share of $700",
    a.addendum_text.includes("254-Q2026-PROBE01") && a.addendum_text.includes("100 Fictional Way") &&
      a.addendum_text.includes("Framing check, attachment and uplift calculation, sealed letter.") &&
      a.addendum_text.includes("$2,000.00") && a.addendum_text.includes("35% of the engineering fee, $700.00"),
    a.addendum_text.split("\n").slice(-3).join(" | "),
  );
  const badPay = await refusal(() =>
    db.query(
      `insert into eng_scope_addenda (quote_id, deliverable, engineer_id, scope, fee_cents, share_bp, pay_cents)
       values ($1, 'residential-light-commercial-design/custom-package', $2, 'x', 200000, 3500, 80000)`,
      [QUOTE, ENG],
    ),
  );
  check("a pay that is not the share of the fee is refused", /pay_is_the_share/.test(badPay), badPay.slice(0, 70));
  const wrongDeliverable = await refusal(() =>
    db.query(
      `insert into eng_scope_addenda (quote_id, deliverable, engineer_id, scope, fee_cents, share_bp, pay_cents)
       values ($1, 'roof-inspections/standard', $2, 'x', 200000, 3500, 70000)`,
      [QUOTE, ENG],
    ),
  );
  check("an addendum must price the deliverable its quote is for", /prices/.test(wrongDeliverable), wrongDeliverable.slice(0, 70));
  const edit = await refusal(() => db.query("update eng_scope_addenda set fee_cents = 300000 where id = $1", [a.id]));
  check("and an addendum cannot be edited once written", edit !== "", edit.slice(0, 60));
}

/* 2. Unsigned pays nothing. */
check("an unsigned addendum pays nothing: the price book has no figure", (await pay()) === null);

/* 3. Signed only by the engineer it names, only over its own text. */
{
  const byOther = await refusal(() => sign(randomUUID(), a.id, a.content_sha256, OTHER, OSEAL, OSIG));
  check("another engineer cannot sign it", /engineer it names/.test(byOther), byOther.slice(0, 70));
  const wrongHash = await refusal(() => sign(randomUUID(), a.id, "f".repeat(64)));
  check("nor can its engineer sign a different text", /hash of its own text/.test(wrongHash), wrongHash.slice(0, 70));
  check("and neither attempt left a signature, so it still pays nothing", (await pay()) === null);
}

/* 4. Signed, it pays exactly the addendum's figure, audited as an addendum signature. */
const act = randomUUID();
{
  const before = Number((await db.query("select count(*)::int as n from eng_audit_events where action = 'addendum.signed'")).rows[0].n);
  await sign(act, a.id, a.content_sha256);
  const p = await pay();
  check("signed by its engineer over its text, it pays $700 on the $2,000 fee", p?.pay_cents === "70000" || p?.pay_cents === 70000, JSON.stringify(p));
  const after = Number((await db.query("select count(*)::int as n from eng_audit_events where action = 'addendum.signed'")).rows[0].n);
  check("and the signature is audited as an addendum signature", after === before + 1);
  const twice = await refusal(() => sign(randomUUID(), a.id, a.content_sha256));
  check("a second live signature on the same addendum is refused", twice !== "", twice.slice(0, 60));
}

/* 5. A newer addendum not yet signed stops the old one paying; voiding stops it too. */
{
  const b = await addendum(ENG, "Framing check, attachment and uplift calculation, fastener schedule, sealed letter.");
  check("a newer addendum on the same quote, not yet signed, pays nothing, rather than the old one going on paying", (await pay()) === null);
  await sign(randomUUID(), b.id, b.content_sha256);
  check("signed, the newer addendum pays", (await pay())?.addendum_id === b.id);
  const live = (await db.query("select id from eng_seal_acts where addendum_id = $1 and voided_at is null", [b.id])).rows[0].id;
  await db.query("select eng_void_seal_act($1, $2, $3)", [live, ENG, "Proof: voided."]);
  check("voiding its signature stops the pay", (await pay()) === null);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: a design job pays the engineer only under a scope addendum he signed, as a protocol is signed.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
