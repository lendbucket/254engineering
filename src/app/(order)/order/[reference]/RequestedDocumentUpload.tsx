"use client";

import { useState } from "react";

type Slot = { id: string; label: string; help: string | null; photo: boolean };

/**
 * Send one document the firm asked for. Robert's addendum of 2026-10-25, item 4.
 *
 * Three steps, each said when it fails: the server prepares a signed upload for
 * this order and this document, the file goes straight to the firm's private
 * storage, and the server checks it arrived and records it. A plan or document
 * is a PDF up to 40 MB; a photograph slot takes a photograph up to 10 MB. The
 * server decides both, and this only says what it was told.
 */
export function RequestedDocumentUpload({ token, slot }: { token: string; slot: Slot }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputId = `requested-${slot.id}`;

  if (done) {
    return (
      <p role="status" className="text-[15px] leading-[1.6] font-semibold text-[var(--color-ink)]">
        {slot.label}: received. The firm has it on your order.
      </p>
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-[15px] font-semibold text-[var(--color-ink)]">
        {slot.label}
      </label>
      {slot.help ? <p className="mt-1 text-[14px] leading-[1.6] text-[var(--color-ink-quiet)]">{slot.help}</p> : null}
      <p className="mt-1 text-[14px] leading-[1.6] text-[var(--color-ink-quiet)]">
        {slot.photo ? "A photograph, up to 10 MB." : "A PDF, up to 40 MB."}
      </p>
      <input
        id={inputId}
        type="file"
        accept={slot.photo ? "image/*" : "application/pdf"}
        disabled={busy}
        className="mt-3 block min-h-[var(--tap-target)] w-full max-w-full text-[15px] text-[var(--color-ink)]"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const post = (body: Record<string, unknown>) =>
              fetch("/api/order-documents", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token, fieldId: slot.id, ...body }),
              }).then((r) => r.json().catch(() => null)) as Promise<Record<string, unknown> | null>;

            const signed = await post({ action: "sign", filename: file.name, contentType: file.type, size: file.size });
            if (!signed?.ok || typeof signed.uploadUrl !== "string" || typeof signed.storageKey !== "string") {
              setError(typeof signed?.error === "string" ? signed.error : "That file could not be prepared for upload. Try again.");
              return;
            }
            const put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
            if (!put.ok) {
              setError("That file did not upload. Try again, or a smaller one.");
              return;
            }
            const recorded = await post({ action: "record", storageKey: signed.storageKey, contentType: file.type, byteSize: file.size });
            if (!recorded?.ok) {
              setError(typeof recorded?.error === "string" ? recorded.error : "The file arrived and could not be recorded. Try again.");
              return;
            }
            setDone(true);
          } catch {
            setError("That file did not upload, because the connection failed. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy ? <p className="mt-2 text-[14px] text-[var(--color-ink-quiet)]">Sending</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-[15px] leading-[1.6] font-semibold text-[var(--color-ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
