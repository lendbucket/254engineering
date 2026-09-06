"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sending something to the firm to look at.
 *
 * THE FORM DOES NOT REFUSE, AND THE SCREEN SAYS SO
 * ------------------------------------------------
 * A partner sending copy in is asking whether it is allowed. A form that
 * rejected it because the answer is no would mean the firm never sees the thing
 * the partner was about to publish anyway, and the partner learns only that the
 * form is broken.
 *
 * So it always sends, and what comes back is the firm's automated read of it,
 * shown immediately. A person still looks.
 */
export function SubmitForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"copy" | "artwork" | "page" | "other">("copy");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setAdvice(null);

    try {
      const res = await fetch("/api/partner/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, body, link }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; advice?: string }
        | null;

      if (!res.ok || !payload?.ok) {
        setError(payload?.error ?? "That did not send. Try again.");
        setBusy(false);
        return;
      }

      setAdvice(payload.advice ?? null);
      setTitle("");
      setBody("");
      setLink("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]";

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="kind" className="block text-[13.5px] font-semibold text-[var(--ink)]">
        What is it
      </label>
      <select
        id="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
        className={field}
      >
        <option value="copy">Wording for my own site or an email</option>
        <option value="artwork">Artwork carrying both marks</option>
        <option value="page">A page I have already published</option>
        <option value="other">Something else</option>
      </select>

      <label htmlFor="title" className="mt-4 block text-[13.5px] font-semibold text-[var(--ink)]">
        Title
      </label>
      <input
        id="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={field}
      />

      <label htmlFor="body" className="mt-4 block text-[13.5px] font-semibold text-[var(--ink)]">
        The wording
      </label>
      <textarea
        id="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className={`${field} min-h-[120px] py-2 leading-[1.6]`}
      />

      <label htmlFor="link" className="mt-4 block text-[13.5px] font-semibold text-[var(--ink)]">
        Or a link to where it is
      </label>
      <input
        id="link"
        type="url"
        inputMode="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://"
        className={field}
      />

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.5] text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      {advice ? (
        <p className="mt-4 rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--gold-wash)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--warn-ink)]">
          Sent. {advice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
      >
        {busy ? "Sending" : "Send for approval"}
      </button>
    </form>
  );
}
