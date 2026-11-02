/**
 * NOTHING GRADUATES AGAINST A DRAFT, AND NOBODY IS ENROLLED AS A FIELD
 * TECHNICIAN WITHOUT GRADUATING. Robert's ruling P3 of 2026-11-01: "a pass
 * mark, attempts recorded, each course versioned to the protocol version it
 * teaches, and graduation from both required courses before a field_tech
 * enrollment can be created ... nothing can be graduated against a draft."
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/nothing-graduates-against-a-draft.mjs
 *
 * The engine (src/lib/academy.ts) is asked with approvals and attempts handed
 * to it, using the real courses and a fixture pair whose second course has a
 * lesson, so the path to a graduation exists and can be walked. The doors that
 * enroll a field technician, the attempt route and the migration are asserted
 * from their source, because each is a path no fixture here reaches without a
 * database.
 *
 * NO DATABASE, NO SERVER, NO CREDENTIAL.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { ACADEMY_COURSES } = await import("../../src/content/academy/courses.ts");
const { courseContentHash, courseStanding, approvalRefusal, scoreQuiz, graduation, graduationBlockers } = await import("../../src/lib/academy.ts");

const [real1, real2] = ACADEMY_COURSES;

/* ---- the real courses, today: drafts, so nobody graduates ---- */
check("course 1 with no approval awaits the engineer", courseStanding(real1, []).status === "awaiting_engineer");
check("course 2, a placeholder, awaits Robert", courseStanding(real2, []).status === "awaiting_robert");
const today = graduation([], []);
check("so nobody has graduated, and the blockers name both courses", !today.graduated && graduationBlockers(today).length === 2, graduationBlockers(today).join(" | "));
check("a placeholder cannot be approved, even by the owner", approvalRefusal(real2, [], "owner") !== null);
check("course 1 cannot be approved by the owner", approvalRefusal(real1, [], "owner") !== null);
check("course 1 can be approved by the engineer of record, as it stands", approvalRefusal(real1, [], "engineer_of_record") === null);

/* ---- a fixture pair with a course 2 that has a lesson, so graduation can be reached ---- */
const lesson = (key) => ({
  key,
  title: `Lesson ${key}`,
  teaches: { documentNumber: "254-FC-001", version: "1.0" },
  lines: ["A line."],
  quiz: [
    { prompt: "One?", choices: ["a", "b", "c"], answer: 0, source: "A line." },
    { prompt: "Two?", choices: ["a", "b", "c"], answer: 1, source: "A line." },
    { prompt: "Three?", choices: ["a", "b", "c"], answer: 2, source: "A line." },
  ],
});
const c1 = { slug: "duties-and-protocols", version: 1, title: "One", approver: "engineer_of_record", passMarkPercent: 80, placeholder: null, lessons: [lesson("A"), lesson("B")] };
const c2 = { slug: "ladder-and-roof-fall-safety", version: 1, title: "Two", approver: "owner", passMarkPercent: 80, placeholder: null, lessons: [lesson("S")] };
const courses = [c1, c2];
const versionOf = () => "1.0";
const approve = (c, id, kind = c.approver, hash = courseContentHash(c)) => ({ id, course_slug: c.slug, course_version: c.version, content_sha256: hash, approver_kind: kind, approved_by: "x", created_at: "2026-11-01" });
const pass = (approval_id, lesson_key, passed = true) => ({ approval_id, lesson_key, passed, created_at: "2026-11-01" });
const grad = (approvals, attempts) => graduation(approvals, attempts, courses, ["duties-and-protocols", "ladder-and-roof-fall-safety"], versionOf);

const both = [approve(c1, "ap1"), approve(c2, "ap2")];
const all = [pass("ap1", "A"), pass("ap1", "B"), pass("ap2", "S")];
check("both courses in force and every lesson passed: graduated", grad(both, all).graduated === true);
check("and graduated means no blockers", graduationBlockers(grad(both, all)).length === 0);
check("one lesson missing: not graduated", grad(both, all.slice(1)).graduated === false);
check("a failed attempt counts for nothing", grad(both, [pass("ap1", "A"), pass("ap1", "B", false), pass("ap2", "S")]).graduated === false);
check("course 1 alone is not enough: both are required", grad([approve(c1, "ap1")], all).graduated === false);
check("an attempt against a different approval counts for nothing", grad(both, [pass("ap1", "A"), pass("old", "B"), pass("ap2", "S")]).graduated === false);

/* ---- nothing graduates against a draft ---- */
const edited = { ...c1, lessons: [lesson("A"), { ...lesson("B"), quiz: [...lesson("B").quiz.slice(0, 2), { ...lesson("B").quiz[2], answer: 0 }] }] };
check("a course edited after approval hashes differently", courseContentHash(edited) !== courseContentHash(c1));
check("so the old approval no longer puts it in force: it is a draft again", courseStanding(edited, both, versionOf).status === "awaiting_engineer");
check("and attempts made under the old approval graduate nobody", graduation(both, all, [edited, c2], ["duties-and-protocols", "ladder-and-roof-fall-safety"], versionOf).graduated === false);
check("an approval by the wrong kind of approver puts nothing in force", courseStanding(c1, [approve(c1, "x", "owner")], versionOf).status === "awaiting_engineer");

/* ---- each course is versioned to the protocol version it teaches ---- */
const moved = (doc) => (doc === "254-FC-001" ? "1.1" : "1.0");
check("a protocol moving to a new version makes the course out of date", courseStanding(c1, both, moved).status === "out_of_date");
check("an out of date course graduates nobody, even with every lesson passed", graduation(both, all, courses, ["duties-and-protocols", "ladder-and-roof-fall-safety"], moved).graduated === false);
check("the version a lesson teaches is part of the approved hash", courseContentHash({ ...c1, lessons: [{ ...lesson("A"), teaches: { documentNumber: "254-FC-001", version: "1.1" } }, lesson("B")] }) !== courseContentHash(c1));

/* ---- the pass mark ---- */
check("two of three at an 80 percent mark is not a pass", scoreQuiz(lesson("A"), [0, 1, 0], 80)?.passed === false);
check("three of three is", scoreQuiz(lesson("A"), [0, 1, 2], 80)?.passed === true);
check("two of three at a 60 percent mark is", scoreQuiz(lesson("A"), [0, 1, 0], 60)?.passed === true);
check("too few answers scores nothing", scoreQuiz(lesson("A"), [0, 1], 80) === null);
check("an answer outside the choices scores nothing", scoreQuiz(lesson("A"), [0, 1, 7], 80) === null);
check("an answer that is not a whole number scores nothing", scoreQuiz(lesson("A"), [0, 1, "2"], 80) === null);

/* ---- every door that enrolls a field technician asks first ---- */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const record = strip(readFileSync("src/lib/academy-record.ts", "utf8"));
const refusal = record.slice(record.indexOf("export async function fieldTechEnrollmentRefusal"), record.indexOf("export async function recordAttempt"));
check("no onboarding is a refusal", /if \(!onboardingId\) \{\s*return \["A field technician is enrolled from an onboarding/.test(refusal));
check("a failed read is a refusal, never a pass", /if \(!standing\.ok\) return \[`Whether this person has graduated could not be told/.test(refusal));
check("otherwise the blockers are graduation's own", /return graduationBlockers\(standing\);/.test(refusal));

const onboarding = strip(readFileSync("src/lib/ops-onboarding.ts", "utf8"));
const activate = onboarding.slice(onboarding.indexOf("export async function activateTechnician"));
const askAt = activate.indexOf("await fieldTechEnrollmentRefusal(onboardingId)");
check("activation asks, for a field technician, before the account is created", /if \(view\.onboarding\.role === "field_tech"\) \{/.test(activate) && askAt > 0 && askAt < activate.indexOf("await createAccount("));
check("and refuses with the blockers", /if \(untrained\.length\) \{\s*return \{ ok: false, error: "This person has not graduated from both required training courses\.", blockers: untrained \};/.test(activate));

const people = strip(readFileSync("src/app/api/portal/people/route.ts", "utf8"));
const createAt = people.indexOf("await createAccount(");
const peopleAsk = people.indexOf("await fieldTechEnrollmentRefusal(null)");
check("the People screen asks for a field technician before creating the account, with no onboarding", /if \(role === "field_tech"\) \{/.test(people) && peopleAsk > 0 && peopleAsk < createAt);

const roles = strip(readFileSync("src/lib/ops-roles.ts", "utf8"));
const setRole = roles.slice(roles.indexOf("export async function setUserRole"));
const rolesAsk = setRole.indexOf("await fieldTechEnrollmentRefusal(");
check("moving a person into field_tech asks before the role is written", /if \(nextRoleKey === "field_tech" && wasRole !== "field_tech"\) \{/.test(setRole) && rolesAsk > 0 && rolesAsk < setRole.indexOf('.update({ role: nextRoleKey })'));

/* ---- the attempt is scored on the server, only against a course in force ---- */
const attempt = record.slice(record.indexOf("export async function recordAttempt"), record.indexOf("export async function approveCourse"));
check("an attempt is refused unless the course is in force", /if \(standing\.status !== "in_force" \|\| !standing\.approval\) \{/.test(attempt));
check("and is scored here, from the course in code", /const score = scoreQuiz\(lesson,/.test(attempt) && /approval_id: standing\.approval\.id,/.test(attempt));
const page = readFileSync("src/app/(site)/onboarding/[token]/training/page.tsx", "utf8");
check("the browser is sent the questions without their answers", /questions=\{lesson\.quiz\.map\(\(q\) => \(\{ prompt: q\.prompt, choices: q\.choices \}\)\)\}/.test(page) && !/answer/.test(page.slice(page.indexOf("<LessonQuiz"), page.indexOf("/>", page.indexOf("<LessonQuiz")))));

/* ---- the database says the same thing from its side ---- */
const sql = readFileSync("supabase/migrations/0106_the_academy_records_approvals_and_attempts.sql", "utf8");
check("an attempt must reference an approval, so none exists against a draft", /approval_id\s+uuid not null references eng_academy_course_approvals \(id\) on delete restrict/.test(sql));
check("whether it passed is checked arithmetic", /check \(passed = \(correct \* 100 >= pass_mark_percent \* questions\)\)/.test(sql));
check("approvals are append only, attempts append only but swept with their onboarding", /eng_academy_course_approvals_append_only[\s\S]*?execute function eng_forbid_mutation\(\);/.test(sql) && /eng_academy_attempts_append_only[\s\S]*?execute function eng_forbid_mutation_allow_cascade\(\);/.test(sql));
check("approver kind is one of the two words", /approver_kind\s+text not null check \(approver_kind in \('engineer_of_record', 'owner'\)\)/.test(sql));

console.log(wrong === 0 ? "PASS: nothing graduates against a draft, the pass mark and version binding hold, and every door enrolling a field technician asks first." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
