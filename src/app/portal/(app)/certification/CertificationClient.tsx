"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicQuestion } from "@/lib/ops-certification";

/**
 * Taking a protocol check.
 *
 * WHAT THIS COMPONENT NEVER RECEIVES
 * ----------------------------------
 * The answers. `questions` arrives through forTechnician, which drops
 * correctIndex and rationale on the server, so there is nothing in the props,
 * nothing in the page source, and nothing in the network response to inspect. A
 * check whose answers can be read out of the page is a formality, and a
 * formality that writes a certification record is worse than no record.
 *
 * The rationale for a question comes back only after it has been answered
 * wrongly, and even then the correct option is not named. Being told WHY is what
 * makes a retake worth taking; being told WHICH would turn it into a memory test
 * of a list they just saw.
 */

type Item = {
  id: string;
  label: string;
  kind: string;
  required: boolean;
  instructions: string | null;
  minCount: number | null;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
};

type Result = {
  passed: boolean;
  score: number;
  correct: number;
  total: number;
  wrong: { questionId: string; prompt: string; rationale: string }[];
  unanswered: string[];
};

const KIND_LABEL: Record<string, string> = {
  photo: "Photograph",
  measurement: "Measurement",
  reading: "Instrument reading",
  document: "Document",
  note: "Written note",
};

export function CheckRunner({
  serviceSlug,
  serviceName,
  protocolName,
  items,
  questions,
  blocked,
}: {
  serviceSlug: string;
  serviceName: string;
  protocolName: string;
  items: Item[];
  questions: PublicQuestion[];
  blocked: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const wrongIds = new Set(result?.wrong.map((w) => w.questionId) ?? []);
  const answeredAll = questions.every((q) => answers[q.id] !== undefined);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_attempt",
          serviceSlug,
          answers: Object.entries(answers).map(([questionId, optionIndex]) => ({ questionId, optionIndex })),
        }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; result?: Result } | null;
      if (!res.ok || !body?.ok || !body.result) {
        setError(body?.error ?? "That did not work.");
        return;
      }
      setResult(body.result);
      if (body.result.passed) router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("The network dropped that. Try again when you have signal.");
    } finally {
      setBusy(false);
    }
  }

  if (result?.passed) {
    return (
      <div className="rounded-[4px] border border-limestone-line border-t-[#2f6b45] bg-white px-4 py-6 sm:px-6">
        <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Certified</p>
        <h2 className="mt-2 font-display text-[22px] leading-[1.2] font-bold text-slate">{serviceName}</h2>
        <p className="mt-2 max-w-[65ch] text-[14px] leading-[1.6] text-slate-muted">
          {result.correct} of {result.total}. You can be offered work on this line as soon as your
          paperwork is current, which the panel beside this one tells you.
        </p>
        <a
          href="/portal/certification"
          className="mt-4 inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[15px] font-bold text-white"
        >
          Back to your certifications
        </a>
      </div>
    );
  }

  return (
    <div>
      <a
        href="/portal/certification"
        className="mb-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-slate-muted"
      >
        Back to your certifications
      </a>

      <div className="rounded-[4px] border border-limestone-line bg-white px-4 py-5 sm:px-5">
        <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">{protocolName}</p>
        <h2 className="mt-1 font-display text-[20px] leading-[1.2] font-bold text-slate">{serviceName}</h2>
        <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.55] text-slate-muted">
          This is what you would capture on every job in this line. Read it, then answer the
          questions underneath. The protocol stays on the page while you answer, because the point is
          that you know where to look.
        </p>

        <ol className="mt-4 divide-y divide-limestone-line">
          {items.map((item, i) => (
            <li key={item.id} className="py-3">
              <p className="text-[14px] font-semibold text-slate">
                {i + 1}. {item.label}
                {item.required ? "" : " (optional)"}
              </p>
              <p className="mt-0.5 text-[13px] text-slate-muted">
                {KIND_LABEL[item.kind] ?? item.kind}
                {item.kind === "photo" && item.minCount && item.minCount > 1 ? `, ${item.minCount} frames` : ""}
                {item.unit ? `, in ${item.unit}` : ""}
                {item.minValue != null || item.maxValue != null
                  ? `, expected ${item.minValue ?? "any"} to ${item.maxValue ?? "any"}`
                  : ""}
              </p>
              {item.instructions ? (
                <p className="mt-1 max-w-[70ch] text-[13px] leading-[1.5] text-slate-muted">{item.instructions}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {blocked ? (
        <div className="mt-6 rounded-[4px] border border-limestone-line bg-white px-4 py-4">
          <p className="text-[13.5px] leading-[1.55] text-slate-muted">{blocked}</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="mt-6 rounded-[4px] border border-limestone-line bg-white px-4 py-4">
          <p className="text-[14px] font-semibold text-slate">No check questions on this protocol yet</p>
          <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-slate-muted">
            The engineer who wrote this protocol has not added the questions yet, so there is nothing
            to be certified against. Nothing is wrong on your side.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          {result && !result.passed ? (
            <div className="mb-5 rounded-[4px] border border-[#e8bdb8] border-l-[#a3241c] bg-[#fdf1f0] px-4 py-4">
              <p className="text-[14px] font-bold text-[#a3241c]">
                {result.correct} of {result.total}. Not passed.
              </p>
              <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[#a3241c]">
                Every question has to be right, because there is no such thing as most of an evidence
                package. The reasoning for each one you missed is under the question. Change your
                answers and submit again; it costs nothing.
              </p>
              {result.unanswered.length > 0 ? (
                <p className="mt-1.5 text-[13.5px] font-semibold text-[#a3241c]">
                  {result.unanswered.length} question
                  {result.unanswered.length === 1 ? " was" : "s were"} left blank.
                </p>
              ) : null}
            </div>
          ) : null}

          <ol className="flex flex-col gap-4">
            {questions.map((q, i) => {
              const missed = wrongIds.has(q.id);
              const rationale = result?.wrong.find((w) => w.questionId === q.id)?.rationale;
              return (
                <li
                  key={q.id}
                  className={`rounded-[4px] border bg-white p-4 ${
                    missed ? "border-[#e8bdb8] border-l-[#a3241c]" : "border-limestone-line"
                  }`}
                >
                  <fieldset>
                    <legend className="text-[15px] leading-[1.4] font-semibold text-slate">
                      {i + 1}. {q.prompt}
                    </legend>
                    <div className="mt-3 flex flex-col gap-2">
                      {q.options.map((option, index) => (
                        <label
                          key={option}
                          className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[3px] border px-3 py-2 ${
                            answers[q.id] === index ? "border-slate bg-limestone" : "border-limestone-line"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === index}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: index }))}
                            className="h-5 w-5 shrink-0 accent-[#1d2a35]"
                          />
                          <span className="text-[14.5px] leading-[1.45] text-slate">{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {rationale ? (
                    <p className="mt-3 rounded-[3px] bg-[#fdf1f0] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[#a3241c]">
                      {rationale}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {error ? (
            <p role="alert" className="mt-4 text-[14px] leading-[1.5] font-semibold text-[#a3241c]">
              {error}
            </p>
          ) : null}

          <div className="mt-6">
            {!answeredAll ? (
              <p className="mb-2 text-[13.5px] text-slate-muted">
                {questions.length - Object.keys(answers).length} question
                {questions.length - Object.keys(answers).length === 1 ? "" : "s"} left. A blank answer
                counts as wrong.
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[16px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {busy ? "Checking" : result ? "Submit again" : "Submit the check"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
