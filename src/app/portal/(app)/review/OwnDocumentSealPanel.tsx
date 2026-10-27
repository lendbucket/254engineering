"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE SPECIFICATION WAITING FOR HIS SEAL. Upload it, read it, then seal it.
 *
 * Robert's ruling of 2026-10-25, 23:51 Central, item C; controls 12 to 17 in
 * docs/sealing-controls.md. A repair specification is his own document, so the
 * platform drafts nothing: he uploads his PDF straight to private storage,
 * opens the preview, which is his pages unchanged and one page added with the
 * letterhead, the firm's registration and the seal block, and then seals it
 * with a fresh code. No seal or signature image is ever sent to a browser
 * (control 2); the preview shows outlined boxes where they will go.
 *
 * Sealing has the same weight as every other control on this screen, as on the
 * letter panel: one bordered button, no colour, no emphasis.
 */

type Preview = {
  url: string;
  previewSha256: string;
  pages: number;
  title: string;
  letterhead: { brand: string; registrationLine: string };
  sealBlock: { name: string; licenseNumber: string; role: string };
};

const FIELD =
  "mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate";
const BUTTON =
  "inline-flex min-h-[52px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)] transition-colors hover:border-slate disabled:cursor-not-allowed disabled:opacity-50";

export function OwnDocumentSealPanel({ determinationId, fileNumber }: { determinationId: string; fileNumber: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [opened, setOpened] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/portal/letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ determinationId, ...body }),
    });
    return res.json().catch(() => ({ ok: false, error: "The server did not answer in a way this screen can read." }));
  };

  const uploadAndPreview = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setOpened(false);
    try {
      const signed = await post({ action: "own-upload", contentType: file.type, size: file.size });
      if (!signed.ok) {
        setError(signed.error ?? "The upload could not be prepared, and the server did not say why.");
        return;
      }
      const put = await fetch(signed.url as string, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!put.ok) {
        setError(`The PDF did not upload: storage answered ${put.status}. Nothing was changed.`);
        return;
      }
      const shown = await post({ action: "own-preview" });
      if (!shown.ok) {
        setError(shown.error ?? "The preview could not be made, and the server did not say why.");
        return;
      }
      setPreview(shown as Preview);
    } catch {
      setError("The request did not reach the server. Nothing was sealed.");
    } finally {
      setBusy(false);
    }
  };

  const seal = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const sealed = await post({ action: "own-seal", code, previewSha256: preview.previewSha256 });
      if (!sealed.ok) {
        setError(sealed.error ?? "That did not work, and the server did not say why.");
        return;
      }
      setDone(
        sealed.warning
          ? `Sealed. ${sealed.warning}`
          : `Sealed. The specification is locked under its fingerprint ${String(sealed.sha256).slice(0, 12)} and is available to the customer.`,
      );
      router.refresh();
    } catch {
      setError("The request did not reach the server. Nothing was sealed.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="mt-6 border-t-2 border-[var(--ink)] pt-4" aria-live="polite">
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">Repair specification for {fileNumber}</h3>
        <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink)]">{done}</p>
      </section>
    );
  }

  return (
    <section className="mt-6 border-t-2 border-[var(--ink)] pt-4">
      <h3 className="text-[16px] font-semibold text-[var(--ink)]">Repair specification for {fileNumber}, waiting for your seal</h3>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--secondary)]">
        You recorded a pass determination. Upload your specification as a PDF. The platform adds one final page with the
        letterhead, the firm&apos;s registration and your seal block, and changes nothing on your pages. Open the preview and
        read it in full, then seal it with a fresh code from your authenticator. Once sealed it cannot be changed; a
        correction is a new specification.
      </p>

      <label htmlFor={`spec-${determinationId}`} className="mt-4 block text-[14px] font-semibold text-[var(--ink)]">
        Your specification, as a PDF of up to 25 MB
      </label>
      <input
        id={`spec-${determinationId}`}
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPreview(null);
          setOpened(false);
        }}
        className={FIELD}
      />
      <div className="mt-4">
        <button type="button" disabled={busy || !file} onClick={uploadAndPreview} className={BUTTON}>
          Upload and make the preview
        </button>
      </div>

      {preview ? (
        <div className="mt-4 border-y border-[var(--border)] py-3">
          <p className="text-[14px] leading-[1.6] text-[var(--ink)]">
            {preview.title}, {preview.pages} pages: your {preview.pages - 1} and the seal page.
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink)]">
            <a href={preview.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} className="font-semibold underline">
              Open the preview
            </a>
            <span className="text-[var(--secondary)]">, a link that works for ten minutes.</span>
          </p>
          {/* Worded as letter-pdf.ts prints them; the date is the moment you seal. */}
          <div className="mt-3 border-t border-[var(--border)] pt-2">
            <p className="text-[15px] font-semibold text-[var(--ink)]">{preview.letterhead.brand}</p>
            <p className="text-[13px] leading-[1.5] text-[var(--secondary)]">{preview.letterhead.registrationLine}</p>
            <p className="mt-2 text-[13px] leading-[1.5] text-[var(--secondary)]">Your seal and signature are applied on the seal page when you seal.</p>
            <p className="mt-1 text-[14px] font-semibold text-[var(--ink)]">{preview.sealBlock.name}, P.E.</p>
            <p className="text-[14px] leading-[1.5] text-[var(--ink)]">Texas P.E. No. {preview.sealBlock.licenseNumber}</p>
            <p className="text-[14px] leading-[1.5] text-[var(--ink)]">{preview.sealBlock.role}</p>
            <p className="text-[14px] leading-[1.5] text-[var(--ink)]">Date: the day you seal</p>
          </div>
        </div>
      ) : null}

      {preview && opened ? (
        <div className="mt-4">
          <label htmlFor={`code-${determinationId}`} className="block text-[14px] font-semibold text-[var(--ink)]">
            Code from your authenticator
          </label>
          <input
            id={`code-${determinationId}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${FIELD} max-w-[220px]`}
          />
          <div className="mt-3">
            <button type="button" disabled={busy || code.trim().length < 6} onClick={seal} className={BUTTON}>
              Apply my seal
            </button>
          </div>
        </div>
      ) : preview ? (
        <p className="mt-4 text-[14px] leading-[1.6] text-[var(--secondary)]">Open the preview to read it before sealing.</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
