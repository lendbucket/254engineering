/**
 * THE DECLARED CONTROL INVENTORY, AND THE GAPS BESIDE IT.
 *
 * Phase 12 Section 6. This is the same declared inventory idiom as
 * `scripts/lib/surfaces.mjs` and `supabase/applied.mjs`, applied to the question
 * an outside auditor asks: what controls exist, what enforces each one, where is
 * the evidence, and could somebody who will not read the source verify it.
 *
 * WHAT THIS FILE IS NOT
 * ---------------------
 * It is not a claim that this firm is SOC 2 compliant, and nothing generated
 * from it may read that way. Compliance is an auditor's opinion after an
 * observation window. This firm has no customers, one engineer, no employees,
 * and no observation window, and `GAPS` below says so in the first entry rather
 * than in a footnote.
 *
 * READINESS is a different and answerable question: if an auditor asked for
 * evidence tomorrow, what could be produced today. That is what this declares.
 *
 * WHY A DECLARATION RATHER THAN A DOCUMENT
 * ----------------------------------------
 * A hand written readiness document is prose about a platform, and prose about a
 * platform stops being true the first time the platform changes. Everything in
 * `docs/soc2-readiness.md` and `docs/soc2-exceptions.md` is generated from this
 * file plus LIVE READS, by `scripts/soc2-evidence.mjs`, and
 * `scripts/soc2-audit.mjs` fails the board when a declared regenerate command
 * does not run or when a generated document is stale.
 *
 * THE HONEST HALF IS THE LOAD BEARING HALF. A readiness report that overstates
 * is the exact defect class this whole build hunts: a claim nothing supports.
 * `GAPS` is longer than `CONTROLS` on purpose and is printed first in the
 * report.
 */

/**
 * The five Trust Services Criteria.
 *
 * Security is the only one every SOC 2 engagement includes; the other four are
 * elected. They are all declared here because the firm has not elected a scope
 * and pretending otherwise would be the first overstatement.
 */
export const CRITERIA = {
  security: "Security. The system is protected against unauthorised access.",
  availability: "Availability. The system is available for operation and use.",
  integrity: "Processing integrity. Processing is complete, valid, accurate, timely and authorised.",
  confidentiality: "Confidentiality. Information designated confidential is protected.",
  privacy: "Privacy. Personal information is collected, used, retained and disposed of as committed.",
};

/**
 * A control that EXISTS. Each entry answers the four questions an auditor asks,
 * and `verifiable` is the one that matters most: it is the difference between
 * evidence and an assertion.
 *
 *   enforcedBy   the code or constraint that makes it true, not the policy
 *   evidence     where a reader looks, named precisely enough to open
 *   machine      whether the evidence is machine readable
 *   verifiable   whether an outsider could check it WITHOUT reading the source
 *   regenerate   the command that produces the evidence, or null where it is a
 *                standing artefact rather than a generated one
 */
export const CONTROLS = [
  // ------------------------------------------------------------------ security
  {
    id: "authn-principals",
    criterion: "security",
    control: "Three separate principals authenticate through three separate paths.",
    enforcedBy:
      "src/lib/ops-auth.ts for staff, src/lib/customer-auth.ts, src/lib/partner-auth.ts. Each mints its own cookie and none can read another's session.",
    evidence: "eng_profiles, eng_customer_users, eng_partner_users",
    machine: true,
    verifiable: false,
    regenerate: null,
    note: "An outsider cannot verify separation without reading the code. What they CAN verify is the access review, which lists every principal of every kind.",
  },
  {
    id: "authz-as-data",
    criterion: "security",
    control: "Every permission is a row, and the matrix is generated from one declaration.",
    enforcedBy:
      "DEFAULT_ROLES in src/lib/ops-authz.ts, seeded by 0018 through scripts/emit-role-seed.mjs. roles-audit derives the expected roles, landing paths, system flags and grants from the same declaration and compares them to the migration.",
    evidence: "eng_roles, eng_role_grants",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "This is the single strongest control the firm has, because the evidence is rows rather than a document.",
  },
  {
    id: "authz-compile-proof",
    criterion: "security",
    control: "A licensed action cannot be granted to a role. Not refused at runtime: unrepresentable.",
    enforcedBy: "scripts/proofs/licensed-actions-are-unrepresentable.ts, which fails to COMPILE if it becomes possible.",
    evidence: "The proof file and its place in the board.",
    machine: true,
    verifiable: false,
    regenerate: "npx tsc --noEmit",
    note: "A type level guarantee is stronger than a test and harder to show an auditor, because the evidence of it working is that nothing happens.",
  },
  {
    id: "mfa",
    criterion: "security",
    control: "A second factor, TOTP, with recovery codes, and a per role requirement.",
    enforcedBy: "src/lib/ops-mfa.ts and src/lib/totp.ts, pinned to 6 digits and 30 seconds by scripts/proofs/totp-matches-the-rfc.mjs.",
    evidence: "eng_mfa_enrolments, eng_mfa_recovery_codes, eng_roles.mfa_requirement",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "The requirement is per role and 0025 made it optional by default for admin and engineer. That is a GAP and is listed as one.",
  },
  {
    id: "perimeter",
    criterion: "security",
    control: "Every portal route is behind a session, asserted twice.",
    enforcedBy: "src/proxy.ts and the portal root layout, deliberately duplicated: a matcher is one typo from leaving a route uncovered.",
    evidence: "scripts/security-audit.mjs, which enumerates every portal page on disk and fails when one is not in the perimeter list.",
    machine: true,
    verifiable: false,
    regenerate: "npx tsx scripts/security-audit.mjs",
    note: null,
  },
  {
    id: "closed-door",
    criterion: "security",
    control: "Row level security on every table, and zero policies on every table.",
    enforcedBy: "Every migration. The service role is the only way in, so PostgREST exposes nothing to an anonymous caller.",
    evidence: "pg_class.relrowsecurity and pg_policy, read live.",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "Zero policies is the point. A table with RLS on and a permissive policy is a table that is open.",
  },
  {
    id: "db-guard",
    criterion: "security",
    control: "A script cannot reach production by accident, and a preview cannot point at it.",
    enforcedBy:
      "scripts/lib/db-target.mjs owns client construction for every script; src/lib/db-guard.ts refuses a preview deployment pointed at the production ref.",
    evidence: "scripts/db-guard-audit.mjs, 84 checks, first in the suite.",
    machine: true,
    verifiable: false,
    regenerate: "npx tsx scripts/db-guard-audit.mjs",
    note: "Written after audits had already filled production tables with test rows while reporting green.",
  },

  // -------------------------------------------------------------- availability
  {
    id: "queue",
    criterion: "availability",
    control: "Durable background work with a lease, bounded attempts, and a dead letter state.",
    enforcedBy: "eng_claim_jobs, which claims FOR UPDATE SKIP LOCKED and stamps a lease from the DATABASE clock.",
    evidence: "eng_jobs, including effect_mode since 0038.",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: null,
  },
  {
    id: "observability",
    criterion: "availability",
    control: "Cron runs, faults and alert cooldowns are recorded, and a stalled cron reads as stalled.",
    enforcedBy: "src/lib/ops-observability.ts and the /portal/status screen, which carries a verdict per row rather than a timestamp.",
    evidence: "eng_cron_runs, eng_error_events, eng_alert_state",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: null,
  },
  {
    id: "pitr",
    criterion: "availability",
    control: "Point in time recovery on the production project.",
    enforcedBy: "The provider. Stated by the operator with a date in src/config/launch-readiness.ts.",
    evidence: "docs/disaster-recovery.md section 2a, with its limit stated.",
    machine: false,
    verifiable: true,
    regenerate: null,
    note: "It restores all five applications on the shared project or none, and it has never been exercised. Both are gaps.",
  },

  // -------------------------------------------------------- processing integrity
  {
    id: "append-only",
    criterion: "integrity",
    control: "The regulatory and financial record cannot be edited or deleted, at the database.",
    enforcedBy: "Trigger functions eng_forbid_mutation, eng_forbid_record_delete, eng_forbid_payment_delete, eng_forbid_sealed_work_delete, eng_freeze_partner_entry and their neighbours.",
    evidence: "pg_trigger, read live. The count of guarded tables is in the report.",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "Five tables are deliberately NOT append only and are named: they are telemetry about the machine rather than a record anybody could be asked to produce.",
  },
  {
    id: "audit-trail",
    criterion: "integrity",
    control: "Who did what, when, kept forever.",
    enforcedBy: "eng_audit_events carries eng_forbid_mutation, so UPDATE and DELETE are refused at the database rather than by convention.",
    evidence: "eng_audit_events",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "This is the control that most often fails an audit elsewhere, because a trail an administrator can edit is not a trail.",
  },
  {
    id: "change-record",
    criterion: "integrity",
    control: "Every schema change is declared, fingerprinted twice, and says which databases have it.",
    enforcedBy:
      "supabase/applied.mjs, read by schema-ledger-audit, which fails when a migration is reachable from main and the ledger says production lacks it.",
    evidence: "supabase/applied.mjs and the generated change record.",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "The behaviour fingerprint sees what the shape one cannot: foreign key delete actions, check constraint bodies, trigger functions, index predicates, RLS, and seeded rows.",
  },
  {
    id: "responsible-charge",
    criterion: "integrity",
    control: "Which Professional Engineer was in responsible charge of what, append only, with the engineer protected by a foreign key.",
    enforcedBy:
      "eng_responsible_charge_log with eng_forbid_mutation, and since 0039 eng_responsible_charge_log_engineer_id_fkey ON DELETE RESTRICT.",
    evidence: "eng_responsible_charge_log",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "A PE cannot be removed while entries name them. That constraint did not exist on either live database until 2026-09-11.",
  },
  {
    id: "the-board",
    criterion: "integrity",
    control: "Forty eight audits, each verified by injecting a violation and watching it fail.",
    enforcedBy: "npm run audit, which builds, starts its own server, and prints THE SUITE DID NOT RUN TO COMPLETION rather than a list of failures when it could not measure.",
    evidence: "The suite output.",
    machine: true,
    verifiable: false,
    regenerate: "npm run audit",
    note: "An audit that has never failed has never been tested. That rule is why this is a control rather than a test suite.",
  },
  {
    id: "export-manifests",
    criterion: "integrity",
    control: "Every export states what it covers, what it excludes, and how many demonstration rows it carries.",
    enforcedBy: "src/lib/csv.ts preambles and the coverage disclosure in src/lib/ops-reports.ts.",
    evidence: "Any generated export, including the two this section produces.",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "Written after an export shipped with a manifest reading Real records only above eighteen demonstration rows.",
  },

  // ------------------------------------------------------------ confidentiality
  {
    id: "secrets-not-in-tree",
    criterion: "confidentiality",
    control: "The production service role key is not in the working tree.",
    enforcedBy: "Convention plus scripts/placeholder-audit.mjs and the credential inventory this section adds.",
    evidence: "docs/soc2-readiness.md credential inventory, which names every secret and NEVER its value.",
    machine: true,
    verifiable: false,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "Enforced by a person today. That is weaker than a scanner and is listed as a gap.",
  },
  {
    id: "fault-scrubbing",
    criterion: "confidentiality",
    control: "A recorded fault does not carry a customer's details.",
    enforcedBy: "src/lib/observability-scrub.ts, asserted by observability-audit.",
    evidence: "eng_error_events",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/observability-audit.mjs",
    note: null,
  },

  // -------------------------------------------------------------------- privacy
  {
    id: "deletion-requests",
    criterion: "privacy",
    control: "A request to be forgotten is a record, not an action somebody remembers taking.",
    enforcedBy: "eng_deletion_requests with eng_forbid_record_delete, added by 0036.",
    evidence: "eng_deletion_requests",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "The request survives the deletion it asks for, which is the only way to show it was honoured.",
  },
  {
    id: "suppressions",
    criterion: "privacy",
    control: "Do not contact is a list the platform reads before it sends, and it refuses deletes.",
    enforcedBy: "eng_marketing_suppressions with eng_forbid_record_delete, and check constraints from 0034 and 0035 that make a mistyped or void suppression unrepresentable.",
    evidence: "eng_marketing_suppressions",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: null,
  },
  {
    id: "retention",
    criterion: "privacy",
    control: "Retention is a declaration with floors, a plan mode, and a manifest of what a run intends to delete.",
    enforcedBy: "src/lib/retention-policy.ts, pinned by retention-audit: a 30 day floor and exactly two deletable tables.",
    evidence: "eng_retention_runs, which refuses deletes.",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/soc2-evidence.mjs",
    note: "An execute run has never happened anywhere. The control is declared and rehearsed, not exercised.",
  },
  {
    id: "compliance-gate",
    criterion: "privacy",
    control: "The firm cannot hold itself out as offering engineering services until seven named conditions are true.",
    enforcedBy: "src/lib/launch.ts, asserted by compliance-audit and launch-audit.",
    evidence: "docs/launch-readiness.md and /portal/launch.",
    machine: true,
    verifiable: true,
    regenerate: "npx tsx scripts/compliance-audit.mjs",
    note: "Regulatory rather than SOC 2, and included because an auditor reading a Texas engineering firm's controls will ask about licensure.",
  },
];

/**
 * WHAT THE FIRM CANNOT PRODUCE, RANKED BY WHAT AN AUDITOR ASKS FOR FIRST.
 *
 * Ranked by the order the request actually arrives in an engagement, not by
 * severity, because the first three are what a readiness call opens with and
 * "we do not have that" three times in five minutes is the outcome this section
 * exists to prevent being a surprise.
 *
 * `severity` is this session's judgement and is labelled as such.
 * `consequence` is what actually follows, not a restatement of the gap.
 */
export const GAPS = [
  {
    id: "no-observation-window",
    rank: 1,
    criterion: "security",
    gap: "There is no observation window, and there are no customers, no employees and one engineer.",
    severity: "fundamental",
    consequence:
      "A SOC 2 Type II report describes controls operating over a period, typically three to twelve months. Nothing here has operated over a period because the firm has not traded. A Type I, which describes design at a point in time, is the only report this firm could be a candidate for, and only once it has a customer and a signed engagement.",
    ruling: null,
  },
  {
    id: "no-access-review",
    rank: 2,
    criterion: "security",
    gap: "No periodic access review has ever been performed or attested.",
    severity: "high",
    consequence:
      "This is the first artefact requested in almost every engagement. The platform holds every fact needed to produce it and has never been asked to.",
    ruling:
      "PARTLY BUILT, AND THE REST NEEDS A RULING. The report is generated and states its own findings, and it says Attested by NOBODY at the top rather than in a footnote. What is NOT built is the recurring half: a job that produces it on a schedule and raises a task to attest it. " +
      "The blocker is real rather than effort: createTask requires an Actor, a scheduled job has none, and no system actor exists in this platform. Inventing one is a new door in the authorisation model, because an actor that can raise a task is an actor, and deciding what else it may do is not a decision to make unattended at two in the morning. " +
      "THE RULING I WOULD MAKE: the attestation is an APPEND ONLY AUDIT EVENT rather than a new table, because eng_audit_events already refuses UPDATE and DELETE at the database and an attestation that can be edited is not one. The system actor is a named row in eng_profiles with the narrowest possible role, holding tasks.use and nothing else, so that what the platform can do for itself is visible in the same access review as everybody else rather than being a special case in code.",
  },
  {
    id: "one-person-holds-everything",
    rank: 3,
    criterion: "security",
    gap: "One person holds every credential, approves every change, and operates every system.",
    severity: "high",
    consequence:
      "There is no segregation of duties and there cannot be at this headcount. Every compensating control the firm has is technical rather than organisational: the append only tables, the ledger, the board. An auditor will accept those as compensating controls only if the report states the limitation first rather than implying separation.",
    ruling: "State it plainly at the top of the readiness report. Do not describe the operator and the firm as separate approvers.",
  },
  {
    id: "no-change-approval",
    rank: 4,
    criterion: "integrity",
    gap: "No change approval separate from the person making the change.",
    severity: "high",
    consequence:
      "Every commit is authored and merged by the same person on their own word. The ledger and the board are what stand in for a second pair of eyes, and they are genuinely strong, but neither is an approver.",
    ruling: null,
  },
  {
    id: "shared-production",
    rank: 5,
    criterion: "confidentiality",
    gap: "Production is a database project shared with four unrelated applications.",
    severity: "high",
    consequence:
      "The firm's records sit in a project it does not exclusively control. Separation is by table prefix rather than by boundary, the recovery window restores all five applications or none, and an operator of any of the other four has the same project level access. The cutover to a dedicated project is planned, sequenced, and deferred by operator ruling.",
    ruling: "Named in the exceptions register with the deferral and its recorded consequence, which is what the ruling of 2026-09-10 asked for.",
  },
  {
    id: "restore-never-exercised",
    rank: 6,
    criterion: "availability",
    gap: "The restore path has never been exercised.",
    severity: "high",
    consequence: "An untested restore is a belief. Point in time recovery is enabled and nobody has ever used it, so the recovery time objective is unknown rather than long.",
    ruling: null,
  },
  {
    id: "no-vendor-inventory",
    rank: 7,
    criterion: "security",
    gap: "No vendor inventory and no vendor risk assessment.",
    severity: "medium",
    consequence:
      "The firm depends on at least Supabase, Vercel, Stripe, a mail provider and GitHub, and has assessed none of them, holds no SOC 2 report from any of them, and has no data processing agreement with any of them.",
    ruling: "The credential inventory Section 2 builds names every vendor the platform reads a secret from, which is the honest first half of a vendor inventory and is not one.",
  },
  {
    id: "no-offboarding",
    rank: 8,
    criterion: "security",
    gap: "No offboarding procedure.",
    severity: "medium",
    consequence: "Nobody has ever left, so nothing has failed. The first departure would be improvised, and the one thing that must not be improvised is the responsible charge record.",
    ruling: "Section 2 writes the sequence keyed to what the platform can actually do, and says which steps it cannot perform.",
  },
  {
    id: "no-system-actor",
    rank: 9,
    criterion: "security",
    gap: "The platform cannot raise work for itself, because no system actor exists.",
    severity: "medium",
    consequence:
      "Every write in this platform is attributed to a person, which is a genuine strength and is why the audit trail is worth anything. The cost is that nothing scheduled can create a task, so a recurring control like an access review can produce its artefact and cannot ask anybody to look at it. Found while building the access review on 2026-09-12.",
    ruling:
      "Recorded rather than decided. A system actor is a new door in the authorisation model and deserves the operator's word on what it may hold. The narrowest version that works is a named eng_profiles row with tasks.use and nothing else, which keeps it visible in the access review rather than special cased in code.",
  },
  {
    id: "no-incident-record",
    rank: 10,
    criterion: "availability",
    gap: "No incident response plan and no incident record.",
    severity: "medium",
    consequence: "Faults are recorded in eng_error_events. An INCIDENT, meaning something that affected a person and required a decision, has no shape and no record.",
    ruling: "Section 2 adds the table, empty, with the shape an incident takes. Empty and honest beats absent.",
  },
  {
    id: "mfa-optional",
    rank: 11,
    criterion: "security",
    gap: "MFA is optional by default for the administrator and engineer roles.",
    severity: "medium",
    consequence:
      "0025 made it optional deliberately, so that a single operator could not lock themselves out of a platform nobody else can administer. That reasoning is sound and it is still a finding: the two roles that can do the most are the two not required to hold a second factor.",
    ruling: "Record it. Changing it needs a second administrator to exist first, which is the same gap as one person holding everything.",
  },
  {
    id: "no-board-history",
    rank: 12,
    criterion: "integrity",
    gap: "No history of board runs. The suite reports a verdict and keeps none.",
    severity: "medium",
    consequence:
      "The board proves the controls work today and cannot show they worked in March. For a Type II that history IS the evidence, and it does not exist. A run's output is printed and lost.",
    ruling: "Say so and start recording it. The change record names this as the half it cannot produce.",
  },
  {
    id: "no-risk-assessment",
    rank: 13,
    criterion: "security",
    gap: "No formal risk assessment.",
    severity: "medium",
    consequence: "Risks have been reasoned about extensively and recorded in BACKLOG and in migration headers. None of that is a risk register with likelihood, impact and an owner.",
    ruling: null,
  },
  {
    id: "no-training",
    rank: 14,
    criterion: "security",
    gap: "No security awareness training and no background checks.",
    severity: "low",
    consequence: "There is one person and no employees, so there is nobody to train or screen. It becomes a real gap on the first hire rather than now.",
    ruling: null,
  },
  {
    id: "no-pentest",
    rank: 15,
    criterion: "security",
    gap: "No penetration test and no vulnerability scanning beyond dependency defaults.",
    severity: "medium",
    consequence: "security-audit tests the perimeter this firm thought to test. Nobody adversarial has looked.",
    ruling: null,
  },
  {
    id: "no-dpa",
    rank: 16,
    criterion: "privacy",
    gap: "No customer contracts, no data processing agreements, and no stated data residency.",
    severity: "medium",
    consequence: "The privacy policy states commitments the firm has made to nobody in particular, because there is no customer to have made them to.",
    ruling: null,
  },
  {
    id: "no-encryption-attestation",
    rank: 17,
    criterion: "confidentiality",
    gap: "Encryption at rest and in transit is the provider's, and the firm holds no attestation of it.",
    severity: "low",
    consequence:
      "One exception, and it is the firm's own: MFA secrets are encrypted by the platform before they are stored, with a key held outside the database. Everything else relies on the provider's defaults, which is normal and is still unevidenced here.",
    ruling: null,
  },
  {
    id: "no-secret-scanning",
    rank: 18,
    criterion: "confidentiality",
    gap: "No automated secret scanning on the repository.",
    severity: "medium",
    consequence: "That the production key is not in the tree is enforced by a person remembering. The audit this section adds proves no secret VALUE is in the files this section created, which is a narrow guarantee and is not secret scanning.",
    ruling: null,
  },
  {
    id: "no-log-review",
    rank: 19,
    criterion: "security",
    gap: "Nobody reviews the audit trail. It is written and never read.",
    severity: "medium",
    consequence:
      "12,000 audit events on development and hundreds on production, and no procedure that says who looks at them, how often, or what they would be looking for. A trail nobody reads detects nothing.",
    ruling: null,
  },
  {
    id: "no-backup-offsite",
    rank: 20,
    criterion: "availability",
    gap: "Nothing this firm owns is written outside the provider.",
    severity: "high",
    consequence: "If the provider is the problem, there is no path. Point in time recovery is a property of the same project that would be gone.",
    ruling: null,
  },
  {
    id: "no-uptime-monitoring",
    rank: 21,
    criterion: "availability",
    gap: "No external uptime monitoring and no stated availability commitment.",
    severity: "low",
    consequence: "The platform records its own faults. Nothing outside it would notice the whole thing being down, and the firm has committed to no availability target, so there is nothing to measure against.",
    ruling: null,
  },
];

/** Every distinct regenerate command, deduplicated, for the evidence index. */
export function regenerateCommands() {
  return [...new Set(CONTROLS.map((c) => c.regenerate).filter(Boolean))].sort();
}
