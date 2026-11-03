import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, holdsLicence } from "@/lib/ops-authz";
import { isOwnerAdmin } from "@/lib/owner-override";
import { ACADEMY_COURSES } from "@/content/academy/courses";
import { COURSE_STATUS_LABEL, approvalRefusal } from "@/lib/academy";
import { academyOverview, readApprovals } from "@/lib/academy-record";
import { Chip, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ApproveCourseButton } from "./ApproveCourseButton";

export const dynamic = "force-dynamic";

/**
 * THE TRAINING ACADEMY, FOR THE OFFICE AND THE ENGINEER. Robert's ruling P3 of
 * 2026-11-01: "Admin and engineer screens to see progress."
 *
 * Three things: where each of the two required courses stands, the full
 * content of each so the person approving it reads exactly what is approved,
 * and every field technician still in onboarding with their progress. Whoever
 * onboards technicians (technicians.onboard) and the engineer of record open
 * it; only the engineer approves the protocol course and only the owner the
 * safety course, decided on the server (academy-record.ts).
 *
 * Graduation is the entry requirement only. Certification still needs the
 * engineer's sign off after a supervised inspection, on the review screen.
 */
export default async function TrainingPage() {
  const actor = await currentActor();
  if (!actor || !(can(actor, "technicians.onboard") || holdsLicence(actor, "review.queue"))) notFound();

  const read = await academyOverview();
  const approvals = read.ok ? await readApprovals() : null;
  const approverKind = holdsLicence(actor, "protocols.publish") ? "engineer_of_record" : isOwnerAdmin(actor.id) ? "owner" : null;

  return (
    <>
      <PageHead
        eyebrow="People"
        title="Training academy"
        lede="The two courses a field technician graduates from before they are enrolled. A course counts only once it is approved exactly as written; graduation is the entry requirement, and certification still needs the engineer's sign off after a supervised inspection."
      />

      {!read.ok ? (
        <ErrorState title="The academy could not be read" body={`${read.error} This is not an empty academy. Reload in a minute.`} />
      ) : (
        <>
          <Panel title="The required courses">
            <ul className="divide-y divide-[var(--row-rule)]">
              {read.overview.courses.map((c) => {
                const course = ACADEMY_COURSES.find((x) => x.slug === c.slug && x.version === c.version)!;
                const mayApprove = approverKind !== null && approvals !== null && approvalRefusal(course, approvals, approverKind) === null;
                return (
                  <li key={c.slug} className="py-4 first:pt-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                      <span className="text-[15px] font-semibold text-[var(--ink)]">
                        {c.title}, version {c.version}
                      </span>
                      <Chip label={COURSE_STATUS_LABEL[c.status]} tone={c.status === "in_force" ? "good" : "warn"} />
                    </div>
                    <p className="mt-1 text-[14px] leading-[1.55] text-[var(--ink)]">
                      {course.placeholder ??
                        `${c.lessons} lessons, each with a quiz; a lesson passes at ${course.passMarkPercent} percent. Approved by ${c.approver === "engineer_of_record" ? "the engineer of record" : "the owner"}. Content ${c.hash.slice(0, 12)}.`}
                    </p>
                    {mayApprove ? (
                      <div className="mt-2">
                        <ApproveCourseButton course={c.slug} version={c.version} title={c.title} hash={c.hash} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Technicians in onboarding" description="Every field technician whose onboarding is open, and how far each has got.">
            {read.overview.people.length === 0 ? (
              <EmptyState title="Nobody is in onboarding" body="When a field technician is invited from an application, they appear here and take both courses from their onboarding link." />
            ) : (
              <ul className="divide-y divide-[var(--row-rule)]">
                {read.overview.people.map((p) => (
                  <li key={p.onboardingId} className="py-4 first:pt-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                      <span className="text-[15px] font-semibold text-[var(--ink)]">{p.name}</span>
                      <Chip label={p.graduated ? "Graduated" : "Not graduated"} tone={p.graduated ? "good" : "warn"} />
                    </div>
                    <ul className="mt-1">
                      {p.courses.map((c) => (
                        <li key={c.slug} className="text-[14px] leading-[1.55] text-[var(--ink)]">
                          {c.title}:{" "}
                          {c.status !== "in_force" ? `not in force yet (${COURSE_STATUS_LABEL[c.status]})` : `${c.lessonsPassed} of ${c.lessonsTotal} lessons passed`}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {ACADEMY_COURSES.filter((c) => c.lessons.length > 0).map((course) => (
            <Panel key={course.slug} title={`What "${course.title}" teaches`} description="Each reading is the protocol's own words; each question names the sentence it is drawn from. The correct answer is marked.">
              <div className="space-y-6">
                {course.lessons.map((lesson) => (
                  <details key={lesson.key} className="border-t border-[var(--row-rule)] pt-3">
                    <summary className="min-h-[44px] cursor-pointer text-[15px] font-semibold text-[var(--ink)]">
                      {lesson.title} ({lesson.teaches.documentNumber}, version {lesson.teaches.version})
                    </summary>
                    <div className="mt-3 space-y-1 border-l-2 border-[var(--border)] pl-3">
                      {lesson.lines.map((line, i) => (
                        <p key={i} className="text-[14px] leading-[1.55] text-[var(--ink)]">
                          {line}
                        </p>
                      ))}
                    </div>
                    <ol className="mt-4 list-decimal space-y-3 pl-5">
                      {lesson.quiz.map((q, i) => (
                        <li key={i} className="text-[14px] leading-[1.55] text-[var(--ink)]">
                          <p className="font-semibold">{q.prompt}</p>
                          <ul className="mt-1">
                            {q.choices.map((choice, j) => (
                              <li key={j}>
                                {j === q.answer ? <strong>{choice} (correct)</strong> : choice}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-[var(--secondary)]">From the protocol: &ldquo;{q.source}&rdquo;</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </Panel>
          ))}
        </>
      )}
    </>
  );
}
