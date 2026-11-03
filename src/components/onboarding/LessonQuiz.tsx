"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/primitives";

/**
 * One lesson's quiz, taken from the person's own onboarding link.
 *
 * The browser is never told which choice is correct: the questions arrive here
 * without their answers, the choices made are sent to the server, and the
 * server scores them against the course in code and records the attempt.
 */
export function LessonQuiz({
  token,
  course,
  lesson,
  questions,
}: {
  token: string;
  course: string;
  lesson: string;
  questions: { prompt: string; choices: readonly string[] }[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (answers.some((a) => a === null)) {
      setMessage("Answer every question before submitting.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/onboarding/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, course, lesson, answers }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; correct?: number; questions?: number; passed?: boolean } | null;
      if (!res.ok || !body?.ok) {
        setMessage(body?.error ?? "That did not save. Try it again in a moment.");
      } else {
        setMessage(
          body.passed
            ? `Passed: ${body.correct} of ${body.questions} correct.`
            : `${body.correct} of ${body.questions} correct, which is not a pass yet. Read the lesson again and retake it; every attempt is recorded.`,
        );
        router.refresh();
      }
    } catch {
      setMessage("That did not reach the server. Nothing was recorded; try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-6">
      <ol className="list-decimal space-y-5 pl-5">
        {questions.map((q, i) => (
          <li key={i}>
            <fieldset>
              <legend className="text-[1rem] leading-[1.6] font-semibold text-slate">{q.prompt}</legend>
              <div className="mt-2 space-y-1">
                {q.choices.map((choice, j) => (
                  <label key={j} className="flex min-h-[44px] items-center gap-3 text-[0.98rem] leading-[1.55] text-slate">
                    <input
                      type="radio"
                      name={`${lesson}-q${i}`}
                      checked={answers[i] === j}
                      onChange={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))}
                    />
                    {choice}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <button type="button" onClick={submit} disabled={busy} className={`${buttonClass("primary")} mt-6`}>
        {busy ? "Sending" : "Submit my answers"}
      </button>
      {message ? (
        <p role="status" className="mt-4 text-[0.95rem] leading-[1.65] text-slate">
          {message}
        </p>
      ) : null}
    </div>
  );
}
