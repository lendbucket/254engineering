"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Recording a request to stop, while the person is still on the telephone.
 *
 * WHY THE REASON IS A REQUIRED FREE TEXT FIELD AND NOT A DROPDOWN
 * ---------------------------------------------------------------
 * 0026 made `because` free text on purpose: the list of ways somebody can ask
 * will grow, and a check constraint on a reason code is a migration every time
 * it does. The screen follows the table. What matters is that the row says how
 * the firm came to believe this person asked, in words somebody can read back
 * to them if they ever say they did not.
 *
 * A dropdown would produce rows reading "other" and answer nothing.
 */

const field =
  "min-h-[44px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";

export function AddSuppression() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [because, setBecause] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const res = await fetch("/api/portal/suppressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, because }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    setBusy(false);
    if (!res.ok || !body.ok) {
      setError(body.error ?? "That could not be recorded. Nothing was changed.");
      return;
    }
    setDone(`${email.trim().toLowerCase()} will not receive marketing.`);
    setEmail("");
    setBecause("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="sup-email" className="mb-1 block text-[13.5px] font-semibold text-[var(--navy)]">
          Email address
        </label>
        <input
          id="sup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="them@theirfirm.com"
        />
      </div>

      <div>
        <label htmlFor="sup-because" className="mb-1 block text-[13.5px] font-semibold text-[var(--navy)]">
          How the request arrived
        </label>
        <input
          id="sup-because"
          type="text"
          required
          minLength={4}
          value={because}
          onChange={(e) => setBecause(e.target.value)}
          className={field}
          placeholder="Asked by telephone, 9 September"
        />
        <p className="mt-1 text-[12px] text-[var(--secondary)]">
          Written down because somebody may one day say they never asked. A row nobody can explain is
          a row nobody can defend.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-[13.5px] font-semibold text-[var(--bad)]">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-[13.5px] font-semibold text-[var(--good)]">
          {done}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:opacity-60"
      >
        {busy ? "Recording" : "Record the request"}
      </button>
    </form>
  );
}

/**
 * Mark a row somebody typed wrong.
 *
 * IT USED TO DELETE THE ROW AND SAY "Removing". 0032 made a consent record
 * undeletable, and the trigger's own message says what to do instead: keep the
 * row and record that it was a mistake. That is better than the delete it
 * replaces, because a deleted typo left no trace that anybody had mistyped.
 *
 * SO THE BUTTON NOW ASKS WHY. 0034 refuses a void with no reason at the
 * database, and the person who knows why is the person standing here. It is one
 * field rather than a dialog because a confirmation step somebody clicks
 * through adds friction without adding a fact.
 *
 * Only rendered for a row nobody clicked a link to produce. The server refuses
 * the other case against the row itself, and 0034 makes it unrepresentable in
 * the schema besides, because a screen is a place a filter goes missing.
 */
export function VoidSuppression({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [because, setBecause] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark() {
    if (!because.trim()) {
      setError("Say what was wrong with it.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/portal/suppressions?email=${encodeURIComponent(email)}&because=${encodeURIComponent(because.trim())}`,
      { method: "DELETE" },
    );
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !body.ok) {
      setError(body.error ?? "That could not be marked.");
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
        className="inline-flex min-h-[var(--tap-target)] items-center text-[12.5px] font-semibold text-[var(--navy)] underline"
      >
        Typed in error
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-[280px] flex-col items-end gap-2">
      <label className="w-full text-left">
        <span className="block text-[12px] font-semibold text-[var(--ink-soft)]">
          What was wrong with it?
        </span>
        <input
          type="text"
          value={because}
          onChange={(e) => setBecause(e.target.value)}
          placeholder="Wrong address typed on the call"
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-[13.5px]"
        />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="inline-flex min-h-[var(--tap-target)] items-center text-[12.5px] font-semibold text-[var(--ink-soft)] underline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={mark}
          disabled={busy}
          className="inline-flex min-h-[var(--tap-target)] items-center text-[12.5px] font-semibold text-[var(--navy)] underline disabled:opacity-60"
        >
          {busy ? "Marking" : "Mark as a mistake"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="w-full text-right text-[12px] text-[var(--bad)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
