"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * NEEDS TRAVEL on the file (Robert's ruling, 2026-11-14). Anyone who can take a
 * job asks; requestTravel raises the administrator's task and holds the link.
 */
export function RequestTravel({ fileId }: { fileId: string }) {
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
              body: JSON.stringify({ action: "request_travel", fileId }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !body?.ok) {
              setSaid({ ok: false, text: body?.error ?? "That did not work. Nothing was asked." });
              return;
            }
            setSaid({ ok: true, text: "Travel requested. The payment link goes when it is set." });
            router.refresh();
          } catch {
            setSaid({ ok: false, text: "The network dropped that. Nothing was asked." });
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50"
      >
        {busy ? "Asking" : "Needs travel"}
      </button>
      {said ? (
        <p role={said.ok ? "status" : "alert"} className="mt-1.5 text-[14px] font-semibold text-[var(--ink)]">
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
