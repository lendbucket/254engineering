"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE VISIT CLOCK ON THE JOB. Robert's T6, 2026-11-07.
 *
 * Two buttons, Arrived and Leaving, and the times the server recorded for each
 * visit. The phone sends which act it is and nothing else; the time shown is
 * the one the database wrote (src/lib/visit-clock-rules.ts). With no signal the
 * button says so instead of pretending to record: a time the server never saw
 * is not one this screen will show as recorded.
 *
 * The labels are formatted on the server, in the firm's zone, and handed in, so
 * this component never formats a date itself.
 */
export function VisitClock({
  fileId,
  visits,
  onSite,
  canRecord,
  unreadable,
}: {
  fileId: string;
  visits: { arrived: string; left: string | null }[];
  onSite: boolean;
  canRecord: boolean;
  unreadable: boolean;
}) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  async function record(visit: "arrive" | "leave") {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_visit", fileId, visit }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That was not recorded.");
        return;
      }
      router.refresh();
    } catch {
      setError("The network dropped that, so nothing was recorded. Press it again when you have signal.");
    } finally {
      setBusy(false);
    }
  }

  const action: "arrive" | "leave" = onSite ? "leave" : "arrive";
  const label = onSite ? "Leaving" : "Arrived";

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
              {v.left ? `, left ${v.left}` : ", on site now"}
            </li>
          ))}
        </ul>
      )}
      {canRecord && !unreadable ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void record(action)}
            disabled={busy || !online}
            className="inline-flex min-h-[48px] items-center justify-center rounded-[2px] bg-[var(--ink)] px-5 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Recording..." : label}
          </button>
          {!online ? (
            <p className="mt-2 text-[14px] text-[var(--ink)]">
              No signal. The time is recorded by the firm&apos;s server, so this needs signal. Press it when you have a bar.
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
