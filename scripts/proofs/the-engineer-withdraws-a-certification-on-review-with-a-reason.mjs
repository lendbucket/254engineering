/**
 * WF-017 STEP 6, ROBERT'S RULING OF 2026-10-29 (issue #1 comment 6501552714):
 * "an engineer-only panel on /portal/review to withdraw or restore a
 * technician's certification, with the reason required." And, in the same
 * ruling: no re-sorting or filtering on /portal/review.
 *
 *   node scripts/proofs/the-engineer-withdraws-a-certification-on-review-with-a-reason.mjs
 *
 * What this proves, read from the source because each property is about a path
 * no fixture here can reach without a database:
 *
 *   - revokeCertification and restoreCertification refuse anybody but the
 *     licence holder, and refuse an empty reason, BEFORE anything is written;
 *   - each writes its audit row through writeAuditOrRefuse BEFORE the change,
 *     and stops if that record cannot be written;
 *   - a change that touched no row is recorded as failed and reported, never
 *     returned as done;
 *   - the panel is drawn only when the page's actor holds the licence the
 *     server asks for, and a failed read is said rather than shown as empty;
 *   - the review queue's order is still the reviewQueue read's own order:
 *     rendered with no sort or filter, the page takes no parameter but the
 *     file id, and the new panel sits below everything that was there.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const body = (src, name) => {
  const at = src.indexOf(`export async function ${name}(`);
  const next = src.indexOf("\nexport ", at + 10);
  return at < 0 ? "" : src.slice(at, next < 0 ? undefined : next);
};
/* The position of the first match, or -1. */
const at = (src, re) => {
  const m = re.exec(src);
  return m ? m.index : -1;
};

const field = readFileSync("src/lib/ops-field.ts", "utf8");

for (const [name, what, action] of [
  ["revokeCertification", "Withdrawing a certification", "certification.revoke"],
  ["restoreCertification", "Restoring a certification", "certification.restore"],
]) {
  const fn = strip(body(field, name));
  check(`${name} is found`, fn.length > 0);
  const licence = at(fn, new RegExp(`if \\(!holdsLicence\\(actor, "protocols\\.publish"\\)\\) \\{\\s*return \\{ ok: false, error: licenceRefusal\\("${what}"\\) \\};`));
  const reason = at(fn, /if \(!reason\.trim\(\)\) \{\s*return \{ ok: false, error: "Say why\./);
  const record = at(fn, new RegExp(`await writeAuditOrRefuse\\(\\{\\s*actor,\\s*action: "${action.replace(".", "\\.")}",`));
  const stop = at(fn, /if \(!recorded\.ok\) return recorded;/);
  const update = at(fn, /\.from\("eng_certifications"\)\s*\.update\(/);
  check(`${name}: a non-licence holder is refused first`, licence >= 0 && licence < update, licence < 0 ? "no licence refusal" : "");
  check(`${name}: an empty reason is refused before anything is written`, reason > licence && reason >= 0 && reason < record, reason < 0 ? "no reason check" : "");
  check(`${name}: the audit row "${action}" is written before the change`, record >= 0 && record < update, record < 0 ? "not written through writeAuditOrRefuse" : "");
  check(`${name}: a record that fails stops the change`, stop > record && stop < update);
  check(`${name}: the update says which rows it changed`, /\.select\("id"\);/.test(fn.slice(update)));
  check(
    `${name}: a change that touched no row is recorded as failed and refused`,
    /if \(error \|\| !changed\?\.length\) \{/.test(fn) &&
      new RegExp(`action: "${action.replace(".", "\\.")}_failed"`).test(fn) &&
      /return \{\s*ok: false,/.test(fn.slice(at(fn, /if \(error \|\| !changed\?\.length\) \{/))),
  );
  check(`${name}: no audit row is written through the swallowing writer after a success`, !new RegExp(`writeAudit\\(\\{\\s*actor,\\s*action: "${action.replace(".", "\\.")}",`).test(fn));
}

const route = strip(readFileSync("src/app/api/portal/onboarding/route.ts", "utf8"));
const restoreBranch = route.slice(route.indexOf('if (action === "restore_certification")'), route.indexOf('return bad("Unknown action.")'));
check("the route passes the reason to a restoration", /restoreCertification\([\s\S]*?String\(body\?\.reason \?\? ""\),\s*context,/.test(restoreBranch));

const page = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
const live = strip(page);
check(
  "the panel is decided by the same licence test the server applies",
  /const mayDecideStanding = holdsLicence\(actor, "protocols\.publish"\);/.test(live),
);
check("and its read runs only for the licence holder", /const standing = mayDecideStanding \? await timed\("standing", certificationStanding\(\)\) : null;/.test(live));
check("so nobody else is drawn the panel", /\{standing === null \? null : !standing\.ok \? \(/.test(live) && (live.match(/<CertificationStandingPanel/g) ?? []).length === 1);
check("a failed read is said, never an empty list", /Technicians&apos; certifications could not be read[\s\S]{0,80}\{standing\.error\}/.test(live));

const queueRender = live.slice(at(live, /\{queue === null \? \(/));
check("the review queue is rendered in the order its read returns", /\) : \(\s*<ul[^>]*>\s*\{queue\.map\(/.test(queueRender.slice(0, 1200)) || /\{queue\.map\(\(f\) => \{/.test(queueRender.slice(0, 1600)));
check("with no sort or filter applied to it on the page", !/queue\s*\.\s*(sort|filter|toSorted|slice)\(/.test(live) && !/\[\.\.\.queue\]/.test(live));
check("the page takes no parameter but the file id", /searchParams: Promise<\{ id\?: string \}>;/.test(live));
const voidAt = at(live, /<VoidSealPanel/);
const panelAt = at(live, /<CertificationStandingPanel/);
check("and the panel sits below everything that was there", voidAt >= 0 && panelAt > voidAt);

const engineer = readFileSync("src/lib/ops-engineer.ts", "utf8");
check(
  "the queue's own order is unchanged: oldest evidence first, then by id",
  /\.order\("evidence_submitted_at", \{ ascending: true, nullsFirst: false \}\)\s*\.order\("id", \{ ascending: true \}\)/.test(body(engineer, "reviewQueue")),
);

const reader = strip(body(readFileSync("src/lib/certification-record.ts", "utf8"), "certificationStanding"));
check("the panel's read is every certified or withdrawn record, in full", /readEvery</.test(reader) && /\.in\("status", \["certified", "revoked"\]\)/.test(reader));
check("for active technicians only", /\.eq\("role", "field_tech"\)\s*\.eq\("status", "active"\)/.test(reader));

const panel = readFileSync("src/app/portal/(app)/review/CertificationStandingPanel.tsx", "utf8");
check("the panel asks for a reason before it sends anything", /if \(!reason\.trim\(\)\) \{[\s\S]{0,200}return;\s*\}[\s\S]*?await fetch\(/.test(panel));
check("and sends to the one path that already does this", (panel.match(/"\/api\/portal\/onboarding"/g) ?? []).length === 1 && /"revoke_certification" : "restore_certification"/.test(panel));

console.log(
  wrong === 0
    ? "PASS: the engineer withdraws or restores a certification on /portal/review, with a reason, recorded first, and the queue's order untouched."
    : `FAIL: ${wrong} check(s) above.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
