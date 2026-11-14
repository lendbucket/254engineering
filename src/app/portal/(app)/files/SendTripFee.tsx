"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Send the trip fee link for a visit the technician could not get into (0134,
 * Robert's answers 7 to 10 of 2026-11-14). sendTripFeeLink decides everything:
 * a fee already waiting is sent again rather than raised twice.
 */
export function SendTripFee({ fileId, again }: { fileId: string; again: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setSaid(null);
          try {
            const res = await fetch("/api/portal/files", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "send_trip_fee", fileId }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; reference?: string } | null;
            if (!res.ok || !body?.ok) {
              setSaid({ ok: false, text: body?.error ?? "That did not work. Nothing was sent." });
              return;
            }
            setSaid({ ok: true, text: `Trip fee link sent for ${body.reference ?? "the visit"}.` });
            router.refresh();
          } catch {
            setSaid({ ok: false, text: "The network dropped that. Nothing was sent." });
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50"
      >
        {busy ? "Sending" : again ? "Send the trip fee link again" : "Send the trip fee link"}
      </button>
      {said ? (
        <p role={said.ok ? "status" : "alert"} className="mt-1.5 text-[14px] font-semibold text-[var(--ink)]">
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
