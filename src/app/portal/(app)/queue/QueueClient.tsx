"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeadJob = {
  id: number;
  kind: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  payload: Record<string, unknown>;
  createdAt: string;
  finishedAt: string | null;
};

/**
 * The dead letter list, and the one action available on it.
 *
 * The error is shown in full rather than truncated. It is the provider's own
 * words, and it is the only thing that tells an operator whether this is a
 * transient failure worth retrying or a defect worth fixing first. A clipped
 * message is exactly the one that hides which.
 */
export function QueueClient({ jobs }: { jobs: DeadJob[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function retry(id: number) {
    setBusy(id);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That did not work.");
        return;
      }
      setNote(`Job ${id} is back on the queue with its attempts reset.`);
      router.refresh();
    } catch {
      setError("The request did not complete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-limestone-line">
        {jobs.map((j) => (
          <li key={j.id} className="py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[13.5px] font-semibold text-[var(--navy)]">{j.kind}</span>
              <span className="font-mono text-[12px] text-[var(--secondary)]">#{j.id}</span>
              <span className="text-[12.5px] text-[var(--secondary)]">
                {j.attempts} of {j.maxAttempts} attempts
              </span>
              {j.finishedAt ? (
                <span className="text-[12.5px] text-[var(--secondary)]">
                  gave up {new Date(j.finishedAt).toLocaleString("en-US")}
                </span>
              ) : null}
            </div>

            <p className="mt-2 max-w-[80ch] rounded-[3px] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] leading-[1.55] text-[var(--red)]">
              {j.lastError || "No error was recorded, which is itself worth looking at."}
            </p>

            {/*
              Wrapped rather than scrolled. A payload on one nowrap line inside
              an overflow container is clipped at 390 with nothing saying it can
              be scrolled, and the identifier that got cut off is exactly the
              one somebody is reading the row to find.
            */}
            {Object.keys(j.payload).length > 0 ? (
              <p className="mt-1.5 max-w-[76ch] font-mono text-[12px] leading-[1.5] break-all text-[var(--secondary)]">
                {JSON.stringify(j.payload)}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => retry(j.id)}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-4 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-45"
            >
              {busy === j.id ? "Putting it back" : "Retry it"}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12.5px] leading-[1.55] text-[var(--secondary)]">
        A retry resets the attempts, because somebody retrying by hand has usually fixed what killed
        it. The error stays on the row: what it died of is worth more than a tidy record.
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] text-[var(--red)]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-3 rounded-[3px] bg-[var(--green-bg)] px-3 py-2 text-[13.5px] text-[var(--green)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
