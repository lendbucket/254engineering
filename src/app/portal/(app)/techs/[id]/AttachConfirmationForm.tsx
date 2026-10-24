"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Attach the engineer of record's written confirmation of an approval he gave
 * by phone: the text or email as he sent it, and when it arrived (0086,
 * operator ruling of 2026-10-23). Until it is attached the record reads
 * "Written confirmation pending". The rules live in attachRelayedConfirmation
 * on the server; this shows its sentence when it refuses.
 *
 * Design V10: bordered inputs, a square button, no boxes.
 */
export function AttachConfirmationForm({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"text" | "email">("text");
  const [receivedAt, setReceivedAt] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach_relayed_confirmation",
          decisionId,
          kind,
          receivedAt: receivedAt ? new Date(receivedAt).toISOString() : "",
          body,
        }),
      });
      const out = await res.json().catch(() => ({ ok: false, error: "The answer could not be read." }));
      if (!out.ok) setError(out.error ?? "That was not attached.");
      else router.refresh();
    } catch {
      setError("That was not attached, because the connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <fieldset>
        <legend className="text-[13px] font-semibold text-[var(--ink)]">Attach his written confirmation</legend>
        <div className="mt-2 flex gap-6 text-[15px] text-[var(--ink)]">
          {(["text", "email"] as const).map((k) => (
            <label key={k} className="flex min-h-[48px] cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`confirmation-kind-${decisionId}`}
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="h-[18px] w-[18px] accent-[var(--navy)]"
              />
              {k === "text" ? "A text" : "An email"}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`received-${decisionId}`} className="mt-3 block text-[13px] font-semibold text-[var(--ink)]">
        When it arrived
      </label>
      <input
        id={`received-${decisionId}`}
        type="datetime-local"
        value={receivedAt}
        onChange={(e) => setReceivedAt(e.target.value)}
        className="mt-1.5 w-full max-w-[280px] rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] text-[var(--ink)]"
      />
      <label htmlFor={`body-${decisionId}`} className="mt-3 block text-[13px] font-semibold text-[var(--ink)]">
        The text or email, as he sent it
      </label>
      <textarea
        id={`body-${decisionId}`}
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)]"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-3 inline-flex min-h-[48px] items-center rounded-[2px] border border-[var(--border)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)] disabled:opacity-50"
      >
        Attach it
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[14px] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
