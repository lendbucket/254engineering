"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Send the job's waiting payment link again (the Killeen call, item 3). The
 * same order and the same checkout; resendPaymentLink refuses a second order.
 */
export function ResendPaymentLink({ fileId }: { fileId: string }) {
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
              body: JSON.stringify({ action: "resend_payment_link", fileId }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; reference?: string } | null;
            if (!res.ok || !body?.ok) {
              setSaid({ ok: false, text: body?.error ?? "That did not work. Nothing was sent." });
              return;
            }
            setSaid({ ok: true, text: `Sent again for ${body.reference ?? "the order"}.` });
            router.refresh();
          } catch {
            setSaid({ ok: false, text: "The network dropped that. Nothing was sent." });
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50"
      >
        {busy ? "Sending" : "Send the payment link again"}
      </button>
      {said ? (
        <p role={said.ok ? "status" : "alert"} className="mt-1.5 text-[13.5px] font-semibold text-[var(--ink)]">
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
