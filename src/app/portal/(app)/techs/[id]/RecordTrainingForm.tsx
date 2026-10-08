"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Record a certification from supervised training. It is recorded for the
 * engineer of record's approval and counts for dispatch only after it
 * (operator ruling, 2026-10-07). The rules live in recordTraining on the
 * server; this shows its sentence when it refuses.
 *
 * Design V10: radio rows, bordered inputs, a square button.
 */
export function RecordTrainingForm({
  profileId,
  lines,
}: {
  profileId: string;
  lines: { serviceSlug: string; name: string; protocol: string }[];
}) {
  const router = useRouter();
  const [serviceSlug, setServiceSlug] = useState(lines[0]?.serviceSlug ?? "");
  const [trainedOn, setTrainedOn] = useState("");
  const [supervisedBy, setSupervisedBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_training", profileId, serviceSlug, trainedOn, supervisedBy }),
      });
      const out = await res.json().catch(() => ({ ok: false, error: "The answer could not be read." }));
      if (!out.ok) {
        setError(out.error ?? "That was not recorded.");
      } else {
        setDone("Recorded. It is awaiting the engineer's approval, and dispatch refuses until he gives it.");
        setTrainedOn("");
        setSupervisedBy("");
        router.refresh();
      }
    } catch {
      setError("That was not recorded, because the connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return <p className="mt-4 text-[14px] text-[var(--secondary)]">No service line has a protocol in force to be trained on.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <fieldset>
        <legend className="text-[13px] font-semibold text-[var(--ink)]">Service line and protocol</legend>
        <ul className="mt-2 border-t border-[var(--row-rule)]">
          {lines.map((l) => (
            <li key={l.serviceSlug} className="border-b border-[var(--row-rule)]">
              <label className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2 text-[15px] text-[var(--ink)]">
                <input
                  type="radio"
                  name="training-line"
                  value={l.serviceSlug}
                  checked={serviceSlug === l.serviceSlug}
                  onChange={() => setServiceSlug(l.serviceSlug)}
                  className="h-[18px] w-[18px] accent-[var(--navy)]"
                />
                <span>
                  {l.name}
                  <span className="block text-[13px] text-[var(--secondary)]">{l.protocol}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-semibold text-[var(--ink)]">Training date</span>
          <input
            type="date"
            value={trainedOn}
            onChange={(e) => setTrainedOn(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)]"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-[var(--ink)]">Supervised by</span>
          <input
            type="text"
            value={supervisedBy}
            onChange={(e) => setSupervisedBy(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)]"
          />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-[2px] bg-[var(--navy)] px-5 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Recording" : "Record for the engineer's approval"}
        </button>
        {done ? (
          <p role="status" className="text-[14px] text-[var(--ink)]">
            {done}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-semibold leading-[1.55] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
