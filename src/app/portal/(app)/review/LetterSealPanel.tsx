"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE LETTER WAITING FOR HIS SEAL. Read the draft, then seal it.
 *
 * Sealing piece two. Two steps, in this order and never the other: the
 * engineer reads the letter the platform drafted from his determination, then
 * applies his seal with a fresh code from his authenticator. The draft shows
 * text only; no seal or signature image is ever sent to a browser (control 2
 * in docs/sealing-controls.md).
 *
 * The recipient's address and salutation are the two facts the file does not
 * hold, so he enters them here and they print exactly as typed.
 *
 * Sealing has the same weight as every other control on this screen: one
 * bordered button, no colour, no emphasis. It is his professional act, not a
 * step the screen should hurry him through.
 */

type Line = { kind: string; text: string };

const FIELD =
  "mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate";
const BUTTON =
  "inline-flex min-h-[52px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)] transition-colors hover:border-slate disabled:cursor-not-allowed disabled:opacity-50";

export function LetterSealPanel({
  determinationId,
  determination,
  fileNumber,
}: {
  determinationId: string;
  determination: string;
  fileNumber: string;
}) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [salutation, setSalutation] = useState("");
  const [lines, setLines] = useState<Line[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const call = async (action: "draft" | "seal") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          determinationId,
          recipientAddress: address,
          recipientSalutation: salutation,
          code,
        }),
      });
      const body = await res.json().catch(() => ({ ok: false, error: "The server did not answer in a way this screen can read." }));
      if (!body.ok) {
        setError(body.error ?? "That did not work, and the server did not say why.");
        return;
      }
      if (action === "draft") setLines(body.lines as Line[]);
      else {
        setDone(
          body.warning
            ? `Sealed. ${body.warning}`
            : `Sealed. The letter is locked under its fingerprint ${String(body.sha256).slice(0, 12)} and is available to the customer.`,
        );
        router.refresh();
      }
    } catch {
      setError("The request did not reach the server. Nothing was sealed.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="mt-6 border-t-2 border-[var(--ink)] pt-4" aria-live="polite">
        <h3 className="text-[16px] font-semibold text-[var(--ink)]">Letter for {fileNumber}</h3>
        <p className="mt-2 text-[14px] leading-[1.6] text-[var(--ink)]">{done}</p>
      </section>
    );
  }

  return (
    <section className="mt-6 border-t-2 border-[var(--ink)] pt-4">
      <h3 className="text-[16px] font-semibold text-[var(--ink)]">Letter for {fileNumber}, waiting for your seal</h3>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--secondary)]">
        You recorded a {determination.replace("-", " ")} determination. The letter below is drafted from your own sentence for
        it and from the file. Read it, then seal it with a fresh code from your authenticator. Once sealed it cannot be
        changed; a correction is a new letter.
      </p>

      <label htmlFor={`addr-${determinationId}`} className="mt-4 block text-[14px] font-semibold text-[var(--ink)]">
        Recipient&apos;s address
      </label>
      <textarea
        id={`addr-${determinationId}`}
        rows={2}
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
          setLines(null);
        }}
        className={FIELD}
      />
      <label htmlFor={`sal-${determinationId}`} className="mt-3 block text-[14px] font-semibold text-[var(--ink)]">
        Salutation, as it should print
      </label>
      <input
        id={`sal-${determinationId}`}
        value={salutation}
        onChange={(e) => {
          setSalutation(e.target.value);
          setLines(null);
        }}
        className={FIELD}
      />

      <div className="mt-4">
        <button type="button" disabled={busy} onClick={() => call("draft")} className={BUTTON}>
          Read the draft
        </button>
      </div>

      {lines ? (
        <div className="mt-4 border border-[var(--border)] bg-white px-4 py-3">
          {lines.map((line, i) => (
            <p
              key={i}
              className={`text-[14px] leading-[1.6] text-[var(--ink)] ${line.kind === "heading" || line.kind === "re" ? "mt-3 font-semibold" : "mt-2"}`}
            >
              {line.text}
            </p>
          ))}
        </div>
      ) : null}

      {lines ? (
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
            <button type="button" disabled={busy || code.trim().length < 6} onClick={() => call("seal")} className={BUTTON}>
              Apply my seal
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
