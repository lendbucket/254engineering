/**
 * THE FRANCHISE SEED IS WHAT THE BROWSER AUDITS MEASURE. Robert's order of
 * 2026-11-12, item 1: one demonstration franchisee on development, "so the
 * browser audits finally open the onboarding panel, the agreement and
 * certificate forms, the statement panel and its CSV".
 *
 *   node scripts/proofs/the-franchise-seed-is-measured.mjs
 *
 *   A  seededFranchisee says why a seed is not whole, and names the script:
 *      no franchisee, a failed read, and each missing piece, against a fake
 *      client, so every branch runs without a database.
 *   B  franchiseSeedScreens is the two seeded views and nothing when the seed
 *      is not whole: the administrator's record by its query string, and the
 *      owner's screen opened by the owner role.
 *   C  native-audit and contrast-audit read the seed, attach an owner, add both
 *      views, and FAIL when it is not whole; native-audit reads the statement
 *      CSV's own text, not only its status.
 *   D  the probe teardown deletes a probe's membership before its profile, by
 *      the probe ids alone, so the seeded owner, who is not a probe, is never
 *      its subject.
 *   E  the seed is development only, made through the product's writers, and
 *      reads as a demonstration.
 *
 * Pure and static: it makes nothing and reads no database. The seed's presence
 * on development is asserted where it is used, in the two audits above.
 */
import { readFileSync } from "node:fs";
import { SEED_FRANCHISEE, SEED_SCRIPT, franchiseSeedScreens, seededFranchisee } from "../lib/franchise-seed.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const read = (p) => readFileSync(p, "utf8");

/* ------------------------------------------------------------ a fake client */
function fakeDb(world) {
  const table = (name) => {
    const q = {
      filters: [],
      select() { return q; },
      eq(col, v) { q.filters.push([col, v]); return q; },
      is() { return q; },
      async maybeSingle() {
        if (name !== "eng_franchisees") return { data: null, error: null };
        if (world.readError) return { data: null, error: { message: world.readError } };
        return { data: world.franchisee ?? null, error: null };
      },
      then(resolve) {
        const rows = { eng_franchisee_territories: world.territories, eng_franchisee_members: world.members, eng_franchisee_certificates: world.certificates }[name] ?? [];
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return q;
  };
  return { from: table };
}
const whole = {
  franchisee: { id: "f1", status: "onboarding", agreement_signed_on: "2026-11-02" },
  territories: [{ territory_id: "t1" }],
  members: [{ profile_id: "p1" }],
  certificates: [{ kind: "general_liability" }, { kind: "auto" }, { kind: "workers_compensation" }],
};

console.log("A  seededFranchisee says why");
{
  const ok = await seededFranchisee(fakeDb(whole));
  check("A: a whole seed is ok, with its id", ok.ok === true && ok.id === "f1", JSON.stringify(ok));
  const none = await seededFranchisee(fakeDb({}));
  check("A: no franchisee is not ok, and names the script", !none.ok && none.why.includes(SEED_SCRIPT), none.why);
  const failed = await seededFranchisee(fakeDb({ readError: "boom" }));
  check("A: a failed read is not ok, and says so", !failed.ok && failed.why.includes("boom"), failed.why);
  const noClient = await seededFranchisee(null);
  check("A: no client is not ok", !noClient.ok);
  for (const [key, label] of [["territories", "a territory"], ["members", "a member"]]) {
    const r = await seededFranchisee(fakeDb({ ...whole, [key]: [] }));
    check(`A: without ${label} it is not ok, and names it`, !r.ok && r.why.includes(label) && r.why.includes(SEED_SCRIPT), r.why);
  }
  const noAgreement = await seededFranchisee(fakeDb({ ...whole, franchisee: { ...whole.franchisee, agreement_signed_on: null } }));
  check("A: without an agreement it is not ok, and names it", !noAgreement.ok && noAgreement.why.includes("an agreement"), noAgreement.why);
  const fewCerts = await seededFranchisee(fakeDb({ ...whole, certificates: whole.certificates.slice(0, 2) }));
  check("A: with two certificates of three it is not ok, and counts them", !fewCerts.ok && fewCerts.why.includes("has 2"), fewCerts.why);
}

console.log("B  franchiseSeedScreens");
{
  const screens = franchiseSeedScreens({ ok: true, id: "f1" });
  check("B: two views", screens.length === 2, screens.map((s) => s.path).join(", "));
  check("B: the administrator's record of the seed, by its query string", screens.some((s) => s.path === "/portal/franchisees?id=f1" && s.role === "admin"));
  check("B: the owner's own screen, opened by the owner role", screens.some((s) => s.path === "/portal/franchise" && s.role === "franchisee_owner"));
  check("B: nothing when the seed is not whole", franchiseSeedScreens({ ok: false, why: "x" }).length === 0 && franchiseSeedScreens(null).length === 0);
}

console.log("C  the two browser audits measure it");
for (const file of ["scripts/native-audit.mjs", "scripts/contrast-audit.mjs"]) {
  const src = read(file);
  check(`C: ${file} imports the seed's three readers`, /import \{ attachFranchiseeOwner, franchiseSeedScreens, seededFranchisee \} from "\.\/lib\/franchise-seed\.mjs";/.test(src));
  check(`C: ${file} reads the seed and attaches an owner`, /await seededFranchisee\(/.test(src) && /await attachFranchiseeOwner\(/.test(src));
  check(`C: ${file} adds the seeded views to what it measures`, /franchiseSeedScreens\((seed|franchiseSeed)\)/.test(src));
}
{
  const native = read("scripts/native-audit.mjs");
  check("C: native-audit records a seed that is not whole as a failure, naming why", /rec\("the franchise seed is whole[^"]*", seed\.ok, seed\.ok \? seed\.id : seed\.why\)/.test(native));
  check("C: native-audit asks for the statement CSV with the administrator's session", /\/api\/portal\/franchisees\?format=csv&statement=\$\{franchiseSeed\.id\}/.test(native));
  check("C: and reads the file, not only the status", /body\.includes\("Royalty and fee statement"\)/.test(native) && /type\.includes\("text\/csv"\)/.test(native));
  const contrast = read("scripts/contrast-audit.mjs");
  check("C: contrast-audit counts a seed that is not whole as a page error", /if \(!seed\.ok\) pageErrors\+\+;/.test(contrast));
  check("C: and walks the seeded templates with the rest", /\.\.\.PORTAL_TEMPLATES, \.\.\.SEEDED_TEMPLATES\]/.test(contrast));
}

console.log("D  the teardown takes a probe's membership, and only a probe's");
{
  const probe = read("scripts/lib/portal-probe.mjs");
  const at = probe.indexOf('from("eng_franchisee_members").delete().in("profile_id", [...ids])');
  const profiles = probe.indexOf('await d.from("eng_profiles").delete().eq("id", id);');
  check("D: destroyProbes deletes eng_franchisee_members by the probe ids", at > 0);
  check("D: before it deletes the probe profiles", at > 0 && profiles > at, `membership at ${at}, profiles at ${profiles}`);
  check("D: and a refusal is said, not swallowed", /refusals\.push\(`eng_franchisee_members: /.test(probe));
  check("D: the seeded owner is not on the probe domain, so it is never in those ids", !SEED_FRANCHISEE.owner.email.endsWith("@audit-probe.invalid") && /^demo\.[^@]+@example\.com$/.test(SEED_FRANCHISEE.owner.email));
}

console.log("E  the seed itself");
{
  const seed = read("scripts/seed-franchise-demo.mjs");
  check("E: development only, refused before a client exists", /auditClient\("seed-franchise-demo", \{ neverProduction: true \}\)/.test(seed));
  for (const writer of ["createFranchisee", "saveOffice", "createTerritory", "setTerritoryCounties", "setFranchiseeTerritory", "setFranchiseeMember", "recordAgreement", "recordCertificate"]) {
    check(`E: made through the product's ${writer}`, new RegExp(`await ${writer}\\(\\s*actor,`).test(seed));
  }
  check("E: it writes no franchise row by hand", !/from\("eng_franchisee(s|_territories|_members|_certificates)"\)\.(insert|update|upsert)\(/.test(seed));
  check("E: the recorder is the demonstration administrator, not the operator", /const RECORDER_EMAIL = "demo\.admin@example\.com";/.test(seed));
  check("E: the owner's password is random and never printed", /password: randomBytes\(24\)\.toString\("base64url"\)/.test(seed) && !/console\.log\([^)]*password/i.test(seed));
  check("E: everything reads as a demonstration", SEED_FRANCHISEE.legalName.startsWith("Demo ") && SEED_FRANCHISEE.office.street.includes("Demo") && /555/.test(SEED_FRANCHISEE.office.phone) && SEED_FRANCHISEE.certificates.every((c) => c.policyNumber.startsWith("DEMO-")) && SEED_FRANCHISEE.carrier.includes("DEMONSTRATION"));
  check("E: the three certificates are Robert's answer 12's three coverages", SEED_FRANCHISEE.certificates.map((c) => c.kind).join(",") === "general_liability,auto,workers_compensation");
}

console.log(wrong === 0 ? "\nAll checks correct. The franchise seed is whole or named, and both browser audits measure it." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
