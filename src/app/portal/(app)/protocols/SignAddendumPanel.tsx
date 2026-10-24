"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The control under a scope addendum's text: a fresh code, then the signature.
 * Operator ruling, 2026-10-22, migration 0082: signed exactly as a protocol is
 * (SignProtocolPanel.tsx is the pattern). The text he signs is shown above this
 * on the server rendered page; this sends only the addendum's id and the code.
 */

const FIELD =
  "mt-1.5 w-full max-w-[220px] rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate";
const BUTTON =
  "inline-flex min-h-[52px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)] transition-colors hover:border-slate disabled:cursor-not-allowed disabled:opacity-50";

export function SignAddendumPanel({ addendumId, label }: { addendumId: string; label: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (done) return <p className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]" aria-live="polite">{done}</p>;

  return (
    <div className="mt-3">
      <label htmlFor={`sign-addendum-${addendumId}`} className="block text-[14px] font-semibold text-[var(--ink)]">
        Code from your authenticator, to sign the scope addendum for {label}
      </label>
      <input
        id={`sign-addendum-${addendumId}`}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={FIELD}
      />
      <div className="mt-3">
        <button
          type="button"
          disabled={busy || code.trim().length < 6}
          className={BUTTON}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch("/api/portal/addenda/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ addendumId, code }),
              });
              const body = await res.json().catch(() => ({ ok: false, error: "The server did not answer in a way this screen can read." }));
              if (!body.ok) setError(body.error ?? "That did not work, and the server did not say why.");
              else {
                setDone(`Signed. The addendum you read is locked under its fingerprint ${String(body.sha256).slice(0, 12)}.`);
                router.refresh();
              }
            } catch {
              setError("The request did not reach the server. Nothing was signed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Sign this addendum
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
