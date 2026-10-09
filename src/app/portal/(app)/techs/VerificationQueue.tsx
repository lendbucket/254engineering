"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SUBMISSIONS AWAITING VERIFICATION, verified or rejected in one action each.
 * Operator ruling of 2026-10-09. Verify records who and when; reject needs a
 * reason, which the technician reads on their certification screen. Every rule
 * is on the server (ops-credential-submissions.ts); this only asks.
 */
export type QueueRow = {
  id: string;
  name: string;
  label: string;
  detail: string;
  submitted: string;
};

export function VerificationQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  async function act(id: string, action: "verify_credential" | "reject_credential") {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/portal/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, credentialId: id, reason: action === "reject_credential" ? reason : undefined }),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(null);
    if (!body?.ok) {
      setError({ id, text: body?.error ?? "That did not go through. Nothing was changed." });
      return;
    }
    setRejecting(null);
    setReason("");
    router.refresh();
  }

  return (
    <ul className="border-t border-[var(--row-rule)]">
      {rows.map((r) => (
        <li key={r.id} className="border-b border-[var(--row-rule)] py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--ink)]">
                {r.name}: {r.label}
              </p>
              <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                {r.detail}. Submitted {r.submitted}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => act(r.id, "verify_credential")}
                className="inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white disabled:opacity-50"
              >
                Verify
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => {
                  setRejecting(rejecting === r.id ? null : r.id);
                  setReason("");
                  setError(null);
                }}
                className="inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] border border-[var(--border-strong)] bg-white px-4 text-[14px] font-bold text-[var(--ink)] disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
          {rejecting === r.id ? (
            <div className="mt-3">
              <label htmlFor={`reason-${r.id}`} className="block text-[14px] font-semibold text-[var(--ink)]">
                Why, in a sentence the technician can act on
              </label>
              <textarea
                id={`reason-${r.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--ink)]"
              />
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => act(r.id, "reject_credential")}
                className="mt-2 inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] border border-[var(--ink)] bg-white px-4 text-[14px] font-bold text-[var(--ink)] disabled:opacity-50"
              >
                Reject with this reason
              </button>
            </div>
          ) : null}
          {error?.id === r.id ? (
            <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--ink)]">
              {error.text}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
