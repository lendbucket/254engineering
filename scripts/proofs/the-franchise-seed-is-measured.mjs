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
import { SEED_FRANCHISEE, SEED_ONBOARDING, SEED_SCRIPT, franchiseSeedScreens, seededFranchisee } from "../lib/franchise-seed.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const read = (p) => readFileSync(p, "utf8");

/* ------------------------------------------------------------ a fake client */
/* Two franchisees, told apart by legal name; each one's rows by franchisee_id ("f1" the first, "f2" the second). */
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
        const legal = q.filters.find(([c]) => c === "legal_name")?.[1];
        return { data: (legal === SEED_ONBOARDING.legalName ? world.second : world.franchisee) ?? null, error: null };
      },
      then(resolve) {
        const of = q.filters.find(([c]) => c === "franchisee_id")?.[1];
        const w = of === "f2" ? world.secondRows ?? {} : world;
        const rows = { eng_franchisee_territories: w.territories, eng_franchisee_members: w.members, eng_franchisee_certificates: w.certificates }[name] ?? [];
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
  second: { id: "f2", status: "onboarding", agreement_signed_on: null },
  secondRows: { territories: [], members: [], certificates: [] },
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

  /* The second seed (Robert's answer 1 of 2026-11-12): present, and holding nothing. */
  check("A: a whole seed names the second franchisee's id too", ok.ok === true && ok.onboardingId === "f2", JSON.stringify(ok));
  const noSecond = await seededFranchisee(fakeDb({ ...whole, second: null }));
  check("A: without the second franchisee it is not ok, and names the script", !noSecond.ok && noSecond.why.includes(SEED_ONBOARDING.legalName) && noSecond.why.includes(SEED_SCRIPT), noSecond.why);
  for (const [key, row, label] of [["territories", { territory_id: "t9" }, "a territory"], ["members", { profile_id: "p9" }, "a member"], ["certificates", { kind: "auto" }, "a certificate"]]) {
    const r = await seededFranchisee(fakeDb({ ...whole, secondRows: { ...whole.secondRows, [key]: [row] } }));
    check(`A: a second franchisee that gained ${label} is not ok, and names it`, !r.ok && r.why.includes(label) && r.why.includes("must hold nothing"), r.why);
  }
  const signed = await seededFranchisee(fakeDb({ ...whole, second: { ...whole.second, agreement_signed_on: "2026-11-12" } }));
  check("A: a second franchisee that gained an agreement is not ok, and names it", !signed.ok && signed.why.includes("an agreement"), signed.why);
}

console.log("B  franchiseSeedScreens");
{
  const screens = franchiseSeedScreens({ ok: true, id: "f1", onboardingId: "f2" });
  check("B: three views", screens.length === 3, screens.map((s) => s.path).join(", "));
  check("B: the administrator's record of the second seed, whose agreement form is open", screens.some((s) => s.path === "/portal/franchisees?id=f2" && s.role === "admin"));
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

  /* mobile-overflow-audit and v10-layout-audit (Robert's overnight orders of 2026-11-13, item 2b). */
  const overflow = read("scripts/mobile-overflow-audit.mjs");
  check("C: mobile-overflow-audit reads the seed and fails when it is not whole", /franchiseSeed = await seededFranchisee\(/.test(overflow) && /ok: franchiseSeed\.ok,/.test(overflow));
  check("C: it signs in an owner on its own probe domain and makes it a member of the seed", /ownerProbe = await createProbe\("franchisee_owner"\)/.test(overflow) && /\.from\("eng_franchisee_members"\)\.insert\(\{ franchisee_id: franchiseSeed\.id, profile_id: ownerProbe\.id \}\)/.test(overflow));
  check("C: it walks every seeded view with the session each names", /franchiseSeedScreens\(franchiseSeed\)\.filter\(\(s\) => s\.role === role\)/.test(overflow) && /const seedCookie = \{ admin: probe\?\.cookie, franchisee_owner: ownerProbe\?\.cookie \}/.test(overflow));
  check(
    "C: and its own teardown removes the owner's membership before the profile",
    /\[probe, licensedProbe, techProbe, ownerProbe\]/.test(overflow) &&
      overflow.indexOf('from("eng_franchisee_members").delete().eq("profile_id", id)') > 0 &&
      overflow.indexOf('from("eng_franchisee_members").delete().eq("profile_id", id)') < overflow.indexOf('await db.from("eng_profiles").delete().eq("id", id);'),
  );
  const v10 = read("scripts/v10-layout-audit.mjs");
  check("C: v10-layout-audit reads the seed, fails when it is not whole, and attaches an owner", /const franchiseSeed = await seededFranchisee\(db\);/.test(v10) && /rec\("the franchise seed is whole[^"]*", franchiseSeed\.ok,/.test(v10) && /await attachFranchiseeOwner\(BASE, "v10-layout", franchiseSeed\.id, db\)/.test(v10));
  check("C: and measures every seeded view, opened by the session its role names", /for \(const s of franchiseSeedScreens\(franchiseSeed\)\) targets\.push\(/.test(v10) && /if \(path\?\.startsWith\("seed:"\)\) return \{ probe: sessions\[path\.split\(":"\)\[1\]\] \?\? null, cookie: cookieFor \};/.test(v10));
}

console.log("D  the teardown takes a probe's membership, and only a probe's");
{
  const probe = read("scripts/lib/portal-probe.mjs");
  const loop = probe.indexOf("for (const id of ids) {");
  const at = probe.indexOf('from("eng_franchisee_members").delete().eq("profile_id", id)');
  const profiles = probe.indexOf('await d.from("eng_profiles").delete().eq("id", id);');
  check("D: destroyProbes deletes eng_franchisee_members by each probe id, inside the probe loop", loop > 0 && at > loop);
  check("D: before it deletes the probe's profile", at > 0 && profiles > at, `loop at ${loop}, membership at ${at}, profiles at ${profiles}`);
  check("D: and a refusal is said, not swallowed", /refusals\.push\(`eng_franchisee_members \$\{id\}: /.test(probe));
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
