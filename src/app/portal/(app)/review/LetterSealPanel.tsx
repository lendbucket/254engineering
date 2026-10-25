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
/* L2d: what the letter carries around its lines, as text, and the digest sealing checks. */
type Frame = {
  letterhead: { brand: string; registrationLine: string };
  sealBlock: { name: string; licenseNumber: string; role: string };
  /* The page a roof B or C letter calls attached, sealed in the same PDF (F14, L2f). */
  attachment: { heading: string; lines: string[] } | null;
  draftSha256: string;
};

const FIELD =
  "mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate";
const BUTTON =
  "inline-flex min-h-[52px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)] transition-colors hover:border-slate disabled:cursor-not-allowed disabled:opacity-50";

export function LetterSealPanel({
  determinationId,
  determination,
  fileNumber,
  protocol = "254-RC-001",
}: {
  determinationId: string;
  determination: string;
  fileNumber: string;
  /*
   * Which letter (ruling 7 of 2026-10-23). The roof and foundation letters
   * take the recipient's address and salutation here; the permit letter's
   * come from what the office recorded. The foundation letter also takes his
   * observed condition, which the platform does not write.
   */
  protocol?: string;
}) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [salutation, setSalutation] = useState("");
  const [observed, setObserved] = useState("");
  const asksRecipient = protocol !== "254-PL-001";
  const asksObserved = protocol === "254-FC-001";
  const [lines, setLines] = useState<Line[] | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
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
          observedCondition: observed,
          code,
          /* Sealing seals only the draft read here (L2d): its digest, and the lines shown, so a change can be named. */
          ...(action === "seal" && frame && lines ? { previewSha256: frame.draftSha256, previewLines: lines } : {}),
        }),
      });
      const body = await res.json().catch(() => ({ ok: false, error: "The server did not answer in a way this screen can read." }));
      if (!body.ok) {
        setError(body.error ?? "That did not work, and the server did not say why.");
        return;
      }
      if (action === "draft") {
        setLines(body.lines as Line[]);
        setFrame({ letterhead: body.letterhead, sealBlock: body.sealBlock, attachment: body.attachment ?? null, draftSha256: body.draftSha256 } as Frame);
      } else {
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

      {asksRecipient ? (
        <>
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
        </>
      ) : (
        <p className="mt-4 text-[14px] leading-[1.6] text-[var(--secondary)]">
          The authority&apos;s address and salutation are the ones the office recorded on the file.
        </p>
      )}
      {asksObserved ? (
        <>
          <label htmlFor={`obs-${determinationId}`} className="mt-3 block text-[14px] font-semibold text-[var(--ink)]">
            Observed condition, in your words
          </label>
          <textarea
            id={`obs-${determinationId}`}
            rows={4}
            value={observed}
            onChange={(e) => {
              setObserved(e.target.value);
              setLines(null);
            }}
            className={FIELD}
          />
        </>
      ) : null}

      <div className="mt-4">
        <button type="button" disabled={busy} onClick={() => call("draft")} className={BUTTON}>
          Read the draft
        </button>
      </div>

      {lines ? (
        <div className="mt-4 border-y border-[var(--border)] py-3">
          {/* The letterhead it will carry (L2d), as text: the mark prints on the sealed PDF from the bytes in code. */}
          {frame ? (
            <div className="border-b border-[var(--border)] pb-2">
              <p className="text-[15px] font-semibold text-[var(--ink)]">{frame.letterhead.brand}</p>
              <p className="text-[13px] leading-[1.5] text-[var(--secondary)]">{frame.letterhead.registrationLine}</p>
            </div>
          ) : null}
          {lines.map((line, i) => (
            <p
              key={i}
              className={`text-[14px] leading-[1.6] text-[var(--ink)] ${line.kind === "heading" || line.kind === "re" ? "mt-3 font-semibold" : "mt-2"}`}
            >
              {line.text}
            </p>
          ))}
          {/* The seal block it will carry (L2d). No seal or signature image is sent here (control 2); the date is the moment you seal. */}
          {frame ? (
            <div className="mt-4 border-t border-[var(--border)] pt-2">
              <p className="text-[13px] leading-[1.5] text-[var(--secondary)]">Your seal and signature are applied here when you seal.</p>
              {/* Worded as letter-pdf.ts prints them. */}
              <p className="mt-1 text-[14px] font-semibold text-[var(--ink)]">{frame.sealBlock.name}, P.E.</p>
              <p className="text-[14px] leading-[1.5] text-[var(--ink)]">Texas P.E. No. {frame.sealBlock.licenseNumber}</p>
              <p className="text-[14px] leading-[1.5] text-[var(--ink)]">{frame.sealBlock.role}</p>
              <p className="text-[14px] leading-[1.5] text-[var(--ink)]">Date: the day you seal</p>
            </div>
          ) : null}
          {/* The attached page, as it prints after the seal block in the same sealed PDF (F14, L2f). */}
          {frame?.attachment ? (
            <div className="mt-4 border-t border-[var(--border)] pt-2">
              <p className="text-[13px] leading-[1.5] text-[var(--secondary)]">A second page of the same sealed document:</p>
              <p className="mt-1 text-[14px] font-semibold text-[var(--ink)]">{frame.attachment.heading}</p>
              {frame.attachment.lines.map((text, i) => (
                <p key={i} className="mt-1.5 text-[14px] leading-[1.6] text-[var(--ink)]">
                  {text}
                </p>
              ))}
            </div>
          ) : null}
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
