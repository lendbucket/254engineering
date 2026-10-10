"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInFirmZone } from "@/lib/firm-calendar";

/**
 * How much of a dead job's payload this screen prints.
 *
 * Enough for the identifying front of it, which is what somebody reading a
 * dead letter row is looking for: the id, the kind, and who it is about.
 * Deliberately not enough for a rendered email body, which is what made this
 * screen 38,744 pixels tall before there was a cap.
 */
const PAYLOAD_CHARS = 400;

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
              <span className="text-[14px] font-semibold text-[var(--ink)]">{j.kind}</span>
              <span className="text-[12px] text-[var(--secondary)]">#{j.id}</span>
              <span className="text-[13px] text-[var(--secondary)]">
                {j.attempts} of {j.maxAttempts} attempts
              </span>
              {j.finishedAt ? (
                <span className="text-[13px] text-[var(--secondary)]">
                  gave up {(formatInFirmZone(j.finishedAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) ?? "")}
                </span>
              ) : null}
            </div>

            <p className="mt-2 max-w-[80ch] rounded-[2px] px-3 py-2 text-[14px] leading-[1.55] text-[var(--ink)]">
              {j.lastError || "No error was recorded, which is itself worth looking at."}
            </p>

            {/*
              Wrapped rather than scrolled. A payload on one nowrap line inside
              an overflow container is clipped at 390 with nothing saying it can
              be scrolled, and the identifier that got cut off is exactly the
              one somebody is reading the row to find.

              AND CAPPED, WHICH THE PARAGRAPH ABOVE MADE NECESSARY.

              Wrapping is right for a payload of a few hundred characters and it
              is what turned this screen into a wall. An email.send payload
              carries the whole rendered HTML body of the message, so eight of
              them wrapped rather than clipped made the Job queue 38,744 pixels
              tall at 1280: a grey slab of doctype declarations with the actual
              queue somewhere inside it. Found overnight on 2026-09-10 by
              looking at the screenshot.

              The cap does not fight the reasoning above, it completes it. What
              somebody reads a row to find is at the FRONT of the payload, the
              id and the kind and who it is about, and JSON.stringify puts it
              there. What is cut is the tail, which is the body nobody is
              reading in a queue screen.

              The count of what was cut is stated, because a truncation nobody
              is told about is the same screen lying more quietly.
            */}
            {Object.keys(j.payload).length > 0 ? (
              <p className="mt-1.5 max-w-[76ch] text-[12px] leading-[1.5] break-all text-[var(--secondary)]">
                {JSON.stringify(j.payload).slice(0, PAYLOAD_CHARS)}
                {/*
                  --secondary, NOT --muted, and the board is why.

                  The first version of this note used var(--muted), which
                  measures #8a93a0 on white at 3.1:1. contrast-audit went red on
                  nine instances of it at 12px, needing 4.5:1, on the very
                  screen this fix was written to make readable. DESIGN_SPEC
                  section 2 is the standing rule and AA wins wherever a token
                  and accessibility disagree.

                  The note is set apart by being sans rather than mono, and by
                  its brackets, rather than by being fainter. A truncation
                  notice nobody can read is the truncation going unannounced.
                */}
                {JSON.stringify(j.payload).length > PAYLOAD_CHARS ? (
                  <span className="font-sans not-italic text-[var(--secondary)]">
                    {` [${(JSON.stringify(j.payload).length - PAYLOAD_CHARS).toLocaleString("en-US")} more characters, not shown]`}
                  </span>
                ) : null}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => retry(j.id)}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold text-[var(--ink)] disabled:opacity-45"
            >
              {busy === j.id ? "Putting it back" : "Retry it"}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[13px] leading-[1.55] text-[var(--secondary)]">
        A retry resets the attempts, because somebody retrying by hand has usually fixed what killed
        it. The error stays on the row: what it died of is worth more than a tidy record.
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-[2px] px-3 py-2 text-[14px] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-3 border-l-2 border-[var(--ink)] py-1 pl-3 text-[14px] font-semibold text-[var(--ink)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
