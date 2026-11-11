"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE VISIT CLOCK ON THE JOB. Robert's T6, 2026-11-07, and his answer 4 of the
 * same night (6717223376).
 *
 * Two acts, Arrived and Leaving, and the times the server recorded for each
 * visit. The phone sends which act it is and nothing else; the time shown is
 * the one the database wrote (src/lib/visit-clock-rules.ts).
 *
 * WITH NO SIGNAL, the press is held on this phone with NO TIME ATTACHED: only
 * the act. When signal returns it is sent marked late, the server records its
 * own time of receipt, and the visit list says "recorded when signal returned".
 * The phone's clock is never read for it, so a phone with a wrong clock cannot
 * put a wrong time on the firm's record.
 *
 * The labels are formatted on the server, in the firm's zone, and handed in, so
 * this component never formats a date itself.
 */

type Act = "arrive" | "leave";
const heldKey = (fileId: string) => `eng-visit-held:${fileId}`;

function readHeld(fileId: string): Act | null {
  try {
    const v = window.localStorage.getItem(heldKey(fileId));
    return v === "arrive" || v === "leave" ? v : null;
  } catch {
    return null;
  }
}

export function VisitClock({
  fileId,
  visits,
  onSite,
  canRecord,
  unreadable,
}: {
  fileId: string;
  visits: { arrived: string; arrivedLate: boolean; left: string | null; leftLate: boolean }[];
  onSite: boolean;
  canRecord: boolean;
  unreadable: boolean;
}) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState<Act | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  const send = useCallback(
    async (visit: Act, late: boolean) => {
      if (sending.current) return;
      sending.current = true;
      setError(null);
      setBusy(true);
      try {
        const res = await fetch("/api/portal/field", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "record_visit", fileId, visit, late }),
        });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (late) {
          /* Sent and answered, either way: a refusal is shown, never retried forever. */
          window.localStorage.removeItem(heldKey(fileId));
          setHeld(null);
        }
        if (!res.ok || !body?.ok) {
          setError(body?.error ?? "That was not recorded.");
          return;
        }
        router.refresh();
      } catch {
        setError(late ? "Signal dropped again. It will be sent when signal returns." : "The network dropped that, so nothing was recorded. Press it again.");
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
    [fileId, router],
  );

  useEffect(() => {
    setOnline(navigator.onLine);
    const waiting = readHeld(fileId);
    setHeld(waiting);
    if (waiting && navigator.onLine) void send(waiting, true);
    const up = () => {
      setOnline(true);
      const pending = readHeld(fileId);
      if (pending) void send(pending, true);
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [fileId, send]);

  function press(visit: Act) {
    if (navigator.onLine) {
      void send(visit, false);
      return;
    }
    /* Only the act is kept. No time is written here, by design. */
    try {
      window.localStorage.setItem(heldKey(fileId), visit);
      setHeld(visit);
      setError(null);
    } catch {
      setError("This phone would not hold the press. Press it again when you have signal.");
    }
  }

  const action: Act = onSite ? "leave" : "arrive";
  const label = onSite ? "Leaving" : "Arrived";
  const lateNote = " (recorded when signal returned)";

  return (
    <section aria-labelledby="visit-clock-heading" className="mb-6 border-t-2 border-[var(--ink)] pt-3">
      <h2 id="visit-clock-heading" className="portal-label">
        Visit
      </h2>
      {unreadable ? (
        <p className="mt-1.5 text-[14px] text-[var(--ink)]">The visit record could not be read. Reload the page to try again.</p>
      ) : visits.length === 0 ? (
        <p className="mt-1.5 text-[14px] text-[var(--secondary)]">
          No arrival recorded yet. Press Arrived when you reach the property. The time is the firm&apos;s clock, not the phone&apos;s.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-[14px] text-[var(--ink)]">
          {visits.map((v, i) => (
            <li key={`${v.arrived}-${i}`}>
              Arrived {v.arrived}
              {v.arrivedLate ? lateNote : ""}
              {v.left ? `, left ${v.left}${v.leftLate ? lateNote : ""}` : ", on site now"}
            </li>
          ))}
        </ul>
      )}
      {canRecord && !unreadable ? (
        <div className="mt-3">
          {held ? (
            <p className="text-[14px] font-semibold text-[var(--ink)]">
              {held === "arrive" ? "Arrived" : "Leaving"} is held on this phone. No signal: it will be recorded when signal returns, at the firm&apos;s time then, and marked as late.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => press(action)}
              disabled={busy}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[2px] bg-[var(--ink)] px-5 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Recording..." : label}
            </button>
          )}
          {!online && !held ? (
            <p className="mt-2 text-[14px] text-[var(--ink)]">
              No signal. The time is the firm&apos;s server&apos;s, so a press now is held and recorded when signal returns, marked as late.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
