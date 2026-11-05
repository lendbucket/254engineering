import { createHash } from "node:crypto";
import { ACADEMY_COURSES, REQUIRED_COURSES, currentProtocolVersion, type Course, type Lesson } from "@/content/academy/courses";

/**
 * ===========================================================================
 * THE ACADEMY'S RULES, PURE. Robert's ruling P3 of 2026-11-01: a pass mark,
 * every attempt recorded, each course versioned to the protocol version it
 * teaches, nothing graduated against a draft, and graduation from both
 * required courses before a field technician is enrolled.
 * ===========================================================================
 *
 * A course's standing has a word for each state it can be in, because the
 * nearest available word would be a lie about it (CLAUDE.md, the status
 * vocabulary rule):
 *
 *   awaiting_robert    the owner's course: not yet written, or written and not
 *                      yet approved by him
 *   awaiting_engineer  drafted from the protocols, not yet approved by the
 *                      engineer of record in exactly this form
 *   out_of_date        a lesson names a protocol version the transcription no
 *                      longer carries; it needs a new course version
 *   in_force           an approval of exactly this content is on record
 *
 * Only in_force can be taken or graduated. The database enforces the same
 * thing from its side: an attempt must reference an approval (0106).
 *
 * Graduation is derived here from the courses in code, the approvals and the
 * attempts, and is stored nowhere, so it has one home.
 */

export type CourseStatus = "awaiting_robert" | "awaiting_engineer" | "out_of_date" | "in_force";

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  awaiting_robert: "Awaiting Robert",
  awaiting_engineer: "Awaiting engineer approval",
  out_of_date: "Out of date: a protocol it teaches has a newer version",
  in_force: "In force",
};

export type ApprovalRow = {
  id: string;
  course_slug: string;
  course_version: number;
  content_sha256: string;
  approver_kind: "engineer_of_record" | "owner";
  approved_by: string;
  created_at: string;
};

export type AttemptRow = {
  approval_id: string;
  lesson_key: string;
  passed: boolean;
  created_at: string;
};

/**
 * The SHA-256 of everything a person is taught and tested on, in a fixed order:
 * slug, version, title, pass mark, and each lesson's key, title, protocol and
 * version taught, reading and questions with their answers. An approval is of
 * this hash, so a changed word, answer or protocol version is a different
 * course.
 */
export function courseContentHash(course: Course): string {
  const canonical = JSON.stringify([
    course.slug,
    course.version,
    course.title,
    course.approver,
    course.passMarkPercent,
    course.lessons.map((l) => [
      l.key,
      l.title,
      l.teaches.documentNumber,
      l.teaches.version,
      l.lines,
      l.quiz.map((q) => [q.prompt, q.choices, q.answer, q.source]),
    ]),
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** A lesson teaching a version the transcription no longer carries. */
export function staleLessons(course: Course, versionOf: (doc: string) => string | null = currentProtocolVersion): Lesson[] {
  return course.lessons.filter((l) => versionOf(l.teaches.documentNumber) !== l.teaches.version);
}

export function courseStanding(
  course: Course,
  approvals: readonly ApprovalRow[],
  versionOf: (doc: string) => string | null = currentProtocolVersion,
): { status: CourseStatus; approval: ApprovalRow | null; hash: string } {
  const hash = courseContentHash(course);
  if (course.placeholder !== null || course.lessons.length === 0) return { status: "awaiting_robert", approval: null, hash };
  if (staleLessons(course, versionOf).length > 0) return { status: "out_of_date", approval: null, hash };
  const approval =
    approvals.find(
      (a) => a.course_slug === course.slug && a.course_version === course.version && a.content_sha256 === hash && a.approver_kind === course.approver,
    ) ?? null;
  if (approval) return { status: "in_force", approval, hash };
  return { status: course.approver === "owner" ? "awaiting_robert" : "awaiting_engineer", approval: null, hash };
}

/** Whether this content may be approved now, and by which kind of approver; a refusal sentence otherwise. */
export function approvalRefusal(course: Course, approvals: readonly ApprovalRow[], approverKind: ApprovalRow["approver_kind"]): string | null {
  if (approverKind !== course.approver) {
    return course.approver === "engineer_of_record"
      ? "This course teaches the signed protocols, so only the engineer of record approves it."
      : "This is the firm's own safety course, so only the owner approves it.";
  }
  const standing = courseStanding(course, approvals);
  if (course.placeholder !== null || course.lessons.length === 0) return "This course has not been written yet, so there is nothing to approve.";
  if (standing.status === "out_of_date") return "A protocol this course teaches has a newer version, so this version cannot be approved. A new version of the course is drafted first.";
  if (standing.status === "in_force") return "This exact course is already approved.";
  return null;
}

/** Score one quiz. Answers are choice indexes, one per question, in order; anything else scores nothing. */
export function scoreQuiz(lesson: Lesson, answers: readonly unknown[], passMarkPercent: number): { correct: number; questions: number; passed: boolean } | null {
  const questions = lesson.quiz.length;
  if (questions === 0) return null;
  if (!Array.isArray(answers) || answers.length !== questions) return null;
  if (!answers.every((a, i) => Number.isInteger(a) && (a as number) >= 0 && (a as number) < lesson.quiz[i].choices.length)) return null;
  const correct = lesson.quiz.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  return { correct, questions, passed: correct * 100 >= passMarkPercent * questions };
}

export type CourseProgress = {
  slug: string;
  title: string;
  status: CourseStatus;
  lessonsTotal: number;
  lessonsPassed: number;
  /** Lesson titles not yet passed against the approval in force. */
  outstanding: string[];
  graduated: boolean;
};

/**
 * Where one person stands on every required course. A lesson counts only when
 * an attempt against the approval IN FORCE passed; an attempt against any other
 * approval, an earlier version or a different content, counts for nothing.
 */
export function graduation(
  approvals: readonly ApprovalRow[],
  attempts: readonly AttemptRow[],
  courses: readonly Course[] = ACADEMY_COURSES,
  required: readonly string[] = REQUIRED_COURSES,
  versionOf: (doc: string) => string | null = currentProtocolVersion,
): { graduated: boolean; courses: CourseProgress[] } {
  const progress = required.map((slug): CourseProgress => {
    const course = courses.find((c) => c.slug === slug);
    if (!course) return { slug, title: slug, status: "awaiting_robert", lessonsTotal: 0, lessonsPassed: 0, outstanding: [], graduated: false };
    const standing = courseStanding(course, approvals, versionOf);
    const passedKeys = new Set(
      standing.approval ? attempts.filter((a) => a.approval_id === standing.approval!.id && a.passed).map((a) => a.lesson_key) : [],
    );
    const outstanding = course.lessons.filter((l) => !passedKeys.has(l.key)).map((l) => l.title);
    const lessonsPassed = course.lessons.length - outstanding.length;
    return {
      slug,
      title: course.title,
      status: standing.status,
      lessonsTotal: course.lessons.length,
      lessonsPassed,
      outstanding,
      graduated: standing.status === "in_force" && course.lessons.length > 0 && outstanding.length === 0,
    };
  });
  return { graduated: progress.length > 0 && progress.every((p) => p.graduated), courses: progress };
}

/** Why a person may not yet be enrolled as a field technician, one sentence per course; empty when they may. */
export function graduationBlockers(result: { graduated: boolean; courses: CourseProgress[] }): string[] {
  if (result.graduated) return [];
  return result.courses
    .filter((c) => !c.graduated)
    .map((c) =>
      c.status !== "in_force"
        ? `${c.title} is not in force yet (${COURSE_STATUS_LABEL[c.status]}), so nobody can graduate from it.`
        : `${c.title}: ${c.lessonsPassed} of ${c.lessonsTotal} lessons passed.`,
    );
}
