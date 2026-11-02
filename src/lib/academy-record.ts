import "server-only";
import { supabaseAdmin } from "./supabase";
import { readEvery, readEveryIn } from "./bounded-read";
import { writeAuditOrRefuse } from "./ops-audit";
import { holdsLicence, type Actor } from "./ops-authz";
import { isOwnerAdmin } from "./owner-override";
import { ACADEMY_COURSES } from "@/content/academy/courses";
import {
  approvalRefusal,
  courseStanding,
  graduation,
  graduationBlockers,
  scoreQuiz,
  type ApprovalRow,
  type AttemptRow,
  type CourseProgress,
} from "./academy";

/**
 * ===========================================================================
 * THE ACADEMY'S READS AND WRITES. Robert's ruling P3 of 2026-11-01.
 * ===========================================================================
 *
 * Every read here answers null, never an empty list, when it fails, and every
 * decision that rests on one fails shut: a failed read of the approvals or the
 * attempts is never "not graduated yet" and never "graduated", it is a refusal
 * that says it could not tell.
 */

type Context = { ip?: string | null; userAgent?: string | null };

const APPROVAL_COLUMNS = "id, course_slug, course_version, content_sha256, approver_kind, approved_by, created_at";

export async function readApprovals(): Promise<ApprovalRow[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const read = await readEvery<ApprovalRow>((from, to) =>
    db.from("eng_academy_course_approvals").select(APPROVAL_COLUMNS).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  return read.ok ? read.rows : null;
}

async function readAttempts(onboardingIds: readonly string[]): Promise<(AttemptRow & { onboarding_id: string })[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const read = await readEveryIn<AttemptRow & { onboarding_id: string }>(onboardingIds, (chunk, from, to) =>
    db
      .from("eng_academy_attempts")
      .select("onboarding_id, approval_id, lesson_key, passed, created_at")
      .in("onboarding_id", [...chunk])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return read.ok ? read.rows : null;
}

/** One person's standing on both required courses, or why it could not be read. */
export async function standingFor(onboardingId: string): Promise<{ ok: true; graduated: boolean; courses: CourseProgress[] } | { ok: false; error: string }> {
  const approvals = await readApprovals();
  if (approvals === null) return { ok: false, error: "The course approvals could not be read." };
  const attempts = await readAttempts([onboardingId]);
  if (attempts === null) return { ok: false, error: "The quiz attempts could not be read." };
  return { ok: true, ...graduation(approvals, attempts) };
}

/**
 * ===========================================================================
 * THE ONE QUESTION EVERY DOOR THAT ENROLLS A FIELD TECHNICIAN ASKS.
 * ===========================================================================
 *
 * Robert, P3: "graduation from both required courses before a field_tech
 * enrollment can be created". Three doors make somebody a field technician:
 * activating an onboarding, creating an account on the People screen, and
 * moving a person to that role on the roles screen. Each asks this, with the
 * onboarding the person came through, or null when there is none.
 *
 * Empty when they may be enrolled; otherwise the sentences that say why not.
 * It fails shut: no onboarding, a failed read, or a course not in force is a
 * refusal. Graduation is the entry requirement only; certification still
 * needs the engineer's sign off after a supervised inspection, and nothing
 * here touches that path.
 */
export async function fieldTechEnrollmentRefusal(onboardingId: string | null): Promise<string[]> {
  if (!onboardingId) {
    return ["A field technician is enrolled from an onboarding, after graduating from both required training courses, and this person has no onboarding."];
  }
  const standing = await standingFor(onboardingId);
  if (!standing.ok) return [`Whether this person has graduated could not be told, so they are not enrolled: ${standing.error}`];
  return graduationBlockers(standing);
}

/**
 * Record one quiz attempt from the person's own onboarding link. The course
 * must be in force: there is no attempt against a draft, and the database
 * refuses one too (0106, approval_id not null). The score is computed here
 * from the course in code, never taken from the browser.
 */
export async function recordAttempt(
  onboardingId: string,
  courseSlug: string,
  lessonKey: string,
  answers: unknown,
): Promise<{ ok: true; correct: number; questions: number; passed: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const course = ACADEMY_COURSES.find((c) => c.slug === courseSlug);
  if (!course) return { ok: false, error: "That course does not exist." };
  const lesson = course.lessons.find((l) => l.key === lessonKey);
  if (!lesson) return { ok: false, error: "That lesson does not exist." };

  const approvals = await readApprovals();
  if (approvals === null) return { ok: false, error: "Whether this course is in force could not be read, so nothing was recorded. Try again in a minute." };
  const standing = courseStanding(course, approvals);
  if (standing.status !== "in_force" || !standing.approval) {
    return { ok: false, error: "This course is not in force yet, so it cannot be taken." };
  }

  const score = scoreQuiz(lesson, Array.isArray(answers) ? answers : [], course.passMarkPercent);
  if (!score) return { ok: false, error: "Answer every question before submitting." };

  const { error } = await db.from("eng_academy_attempts").insert({
    onboarding_id: onboardingId,
    approval_id: standing.approval.id,
    lesson_key: lesson.key,
    answers,
    correct: score.correct,
    questions: score.questions,
    pass_mark_percent: course.passMarkPercent,
    passed: score.passed,
  });
  if (error) return { ok: false, error: `The attempt could not be recorded, so it does not count yet: ${error.message}` };
  return { ok: true, ...score };
}

/**
 * Approve exactly the content of one course version. The protocol course is
 * the engineer of record's, from his own session; the safety course is the
 * owner's. The record is written to the audit log first, and nothing is
 * approved if it cannot be.
 */
export async function approveCourse(
  actor: (Actor & { email: string }) | null,
  courseSlug: string,
  courseVersion: number,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!actor) return { ok: false, error: "Not signed in." };
  const course = ACADEMY_COURSES.find((c) => c.slug === courseSlug && c.version === courseVersion);
  if (!course) return { ok: false, error: "That course version does not exist." };

  const kind: ApprovalRow["approver_kind"] | null = holdsLicence(actor, "protocols.publish")
    ? "engineer_of_record"
    : isOwnerAdmin(actor.id)
      ? "owner"
      : null;
  if (!kind) return { ok: false, error: "Only the engineer of record approves the protocol course, and only the owner approves the safety course." };

  const approvals = await readApprovals();
  if (approvals === null) return { ok: false, error: "The course approvals could not be read, so nothing was approved." };
  const refusal = approvalRefusal(course, approvals, kind);
  if (refusal) return { ok: false, error: refusal };

  const hash = courseStanding(course, approvals).hash;
  const recorded = await writeAuditOrRefuse({
    actor,
    action: "academy.course_approved",
    entityType: "academy_course",
    entityId: `${course.slug}@${course.version}`,
    summary: `Approved the training course "${course.title}", version ${course.version}, content ${hash.slice(0, 12)}`,
    diff: { course: course.slug, version: course.version, content_sha256: hash, approver_kind: kind },
    ...context,
  });
  if (!recorded.ok) return recorded;

  const { error } = await db.from("eng_academy_course_approvals").insert({
    course_slug: course.slug,
    course_version: course.version,
    content_sha256: hash,
    approver_kind: kind,
    approved_by: actor.id,
  });
  if (error) {
    await writeAuditOrRefuse({
      actor,
      action: "academy.course_approved_failed",
      entityType: "academy_course",
      entityId: `${course.slug}@${course.version}`,
      summary: `The approval of "${course.title}" was recorded above and did not save: ${error.message}`,
      ...context,
    });
    return { ok: false, error: `The approval did not save: ${error.message}` };
  }
  return { ok: true };
}

export type AcademyOverview = {
  courses: { slug: string; version: number; title: string; status: ReturnType<typeof courseStanding>["status"]; hash: string; lessons: number; approver: "engineer_of_record" | "owner" }[];
  people: { onboardingId: string; name: string; status: string; graduated: boolean; courses: CourseProgress[] }[];
};

/** Every course's standing, and every open field technician onboarding's progress, for the portal screen. */
export async function academyOverview(): Promise<{ ok: true; overview: AcademyOverview } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const approvals = await readApprovals();
  if (approvals === null) return { ok: false, error: "The course approvals could not be read." };

  const read = await readEvery<{ id: string; person_name: string; status: string }>((from, to) =>
    db
      .from("eng_onboardings")
      .select("id, person_name, status")
      .eq("role", "field_tech")
      .neq("status", "complete")
      .order("invited_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return { ok: false, error: `The onboardings could not be read: ${read.error}` };
  const attempts = await readAttempts(read.rows.map((r) => r.id));
  if (attempts === null) return { ok: false, error: "The quiz attempts could not be read." };

  const courses = ACADEMY_COURSES.map((c) => {
    const s = courseStanding(c, approvals);
    return { slug: c.slug, version: c.version, title: c.title, status: s.status, hash: s.hash, lessons: c.lessons.length, approver: c.approver };
  });
  const people = read.rows.map((r) => {
    const mine = attempts.filter((a) => a.onboarding_id === r.id);
    const g = graduation(approvals, mine);
    return { onboardingId: r.id, name: r.person_name, status: r.status, graduated: g.graduated, courses: g.courses };
  });
  return { ok: true, overview: { courses, people } };
}
