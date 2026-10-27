"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * VOID A SEALED LETTER, SO IT CAN BE REISSUED. Robert's addendum of
 * 2026-10-25, item 2: engineer only, a fresh code, a reason.
 *
 * He picks one of his own live sealed letters, says why the seal is withdrawn,
 * and confirms with a fresh code from his authenticator. The voided letter is
 * then served to nobody, and its determination returns to the letters waiting
 * for his seal above, where sealing it again issues the replacement: the new
 * seal records the one it replaces, and the customer is emailed.
 *
 * The same weight as sealing: one bordered button, no colour. Withdrawing a
 * seal is his professional act, as applying one is.
 */

export type VoidableLetter = { sealActId: string; label: string };

const FIELD =
  "mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate";
const BUTTON =
  "inline-flex min-h-[52px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)] transition-colors hover:border-slate disabled:cursor-not-allowed disabled:opacity-50";

export function VoidSealPanel({ letters }: { letters: VoidableLetter[] }) {
  const router = useRouter();
  const [sealActId, setSealActId] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void", sealActId, reason, code }),
      });
      const body = await res.json().catch(() => ({ ok: false, error: "The server did not answer in a way this screen can read." }));
      if (!body.ok) {
        setError(body.error ?? "That did not work, and the server did not say why.");
        return;
      }
      setDone("The seal is void and the letter is no longer served. Its determination is back in your letters waiting for a seal; sealing it again issues the replacement and emails the customer.");
      setSealActId("");
      setReason("");
      setCode("");
      router.refresh();
    } catch {
      setError("The request did not reach the server. Nothing was voided.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 border-t-2 border-[var(--ink)] pt-4" aria-labelledby="void-seal-heading">
      <h2 id="void-seal-heading" className="text-[16px] font-semibold text-[var(--ink)]">
        Void a sealed letter to reissue it
      </h2>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--secondary)]">
        Only a letter you sealed. The reason is kept on the record with the voiding, and the voiding cannot be undone.
      </p>

      {done ? (
        <p className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]" aria-live="polite">
          {done}
        </p>
      ) : null}

      {letters.length === 0 ? (
        <p className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          You have no live sealed letter. A letter you seal from the list above appears here.
        </p>
      ) : (
        <div className="mt-3">
          <label htmlFor="void-letter" className="block text-[14px] font-semibold text-[var(--ink)]">
            Letter
          </label>
          <select id="void-letter" value={sealActId} onChange={(e) => setSealActId(e.target.value)} className={FIELD}>
            <option value="">Choose a letter</option>
            {letters.map((l) => (
              <option key={l.sealActId} value={l.sealActId}>
                {l.label}
              </option>
            ))}
          </select>

          <label htmlFor="void-reason" className="mt-4 block text-[14px] font-semibold text-[var(--ink)]">
            Why the seal is voided
          </label>
          <textarea id="void-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} />

          <label htmlFor="void-code" className="mt-4 block text-[14px] font-semibold text-[var(--ink)]">
            Code from your authenticator
          </label>
          <input
            id="void-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${FIELD} max-w-[220px]`}
          />
          <div className="mt-3">
            <button
              type="button"
              disabled={busy || !sealActId || reason.trim().length < 10 || code.trim().length < 6}
              onClick={submit}
              className={BUTTON}
            >
              Void the seal
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
