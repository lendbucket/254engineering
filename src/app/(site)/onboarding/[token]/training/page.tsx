import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { LessonQuiz } from "@/components/onboarding/LessonQuiz";
import { findByToken } from "@/lib/onboarding";
import { ACADEMY_COURSES, REQUIRED_COURSES } from "@/content/academy/courses";
import { COURSE_STATUS_LABEL } from "@/lib/academy";
import { standingFor } from "@/lib/academy-record";

/**
 * THE TWO REQUIRED COURSES, FROM THE PERSON'S OWN ONBOARDING LINK. Robert's
 * ruling P3 of 2026-11-01: a field technician graduates from both before they
 * are enrolled, so the courses are taken here, before there is an account.
 *
 * Not static, not indexed, and a function of the token on every request, for
 * the reasons the onboarding page beside it gives. A course that is not in
 * force says so and offers nothing to take; nothing is graduated against a
 * draft. Readings are the protocols' own words; no video, no generated person.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

export default async function TrainingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const onboarding = await findByToken(token);
  if (!onboarding || onboarding.status === "complete" || onboarding.role !== "field_tech") notFound();

  const standing = await standingFor(onboarding.id);

  return (
    <>
      <section className="bg-slate-ink">
        <Container>
          <div className="max-w-3xl py-14 sm:py-20">
            <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-light uppercase">Training</p>
            <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
            <h1 className="font-display text-[2rem] leading-[1.1] font-bold text-slate-fg sm:text-[2.7rem]">Two courses before your first assignment</h1>
            <p className="mt-7 text-[1.05rem] leading-[1.75] text-slate-fg-muted">
              Each lesson is a reading followed by a short quiz. You can retake a quiz as often as you need; every attempt is recorded. Finishing both courses is
              what lets the firm enroll you. Certification on each service still comes after an inspection supervised by the engineer.
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="max-w-3xl py-12">
            {!standing.ok ? (
              <p role="alert" className="text-[0.98rem] leading-[1.7] text-slate">
                Your progress could not be read just now, so nothing is shown rather than something wrong. Reload the page in a minute.
              </p>
            ) : (
              REQUIRED_COURSES.map((slug) => {
                const course = ACADEMY_COURSES.find((c) => c.slug === slug)!;
                const progress = standing.courses.find((c) => c.slug === slug)!;
                return (
                  <div key={slug} className="mb-14 last:mb-0">
                    <h2 className="font-display text-[1.6rem] leading-[1.2] font-bold text-slate">{course.title}</h2>
                    {progress.status !== "in_force" ? (
                      <p className="mt-3 text-[0.98rem] leading-[1.7] text-slate">
                        This course is not open yet ({COURSE_STATUS_LABEL[progress.status]}). There is nothing to take until it is approved; check back on this
                        link.
                      </p>
                    ) : (
                      <>
                        <p className="mt-3 text-[0.98rem] leading-[1.7] text-slate">
                          {progress.lessonsPassed} of {progress.lessonsTotal} lessons passed.{progress.graduated ? " You have finished this course." : ""}
                        </p>
                        {course.lessons.map((lesson) => {
                          const passed = !progress.outstanding.includes(lesson.title);
                          return (
                            <details key={lesson.key} className="mt-6 border-t border-limestone-line pt-4" open={!passed}>
                              <summary className="min-h-[44px] cursor-pointer text-[1.05rem] font-semibold text-slate">
                                {lesson.title} {passed ? "(passed)" : ""}
                              </summary>
                              <div className="mt-3 space-y-1 border-l-2 border-limestone-line pl-4">
                                {lesson.lines.map((line, i) => (
                                  <p key={i} className="text-[0.98rem] leading-[1.65] text-slate">
                                    {line}
                                  </p>
                                ))}
                              </div>
                              <LessonQuiz
                                token={token}
                                course={course.slug}
                                lesson={lesson.key}
                                questions={lesson.quiz.map((q) => ({ prompt: q.prompt, choices: q.choices }))}
                              />
                            </details>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
