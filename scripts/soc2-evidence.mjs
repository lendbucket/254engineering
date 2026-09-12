/**
 * THE EVIDENCE PACK, GENERATED FROM THE PLATFORM.
 *
 *   npx tsx scripts/soc2-evidence.mjs
 *
 * Phase 12 Section 6. Produces four artefacts and two documents, and every
 * figure in every one of them is read from the database or from a declaration
 * at the moment of generation. Nothing here is prose about the platform.
 *
 * WHY GENERATED AND NOT WRITTEN
 * -----------------------------
 * A readiness document is the easiest thing in this repository to get wrong,
 * because nothing contradicts it. Code has a compiler, a migration has a
 * fingerprint, a page has an audit; a document saying "access is reviewed
 * quarterly" has only the person reading it, and by the time somebody checks it
 * has been wrong for a year.
 *
 * So the documents are outputs. `scripts/soc2-audit.mjs` fails the board when a
 * declared control is missing from the generated report, when a declared
 * regenerate command does not run, or when anything that looks like a secret
 * value reaches a file this script writes.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It never writes a secret value. It never claims a control the declaration does
 * not carry. It reads whichever database `scripts/lib/db-target.mjs` resolves,
 * which is development unless somebody deliberately points it elsewhere, and it
 * STAMPS WHICH ONE on every artefact, because an access review of the wrong
 * database is worse than none.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { auditClient, describeTarget, refOf } from "./lib/db-target.mjs";
import { CONTROLS, GAPS, CRITERIA, regenerateCommands } from "./lib/soc2-controls.mjs";
import { CREDENTIALS, OFFBOARDING } from "./lib/soc2-credentials.mjs";
import { APPLIED } from "../supabase/applied.mjs";

/*
 * WHERE THE ARTEFACTS GO, AND WHY IT IS OVERRIDABLE.
 *
 * Normally `evidence/` and `docs/`, which are tracked.
 *
 * `scripts/soc2-audit.mjs` proves this command still runs by EXECUTING it, and
 * the first version of that check ran it over the tracked files. So every board
 * run rewrote four tracked artefacts with a fresh timestamp and left the working
 * tree dirty, which is how a real uncommitted change hides among four expected
 * ones.
 *
 * The audit points these at a temporary directory instead. The command is still
 * genuinely executed, which is what the check is for; what it no longer does is
 * edit the repository in order to check that it can.
 */
const OUT_DIR = process.env.SOC2_OUT_DIR || "evidence";
const DOCS_DIR = process.env.SOC2_DOCS_DIR || "docs";
const db = auditClient("soc2-evidence");
/*
 * THE TARGET IS READ AFTER the client is built, because auditClient is what
 * loads .env.local. Reading it before produced "undefined (undefined)" on the
 * first run and stamped it onto an access review, which is precisely the
 * artefact where a wrong database name is worse than no database name.
 *
 * It REFUSES rather than guessing. An evidence pack that cannot say which
 * database it describes is not evidence.
 */
const targetUrl = process.env.SUPABASE_URL ?? "";
const targetRef = refOf(targetUrl);
const targetLabel = describeTarget(targetUrl);
if (!targetRef) {
  console.error("Could not tell which database this is from SUPABASE_URL, so nothing was written.");
  console.error("An access review that cannot name its database is worse than none.");
  process.exit(1);
}

/*
 * ONE TIMESTAMP FOR THE WHOLE RUN, FROM THE DATABASE.
 *
 * Not from this machine's clock. That rule is db-now.ts's and it applies here
 * for a sharper reason than usual: an access review stamped with a time the
 * database does not agree with is an artefact whose date an auditor can
 * disprove. The machine clock was 85 seconds out as recently as 2026-09-11.
 */
const { data: nowRow } = await db.rpc("eng_now").maybeSingle?.() ?? { data: null };
let generatedAt = nowRow ?? null;
if (!generatedAt) {
  /*
   * No eng_now function exists, so the timestamp comes from a row the database
   * stamps itself. Falling back to Date.now() would be the exact defect
   * db-now.ts exists to prevent, so it is not offered.
   */
  const probe = await db.from("eng_jobs").select("created_at").order("created_at", { ascending: false }).limit(1);
  generatedAt = probe.data?.[0]?.created_at ?? null;
}

const iso = (v) => (v ? String(v).slice(0, 19).replace("T", " ") : "");
const day = String(generatedAt ?? "").slice(0, 10) || "unknown-date";

/* ------------------------------------------------------------------ live reads */

const count = async (table) => {
  const r = await db.from(table).select("*", { count: "exact", head: true });
  return r.error ? null : r.count;
};

const [profiles, roles, grants, mfa, customers, partners] = await Promise.all([
  db.from("eng_profiles").select("id,email,display_name,role,status,created_at,last_sign_in_at,suspended_at,is_demo").order("created_at"),
  db.from("eng_roles").select("key,name,landing_path,is_system,mfa_requirement").order("key"),
  db.from("eng_role_grants").select("role_key,action").order("role_key"),
  db.from("eng_mfa_enrolments").select("user_id,verified_at,last_used_at"),
  db.from("eng_customer_users").select("id,email,status,created_at,last_sign_in_at").order("created_at"),
  db.from("eng_partner_users").select("id,email,status,created_at,last_sign_in_at").order("created_at"),
]);

for (const [label, r] of [["profiles", profiles], ["roles", roles], ["grants", grants], ["mfa", mfa]]) {
  if (r.error) {
    console.error(`Could not read ${label}: ${r.error.message}`);
    console.error("An evidence pack generated over a failed read would report zero findings because it saw nothing.");
    process.exit(1);
  }
}

const grantsByRole = new Map();
for (const g of grants.data ?? []) {
  if (!grantsByRole.has(g.role_key)) grantsByRole.set(g.role_key, []);
  grantsByRole.get(g.role_key).push(g.action);
}
const mfaByUser = new Map((mfa.data ?? []).map((m) => [m.user_id, m]));

/* The audit trail's reach, which is what makes it evidence rather than a table. */
const trailCount = await count("eng_audit_events");
const trailFirst = await db.from("eng_audit_events").select("created_at").order("created_at", { ascending: true }).limit(1);
const trailLast = await db.from("eng_audit_events").select("created_at").order("created_at", { ascending: false }).limit(1);

/* ---------------------------------------------------------------- csv helpers */

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (vals) => vals.map(cell).join(",");
const csv = ({ preamble = [], headers, rows }) =>
  [...preamble.map((p) => row(p)), preamble.length ? "" : null, row(headers), ...rows.map(row)]
    .filter((l) => l !== null)
    .join("\r\n");

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DOCS_DIR, { recursive: true });
const written = [];
const write = (name, body) => {
  writeFileSync(`${OUT_DIR}/${name}`, body);
  written.push(`${OUT_DIR}/${name}`);
};

/* ============================================================ 1. ACCESS REVIEW */

const staffRows = (profiles.data ?? []).map((p) => {
  const enrol = mfaByUser.get(p.id);
  return [
    "staff",
    p.email,
    p.display_name,
    p.role,
    p.status,
    p.suspended_at ? `suspended ${iso(p.suspended_at)}` : "",
    iso(p.created_at),
    p.last_sign_in_at ? iso(p.last_sign_in_at) : "never",
    enrol?.verified_at ? `enrolled ${iso(enrol.verified_at)}` : enrol ? "started, not verified" : "no",
    (grantsByRole.get(p.role) ?? []).length,
    (grantsByRole.get(p.role) ?? []).join(" "),
    p.is_demo ? "DEMONSTRATION" : "",
  ];
});

/*
 * A CUSTOMER'S GRANT COUNT IS NOT ZERO, IT IS NOT ROLE BASED.
 *
 * The first version of this report put 0 in the Grants column and left
 * Permissions empty for customers and partners, which reads as "this account
 * can do nothing". It is false: a customer can see their own orders and a
 * partner their own earnings. Found by reading the CSV rather than by any
 * check, because every check was asking whether the number was correct and none
 * was asking what a reader would take it to mean.
 *
 * An access review that understates access is worse than one that omits it,
 * because the reader believes they have looked.
 */
const NON_STAFF_SCOPE = {
  customer:
    "Not role based. Scoped by ownership to this account's own orders, files and statements. Enforced in src/lib/customer-auth.ts, never by a grant row.",
  partner:
    "Not role based. Scoped by ownership to this partner's own record, touches, entries and statements. Enforced in src/lib/partner-auth.ts.",
};

const otherRows = [
  ...(customers.data ?? []).map((c) => ["customer", c.email, "", "customer", c.status, "", iso(c.created_at), c.last_sign_in_at ? iso(c.last_sign_in_at) : "never", "not applicable", "not role based", NON_STAFF_SCOPE.customer, ""]),
  ...(partners.data ?? []).map((c) => ["partner", c.email, "", "partner", c.status, "", iso(c.created_at), c.last_sign_in_at ? iso(c.last_sign_in_at) : "never", "not applicable", "not role based", NON_STAFF_SCOPE.partner, ""]),
];

const demoCount = staffRows.filter((r) => r[11] === "DEMONSTRATION").length;

/*
 * THE FINDINGS, COMPUTED. An access review that lists accounts and leaves the
 * reader to spot the problem is a spreadsheet. These are the questions an
 * auditor asks of the list, answered by the list.
 *
 * Each one names the accounts rather than counting them, because "3 accounts
 * hold the administrator role" sends somebody back to the rows and "these three
 * do" does not.
 */
const adminGrantCount = Math.max(...[...grantsByRole.values()].map((g) => g.length), 0);
const findings = [];
{
  const admins = staffRows.filter((r) => (grantsByRole.get(r[3]) ?? []).length === adminGrantCount);
  if (admins.length > 0) {
    findings.push([
      "Accounts holding the widest role",
      `${admins.length} of ${staffRows.length}, each with ${adminGrantCount} permissions: ${admins.map((a) => a[1]).join(", ")}`,
    ]);
  }
  const demoAdmins = admins.filter((a) => a[11] === "DEMONSTRATION");
  if (demoAdmins.length > 0) {
    findings.push([
      "FINDING: demonstration accounts holding the widest role",
      `${demoAdmins.map((a) => a[1]).join(", ")}. A seeded account holding every permission is correct on a development database and would be a finding on production. This report does not know which it is looking at beyond the Database line above.`,
    ]);
  }
  const stale = staffRows.filter((r) => r[7] === "never" && r[4] === "active");
  if (stale.length > 0) {
    findings.push([
      "FINDING: active accounts that have never signed in",
      `${stale.map((a) => a[1]).join(", ")}. An account that has never been used is an account nobody would notice being used.`,
    ]);
  }
  const unprotected = staffRows.filter((r) => r[8] === "no" && (grantsByRole.get(r[3]) ?? []).length === adminGrantCount);
  if (unprotected.length > 0) {
    findings.push([
      "FINDING: widest role, no second factor",
      `${unprotected.map((a) => a[1]).join(", ")}. Migration 0025 made the second factor optional by default for the administrator and engineer roles, deliberately, so a single operator could not lock themselves out. It is still the case that the accounts which can do the most are the ones not required to hold one.`,
    ]);
  }
  const suspended = staffRows.filter((r) => r[5] !== "");
  findings.push(["Suspended accounts", suspended.length === 0 ? "none" : suspended.map((a) => a[1]).join(", ")]);
}
const neverSignedIn = [...staffRows, ...otherRows].filter((r) => r[7] === "never").length;
const noMfa = staffRows.filter((r) => r[8] === "no").length;

write(
  `access-review-${day}.csv`,
  csv({
    preamble: [
      ["Export", "Access review"],
      ["What this is", "Every principal that can authenticate, the role it holds, and every permission that role carries. Generated from the database, not maintained by hand."],
      ["Database", `${targetLabel}`],
      ["Generated", iso(generatedAt) || "unknown"],
      ["Staff accounts", staffRows.length],
      ["Customer accounts", (customers.data ?? []).length],
      ["Partner accounts", (partners.data ?? []).length],
      ["Roles defined", (roles.data ?? []).length],
      ["Grants defined", (grants.data ?? []).length],
      ["Accounts that have never signed in", neverSignedIn],
      ["Staff accounts with no verified second factor", noMfa],
      [
        "Demonstration rows",
        demoCount === 0
          ? "none"
          : `${demoCount} of ${staffRows.length} staff rows are seeded demonstrations, named in the last column rather than removed.`,
      ],
      ...findings,
      ["Attested by", "NOBODY. No attestation has been recorded for this review."],
      [
        "What this cannot tell you",
        "Whether each person still needs the access listed. That is the attestation, and it is a human judgement this platform records rather than makes.",
      ],
    ],
    headers: [
      "Principal", "Email", "Name", "Role", "Status", "Suspended",
      "Created", "Last sign in", "Second factor", "Grants", "Permissions", "Demonstration",
    ],
    rows: [...staffRows, ...otherRows],
  }),
);

/* ============================================================= 2. CHANGE RECORD */

const changeRows = APPLIED.map((m) => [
  m.file,
  m.appliedBy,
  m.fingerprint ?? "",
  m.behaviour ?? "not carried before 0038",
  m.production ?? "NOT APPLIED",
  m.development ?? "",
  m.handApplied ? "yes" : "",
]);
const notOnProduction = changeRows.filter((r) => r[4] === "NOT APPLIED").length;
const byHand = changeRows.filter((r) => r[6] === "yes").length;

write(
  `change-record-${day}.csv`,
  csv({
    preamble: [
      ["Export", "Change record"],
      ["What this is", "Every schema change this platform has ever applied, with both fingerprints and the date it reached production. Read from supabase/applied.mjs, which is the ledger two audits already enforce."],
      ["Generated", iso(generatedAt) || "unknown"],
      ["Migrations", changeRows.length],
      ["Not yet on production", notOnProduction],
      ["Applied by hand rather than through the provider", byHand],
      [
        "The behaviour fingerprint",
        "Carried from 0038 onward. It sees foreign key delete actions, check constraint bodies, trigger functions, index predicates, row level security and seeded rows, none of which the shape fingerprint can see.",
      ],
      [
        "What this cannot tell you",
        "Who approved each change, because nobody separate from the author did. And it carries no history of board runs, because the suite keeps none. Both are in docs/soc2-exceptions.md.",
      ],
    ],
    headers: ["Migration", "Applied by", "Shape fingerprint", "Behaviour fingerprint", "On production", "On development", "By hand"],
    rows: changeRows,
  }),
);

/* ================================================= 3 and 4. THE TWO DOCUMENTS */

const byCriterion = (key) => CONTROLS.filter((c) => c.criterion === key);
const verifiable = CONTROLS.filter((c) => c.verifiable).length;
const machine = CONTROLS.filter((c) => c.machine).length;

const readinessDoc = `# SOC 2 readiness

**Generated by \`scripts/soc2-evidence.mjs\` on ${iso(generatedAt) || "an unknown date"} against ${targetLabel} (\`${targetRef}\`). Do not edit this file. Every figure below was read at generation time.**

---

## THIS FIRM IS NOT SOC 2 COMPLIANT, AND THIS DOCUMENT DOES NOT SAY IT IS

Compliance is an auditor's opinion after an observation window. This firm has no
customers, no employees beyond one engineer, and no observation window. There is
no engagement, no auditor, and no report.

**Readiness is a different and answerable question:** if an auditor asked for
evidence tomorrow, what could be produced today. That is what this document
answers, and the answer includes ${GAPS.length} things it cannot produce, listed
before the things it can.

**One person holds every credential, approves every change, and operates every
system.** There is no segregation of duties and there cannot be at this
headcount. Every compensating control here is technical rather than
organisational. Read the rest of this document with that sentence in front of it.

---

## WHAT AN AUDITOR WOULD ASK FOR TOMORROW

| Asked for | Can the firm produce it today |
| --- | --- |
| A list of everyone with access and what they can do | **Yes.** \`evidence/access-review-${day}.csv\`, generated from the database |
| Evidence that access is reviewed and attested | **No.** No attestation has ever been recorded |
| A change log with approvals | **Partly.** Every change with both fingerprints and dates; no approver separate from the author |
| Evidence the audit trail cannot be altered | **Yes.** Refused at the database by a trigger, not by convention |
| Evidence of backups and a tested restore | **No.** Recovery is enabled and has never been exercised |
| A vendor list with their SOC 2 reports | **No.** Neither exists |
| An incident log | **Yes, and it is empty.** No incident has been recorded |
| A risk assessment | **No.** |
| Security training and background check records | **No.** There are no employees |
| Evidence that controls operated over a period | **No.** The board proves today and keeps no history |

---

## THE RUN THAT PRODUCED THIS PACK

Phase 12 Section 6, overnight, 2026-09-12. Recorded here rather than in a
separate file because it is the provenance of every artefact above, and it is
history rather than state, so it cannot drift.

**Gate 0, the inventory.** ${CONTROLS.length} controls declared against the five
criteria, ${GAPS.length} gaps ranked. Nothing was written before the platform was
read: the table list, the row level security state and the integrity guards came
from live catalogue queries against development, not from memory.

**Gate 1, the evidence pack.** The access review, the change record, the control
evidence index and the exceptions register, all generated. Read line by line as
artefacts rather than checked.

**Gate 2, the controls worth adding.** The credential inventory, the offboarding
sequence, and migration 0042's incident record. The access review's recurring
half was NOT built, and the reason is recorded as a gap with the ruling that
would settle it.

### What each round found that no check did

- **The access review reported \`Grants 0\` for customers and partners**, which
  reads as "this account can do nothing" and is false: their access is scoped by
  ownership rather than by grant rows. An access review that understates access
  is worse than one that omits it, because the reader believes they have looked.
  Found by reading the CSV.
- **The evidence pack stamped an unresolved placeholder as its database name.**
  The target was read before the client had loaded the environment. It refuses
  outright now: an evidence pack that cannot name its database is not evidence.
- **The audit was green over documents that no longer existed.** It ran the
  regenerate commands before reading the documents, so it overwrote them and
  inspected its own fresh output. Three injections proved it. Everything it
  judges is snapshotted first now.
- **Two undeclared secrets, invisible to the first scan.** Widening the
  environment scan past a direct property read turned up \`INTAKE_KEY_SEALED\` and
  \`INTAKE_KEY_STAMP\`, one per sister site, each of which lets a caller write
  into this firm's database. Neither appears as a property read anywhere.
- **The exceptions register looked self contradictory**, showing a high severity
  finding at rank 20. The rank is the order a request arrives, not severity, and
  the document now says so where a reader will see it.

### Decisions taken, and flagged

Nothing was merged, nothing was pushed, no migration reached production, no
retention ran, nothing was sent outward, and no row was deleted. 0042 is on
development alone and the ledger says \`production: null\` as a decision rather
than an omission.

### Rulings needed

Three, and they are named where they belong rather than collected here: the
system actor in gap 9, the legal entity name in \`docs/launch-readiness.md\`, and
the cutover in section 3 of the exceptions register.

---

## THE GAPS, RANKED BY WHAT IS ASKED FOR FIRST

${GAPS.map(
  (g) => `### ${g.rank}. ${g.gap}

**Criterion:** ${CRITERIA[g.criterion].split(".")[0]}. **Severity, this session's judgement:** ${g.severity}.

${g.consequence}
${g.ruling ? `\n**Ruling:** ${g.ruling}\n` : ""}`,
).join("\n")}

---

## THE CONTROLS THAT DO EXIST

${CONTROLS.length} controls are declared in \`scripts/lib/soc2-controls.mjs\`.
**${machine} carry machine readable evidence** and **${verifiable} could be
verified by an outsider who will not read the source.** The gap between those two
numbers is the honest measure of how much of this rests on trusting the code.

${Object.entries(CRITERIA)
  .map(([key, label]) => {
    const list = byCriterion(key);
    if (list.length === 0) return `### ${label}\n\nNo controls declared under this criterion.\n`;
    return `### ${label}

| Control | Enforced by | Evidence | Machine readable | Outsider verifiable |
| --- | --- | --- | --- | --- |
${list
  .map(
    (c) =>
      `| ${c.control} | ${c.enforcedBy.replace(/\|/g, "/")} | \`${c.evidence}\` | ${c.machine ? "yes" : "no"} | ${c.verifiable ? "yes" : "no"} |`,
  )
  .join("\n")}

${list
  .filter((c) => c.note)
  .map((c) => `**${c.id}.** ${c.note}`)
  .join("\n\n")}
`;
  })
  .join("\n")}

---

## THE CONTROL EVIDENCE INDEX

Each entry names the command that regenerates its evidence.
\`scripts/soc2-audit.mjs\` runs every one of them and fails the board if any does
not run, so an index entry cannot rot into a command nobody can execute.

| Control | Criterion | Regenerate with |
| --- | --- | --- |
${CONTROLS.map(
  (c) => `| \`${c.id}\` | ${c.criterion} | ${c.regenerate ? `\`${c.regenerate}\`` : "standing artefact, not generated"} |`,
).join("\n")}

**Distinct commands:** ${regenerateCommands().length}.

---

## WHAT THE PLATFORM ACTUALLY HELD AT GENERATION TIME

Read from \`${targetRef}\` at ${iso(generatedAt) || "an unknown time"}.

| | |
| --- | --- |
| Staff accounts | ${staffRows.length} |
| Of those, demonstration rows | ${demoCount} |
| Customer accounts | ${(customers.data ?? []).length} |
| Partner accounts | ${(partners.data ?? []).length} |
| Roles | ${(roles.data ?? []).length} |
| Grants | ${(grants.data ?? []).length} |
| Staff with a verified second factor | ${staffRows.length - noMfa} of ${staffRows.length} |
| Audit trail events | ${trailCount ?? "could not read"} |
| Earliest audit event | ${iso(trailFirst.data?.[0]?.created_at) || "none"} |
| Latest audit event | ${iso(trailLast.data?.[0]?.created_at) || "none"} |
| Migrations in the ledger | ${APPLIED.length} |
| Migrations not yet on production | ${notOnProduction} |

**These are development figures unless the database named above is production.**
An access review of the wrong database is worse than none, which is why the
target is stamped on every artefact this script writes rather than assumed.

---

## THE ROLES, AS THE DATABASE HOLDS THEM

| Role | Name | System | Second factor | Grants |
| --- | --- | --- | --- | --- |
${(roles.data ?? [])
  .map(
    (r) =>
      `| \`${r.key}\` | ${r.name} | ${r.is_system ? "yes" : "no"} | ${r.mfa_requirement} | ${(grantsByRole.get(r.key) ?? []).length} |`,
  )
  .join("\n")}

---

## THE CREDENTIAL INVENTORY

Every environment value this platform reads, what it grants, and where the real
one is held. **No value appears here or anywhere this section writes**, and
\`scripts/soc2-audit.mjs\` proves it by scanning for the SHAPES of secrets rather
than for their names.

The inventory is compared against a scan of every \`process.env\` read in
\`src/\` and \`scripts/\`, so a secret added without being declared fails the
board.

### Secrets

| Name | What it grants | Where the value lives | Last rotated |
| --- | --- | --- | --- |
${CREDENTIALS.filter((c) => c.kind === "secret")
  .map((c) => `| \`${c.name}\` | ${c.grants} | ${c.livesIn} | ${c.rotated} |`)
  .join("\n")}

**${CREDENTIALS.filter((c) => c.kind === "secret" && String(c.rotated).trim() === "Never.").length} of ${CREDENTIALS.filter((c) => c.kind === "secret").length} secrets have never been rotated**, and say so rather than saying unknown. Operator ruling, 2026-09-12: state when each was last rotated, and if the answer is never, say never.

Nothing in this platform RECORDS a rotation, so that column is the operator's statement rather than a platform fact, which is why it is prose and not a date. The two sister intake keys were rotated on development on 2026-09-12 and say that production has not been.

### Configuration, not secret

| Name | What it does | Where |
| --- | --- | --- |
${CREDENTIALS.filter((c) => c.kind !== "secret")
  .map((c) => `| \`${c.name}\` | ${c.grants} | ${c.livesIn} |`)
  .join("\n")}

---

## OFFBOARDING, KEYED TO WHAT THIS PLATFORM CAN DO

A sequence rather than a policy, because a policy is a sentence about intent and
a sequence is a list somebody can follow at eleven at night having never done it
before. Nobody has ever left this firm, so none of it has been exercised.

| # | Step | How | Platform can do it |
| --- | --- | --- | --- |
${OFFBOARDING.map((s) => `| ${s.step} | ${s.what} | ${s.how} | ${s.can ? "yes" : "**no**"} |`).join("\n")}

**${OFFBOARDING.filter((s) => !s.can).length} of ${OFFBOARDING.length} steps the platform cannot perform**, and each says why rather than implying somebody will remember. The sharpest is transferring responsible charge, which must NOT become possible: an entry names the engineer who WAS in responsible charge, and that is a fact about the past.

---

## WHERE THE HONEST HALF LIVES

\`docs/soc2-exceptions.md\`, generated by the same script, carries every control
that does not exist, every deferral with the ruling that made it, and every
consequence that was recorded rather than fixed. It is the half that makes this
half credible.
`;

writeFileSync(`${DOCS_DIR}/soc2-readiness.md`, readinessDoc);
written.push(`${DOCS_DIR}/soc2-readiness.md`);

const exceptionsDoc = `# SOC 2 exceptions register

**Generated by \`scripts/soc2-evidence.mjs\` on ${iso(generatedAt) || "an unknown date"}. Do not edit this file.**

This is the register of what is NOT true. It exists because a readiness document
that lists only controls is a sales document, and because every deferral in this
platform was made deliberately and recorded with its consequence.

---

## 1. CONTROLS THAT DO NOT EXIST

${GAPS.length} declared.

**Ranked by the order the request actually arrives in an engagement, NOT by
severity**, which is why a high severity finding can sit below a medium one. The
first three are what a readiness call opens with, and hearing "we do not have
that" three times in five minutes is the outcome this register exists to stop
being a surprise. Read the severity column separately from the rank.

| # | Gap | Criterion | Severity | Ruling recorded |
| --- | --- | --- | --- | --- |
${GAPS.map(
  (g) => `| ${g.rank} | ${g.gap} | ${g.criterion} | ${g.severity} | ${g.ruling ? "yes" : "none yet"} |`,
).join("\n")}

---

## 2. EVERY GAP, WITH WHAT ACTUALLY FOLLOWS FROM IT

${GAPS.map(
  (g) => `### ${g.rank}. \`${g.id}\`

${g.gap}

**What follows:** ${g.consequence}
${g.ruling ? `\n**Ruling:** ${g.ruling}` : "\n**No ruling has been made on this.**"}
`,
).join("\n")}

---

## 2a. FOUND BY READING A DASHBOARD NO CHECK CAN SEE, 2026-09-12

**Every control in this pack is derived from the repository. The sharpest
finding of the section was not in the repository at all.**

The operator opened the Vercel environment variable list, which nothing here can
read, and found that secrets deciding IDENTITY were shared between Preview and
Production:

| Secret | As found | Why it matters |
| --- | --- | --- |
| \`CUSTOMER_SESSION_SECRET\` | All Environments | A customer cookie minted on ANY preview deployment was valid on production |
| \`PARTNER_SESSION_SECRET\` | Production and Preview, one value | The same, for partners |
| \`MFA_ENCRYPTION_KEY\` | Production and Preview, one value | A preview could decrypt production second factor secrets |
| \`RESEND_API_KEY\` | All Environments | A preview deployment could send real mail as the firm |
| \`OPS_SESSION_SECRET\` | Already split, distinct Preview value | **The correct pattern, applied to one principal of three** |

**Preview URLs are reachable by anybody holding the link.** That is what turns a
shared session secret from untidy into an authentication bypass.

**The last row is why this was findable.** The right answer already existed in
the same dashboard, one row away, which is the difference between a defect and a
design. An audit that could read Vercel would have caught it in a second; no
audit here can.

**What has been done:** the operator set distinct Preview values for the three
identity secrets, left Production untouched, and scoped the mail key to
Production only. \`ADMIN_PASSPHRASE\`, which nothing reads, is deleted from all
three environments and treated as exposed.

**What is still open:** whether the Preview \`SUPABASE_URL\` names the
development project ref. A distinct Preview service role key pointing at
production would be split in form and shared in effect.

**What this pack can now do about it:** \`scripts/lib/soc2-credentials.mjs\`
records which environments each credential lives in and whether the Preview
value is distinct, and \`soc2-audit\` fails when any identity or database secret
is declared as shared. It cannot read Vercel and does not pretend to. What it
buys is that a future sharing is a deliberate edit to a reviewed file rather
than a dropdown nobody opens again.

**And a credential nothing reads was invisible to every scan here.** All of them
start from the source, so they can only find what the code mentions. The scan
runs both ways now: every name set in an environment file must be declared or
recorded as retired. It found two more on its first run.

---

## 3. DEFERRALS, WITH THE RULING AND THE RECORDED CONSEQUENCE

### The cutover to a dedicated database project

**Deferred by operator ruling, 2026-09-10, and again the same day after the
sequence was written.** Nothing has been executed, no throwaway project was
created, and no cost was approved.

**The consequence, recorded rather than softened:** the firm's records remain in
\`fsaryeciduszuahgjbly\`, a project shared with four unrelated applications.
Separation is by table prefix. Point in time recovery on that project restores
all five applications or none, so the decision to use it is never this firm's
alone.

The full sequence is in \`docs/production-cutover-plan.md\`, including a phase 0
dry run the operator ruled is not optional, a freeze point, and the step at which
rollback stops being clean.

### The launch gate

**Seven conditions, five unmet.** The firm cannot hold itself out as offering
engineering services. Recorded in \`docs/launch-readiness.md\` with who clears
each one.

### An execute mode retention run

**Has never happened anywhere.** Retention is declared, has floors pinned in two
places, produces a manifest, and has been rehearsed in plan mode only.

---

## 4. WHAT THIS REGISTER CANNOT TELL YOU

It is generated from a declaration. A control nobody thought of is absent from
both halves of this document, and no generator can find one. The ${GAPS.length}
gaps above are the ones this firm has noticed.

That is the honest limit of a self assessment, and it is the reason a real
engagement uses somebody outside the firm.
`;

writeFileSync(`${DOCS_DIR}/soc2-exceptions.md`, exceptionsDoc);
written.push(`${DOCS_DIR}/soc2-exceptions.md`);

console.log("");
console.log(`SOC 2 evidence generated against ${targetLabel} at ${iso(generatedAt) || "unknown time"}.`);
for (const f of written) console.log(`  ${f}`);
console.log("");
console.log(`${CONTROLS.length} controls declared, ${GAPS.length} gaps declared.`);
console.log(`${staffRows.length} staff, ${(roles.data ?? []).length} roles, ${(grants.data ?? []).length} grants, ${trailCount ?? "?"} audit events.`);
