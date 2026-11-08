"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE ENGINEER'S REQUEST, AT THE TOP OF THE JOB, AND THE TECHNICIAN'S ANSWER.
 * Robert's T5 and his answer 3 of 2026-11-07 (6717223376).
 *
 * The note is what the engineer wrote when he sent the package back. The reply
 * is saved as a file event the engineer reads in review. A package that came
 * back is submitted again only once it is answered, which the server decides
 * (resubmitRefusal in src/lib/revision-rules.ts); this screen says what is
 * still needed and does not decide it.
 *
 * Times arrive formatted, in the firm's zone, from the server.
 */
export function RevisionAnswer({
  fileId,
  note,
  requestedAt,
  reply,
  repliedAt,
  question,
  canReply,
}: {
  fileId: string;
  note: string;
  requestedAt: string;
  reply: string | null;
  repliedAt: string | null;
  question: boolean;
  canReply: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply_revision", fileId, reply: text }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "The reply was not sent.");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("The network dropped that, so the reply was not sent. Send it again when you have signal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="revision-heading" className="mb-6 border-t-2 border-[var(--ink)] pt-3">
      <h2 id="revision-heading" className="portal-label">
        Sent back by the engineer, {requestedAt}
      </h2>
      <p className="mt-1.5 max-w-[70ch] whitespace-pre-line text-[15px] leading-[1.55] font-semibold text-[var(--ink)]">{note}</p>

      {reply ? (
        <div className="mt-3">
          <p className="portal-label">Your reply, {repliedAt}</p>
          <p className="mt-1 max-w-[70ch] whitespace-pre-line text-[14px] leading-[1.55] text-[var(--ink)]">{reply}</p>
        </div>
      ) : null}

      {canReply ? (
        <div className="mt-3">
          <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
            {question
              ? "The engineer asked a question. Answer it here; if the answer needs a photograph, capture it below too. Then submit again."
              : "Capture what the engineer asked for below, then reply here saying what you did. Both are needed before you submit again."}
          </p>
          <label htmlFor="revision-reply" className="mt-2 block text-[14px] font-semibold text-[var(--ink)]">
            {reply ? "Add to your reply" : "Your reply to the engineer"}
          </label>
          <textarea
            id="revision-reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1 block w-full max-w-[70ch] rounded-[2px] border border-[var(--border)] bg-white p-3 text-[15px] text-[var(--ink)]"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || text.trim().length < 3}
            className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-[2px] bg-[var(--ink)] px-5 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send reply"}
          </button>
          {error ? (
            <p role="alert" className="mt-2 text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
