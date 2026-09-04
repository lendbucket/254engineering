"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/portal/surfaces";

type Fault = {
  fingerprint: string;
  title: string;
  culprit: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  inWindow: number;
  muted: boolean;
};

/**
 * The fault list, and the one action on it.
 *
 * WHY MUTING IS THE ONLY CONTROL
 * ------------------------------
 * There is no "resolve" and no "delete". A fault stops appearing here when it
 * stops happening, which is the only honest way for it to leave: a button that
 * cleared a fault would let somebody tidy away a fault that was still firing,
 * and the list would then describe what an operator had dealt with rather than
 * what the platform is doing.
 *
 * Muting exists because some faults are known, understood and not worth an
 * email at eleven at night. It suppresses the alert and nothing else. The row
 * stays, the counter keeps counting, and the chip says muted, so a muted fault
 * cannot hide.
 */
export function StatusClient({ errors, windowMinutes }: { errors: Fault[]; windowMinutes: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleMute(fingerprint: string, muted: boolean) {
    setBusy(fingerprint);
    setError(null);
    try {
      const res = await fetch("/api/portal/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mute", fingerprint, muted }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That did not work.");
        return;
      }
      router.refresh();
    } catch {
      setError("The request did not complete.");
    } finally {
      setBusy(null);
    }
  }

  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: "UTC", hour12: false }) + " UTC";

  return (
    <div>
      <ul className="divide-y divide-limestone-line">
        {errors.map((f) => (
          <li key={f.fingerprint} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <span className="text-[13.5px] font-semibold text-[var(--navy)]">{f.title}</span>
              {f.inWindow > 0 ? (
                <span className="text-[12.5px] font-semibold text-[var(--red)]">
                  {f.inWindow} in the last {windowMinutes} min
                </span>
              ) : null}
              <span className="text-[12.5px] text-[var(--secondary)]">{f.occurrences} in total</span>
              {f.muted ? <Chip label="Muted" tone="neutral" /> : null}
            </div>

            <p className="mt-1 max-w-[80ch] font-mono text-[12px] leading-[1.5] break-all text-[var(--secondary)]">
              {f.fingerprint}
            </p>

            <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--secondary)]">
              First seen {stamp(f.firstSeenAt)}, last seen {stamp(f.lastSeenAt)}
              {f.culprit ? `, in ${f.culprit}` : ""}.
            </p>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => toggleMute(f.fingerprint, !f.muted)}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-4 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-45"
            >
              {busy === f.fingerprint ? "Saving" : f.muted ? "Alert on this again" : "Stop alerting on this"}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 max-w-[80ch] text-[12.5px] leading-[1.55] text-[var(--secondary)]">
        There is no way to clear a fault from this list by hand. It leaves when it stops happening,
        because a list somebody can tidy describes what they have dealt with rather than what the
        platform is doing.
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-[3px] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] text-[var(--red)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
