"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
/*
 * From deletion-request-kinds and NOT from deletion-requests, which carries
 * server-only because it reaches the database. Importing it here compiled
 * cleanly and broke the BUILD, and the suite then reported that it could not
 * run at all rather than a list of content failures, which is the runner
 * working the way CLAUDE.md section 6 describes.
 */
import { CHANNELS, type RequestChannel } from "@/lib/deletion-request-kinds";

/**
 * Taking a request while the person is still on the telephone.
 *
 * WHAT THIS FORM WILL NOT LET SOMEBODY DO
 * ----------------------------------------
 * Summarise. The words field is required and it asks for what they said rather
 * than what it amounted to, because a paraphrase is the firm's account of what
 * somebody wanted and this record exists so nobody has to take that on trust
 * later.
 *
 * THE SENTENCE UNDER THE BUTTON IS THE HONEST PART OF THE SCREEN
 * --------------------------------------------------------------
 * Recording a request stops marketing and raises a task. It deletes nothing.
 * A form that said "Request recorded" and stopped there would let the person
 * who took the call believe the thing was done, and they would say so to the
 * next person who rang. So the confirmation names all three outcomes, including
 * the one that has not happened.
 */

const field =
  "min-h-[44px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";

export function TakeRequest() {
  const router = useRouter();
  const [subjectEmail, setSubjectEmail] = useState("");
  const [subjectNote, setSubjectNote] = useState("");
  const [channel, setChannel] = useState<RequestChannel>("telephone");
  const [channelNote, setChannelNote] = useState("");
  const [askedFor, setAskedFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const res = await fetch("/api/portal/deletion-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectEmail, subjectNote, channel, channelNote, askedFor }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      warning?: string | null;
    };

    setBusy(false);
    if (!res.ok || !body.ok) {
      setError(body.error ?? "That could not be recorded. Nothing was changed.");
      return;
    }

    setDone(
      body.warning ??
        `Recorded. ${subjectEmail.trim().toLowerCase()} will receive no more marketing, and a task is waiting for somebody to answer them. Nothing has been deleted.`,
    );
    setSubjectEmail("");
    setSubjectNote("");
    setChannelNote("");
    setAskedFor("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="del-email" className="mb-1 block text-[13.5px] font-semibold text-[var(--navy)]">
          Their email address
        </label>
        <input
          id="del-email"
          type="email"
          required
          value={subjectEmail}
          onChange={(e) => setSubjectEmail(e.target.value)}
          className={field}
          placeholder="what they gave you"
        />
      </div>

      <div>
        <label htmlFor="del-who" className="mb-1 block text-[13.5px] font-semibold text-[var(--navy)]">
          Who are they, as far as you can tell?
        </label>
        <input
          id="del-who"
          type="text"
          value={subjectNote}
          onChange={(e) => setSubjectNote(e.target.value)}
          className={field}
          placeholder="a name, a property, an order number, or nothing"
        />
        <p className="mt-1 text-[12px] text-[var(--secondary)]">
          Optional. Somebody may ask without the firm ever having heard of them, and a record that
          demanded a match would be a record only for people it already knows.
        </p>
      </div>

      <div>
        <label htmlFor="del-channel" className="mb-1 block text-[13.5px] font-semibold text-[var(--navy)]">
          How did it reach the firm?
        </label>
        <select
          id="del-channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value as RequestChannel)}
          className={field}
        >
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {channel === "other" ? (
        <div>
          <label htmlFor="del-channel-note" className="mb-1 block text-[13.5px] font-semibold text-[var(--navy)]">
            Say how
          </label>
          <input
            id="del-channel-note"
            type="text"
            required
            value={channelNote}
            onChange={(e) => setChannelNote(e.target.value)}
            className={field}
            placeholder="through their solicitor, at the counter, forwarded by a partner"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="del-asked" className="mb-1 block text-[13.5px] font-semibold text-[var(--navy)]">
          What did they ask for, in their words?
        </label>
        <textarea
          id="del-asked"
          required
          rows={4}
          value={askedFor}
          onChange={(e) => setAskedFor(e.target.value)}
          className="w-full rounded-[3px] border border-[var(--border)] bg-white p-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate"
          placeholder="as close to what they said as you can manage"
        />
        <p className="mt-1 text-[12px] text-[var(--secondary)]">
          Not a summary. A paraphrase is the firm&apos;s account of what somebody wanted, and this is
          the record that exists so nobody has to take that on trust.
        </p>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-[44px] items-center justify-center rounded-[3px] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Recording" : "Record the request"}
      </button>

      <p className="text-[12px] text-[var(--secondary)]">
        This stops marketing to that address immediately and raises a task for somebody to answer
        them. <span className="font-semibold">It deletes nothing.</span> What the firm may remove is
        a question for counsel, and the only path that removes a record is a retention run an
        administrator plans.
      </p>

      {error ? (
        <p role="alert" className="text-[13px] text-[var(--bad)]">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-[13px] text-[var(--good)]">
          {done}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Recording what the firm said back.
 *
 * There is no status to pick, and that absence is the design. Every value a
 * dropdown could carry here, refused, actioned, partly actioned, is a decision
 * about what the firm may do with an engineering record, and none of those
 * decisions has been made. Shipping one would be this platform inventing the
 * answer and then offering it to somebody as though it were settled.
 *
 * So the answer is a sentence, with a name and a date on it, and the taxonomy
 * arrives when the ruling does.
 */
export function AnswerRequest({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [because, setBecause] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!because.trim()) {
      setError("What was said to them?");
      return;
    }
    setBusy(true);
    setError(null);

    const res = await fetch("/api/portal/deletion-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, because }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    setBusy(false);
    if (!res.ok || !body.ok) {
      setError(body.error ?? "That could not be recorded.");
      return;
    }
    setOpen(false);
    setBecause("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-[var(--navy)] underline"
      >
        Record what was said
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-left">
        <span className="block text-[12px] font-semibold text-[var(--ink-soft)]">
          What was said to them?
        </span>
        <textarea
          rows={3}
          value={because}
          onChange={(e) => setBecause(e.target.value)}
          className="mt-1 w-full rounded-[3px] border border-[var(--border)] bg-white p-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate"
          placeholder="in the words you used with them"
        />
      </label>
      <p className="text-[12px] text-[var(--secondary)]">
        Written once and not edited afterwards. If there is more to say, it belongs where the
        conversation is.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-[var(--secondary)] underline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-[var(--navy)] underline disabled:opacity-60"
        >
          {busy ? "Recording" : "Record it"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-[12px] text-[var(--bad)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
