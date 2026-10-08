"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Storing one seal or signature image, with a fresh code from the
 * authenticator app.
 *
 * The chosen file is never previewed on this screen. The engineer knows what
 * he is uploading; the platform shows nothing back but when it went on file and
 * a short fingerprint, which is the second requirement of ruling 2 of
 * 2026-10-06 applied to the screen that receives the image as well as to every
 * screen after it.
 */
export function SealImageForm({ kind, heading }: { kind: "seal" | "signature"; heading: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const field =
    "mt-1.5 min-h-[48px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";
  const label = "block text-[14px] font-semibold text-[var(--navy)]";
  const fileId = `${kind}-file`;
  const codeId = `${kind}-code`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    form.set("kind", kind);

    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/portal/seal", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; fingerprint?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }
      setDone(`Stored. Fingerprint ${body.fingerprint}.`);
      setBusy(false);
      formEl.reset();
      router.refresh();
    } catch {
      setError("The network dropped that.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div>
        <label htmlFor={fileId} className={label}>{heading}, as a PNG</label>
        <input id={fileId} name="file" type="file" accept="image/png" required className={field} />
      </div>
      <div className="mt-4">
        <label htmlFor={codeId} className={label}>Code from your authenticator app</label>
        <input
          id={codeId}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className={field}
        />
        <p className="mt-1.5 text-[13px] text-[var(--secondary)]">Six digits. A recovery code is not accepted here.</p>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-[14px] font-semibold text-[var(--ink)]">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-4 text-[14px] text-[var(--ink)]">
          {done}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {busy ? "Storing..." : `Store the ${kind}`}
      </button>
    </form>
  );
}
