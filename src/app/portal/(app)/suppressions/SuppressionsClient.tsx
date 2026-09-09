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
 * Undo a row somebody typed wrong.
 *
 * Only rendered for a row nobody clicked a link to produce. The server refuses
 * the other case against the row itself, whatever this component does, because
 * a screen is a place a filter goes missing.
 */
export function RemoveSuppression({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/portal/suppressions?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !body.ok) {
      setError(body.error ?? "That could not be removed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex min-h-[var(--tap-target)] items-center text-[12.5px] font-semibold text-[var(--navy)] underline disabled:opacity-60"
      >
        {busy ? "Removing" : "Typed in error"}
      </button>
      {error ? (
        <p role="alert" className="max-w-[260px] text-right text-[12px] text-[var(--bad)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
