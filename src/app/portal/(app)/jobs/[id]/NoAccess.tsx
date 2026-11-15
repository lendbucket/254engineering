"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * COULD NOT GET IN. Robert's answers 7 to 10 of 2026-11-14 (E5), 0134.
 *
 * Drawn only for the assigned technician on a job he has not started capturing,
 * the rule recordNoAccess asks again on the server. Two presses on purpose: the
 * first opens the note, the second records it, because this takes the job off
 * his schedule and charges the customer a trip fee, and a pocket press should
 * do neither.
 */
export function NoAccess({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  async function record() {
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_no_access", fileId, note }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setSaid({ ok: false, text: body?.error ?? "That did not record. Nothing was changed." });
        return;
      }
      setSaid({ ok: true, text: "Recorded. The job is off your schedule and the office will book it again." });
      router.refresh();
    } catch {
      setSaid({ ok: false, text: "The network dropped that. Nothing was recorded; try again when you have signal." });
    } finally {
      setBusy(false);
    }
  }

  if (said?.ok) {
    return (
      <p role="status" className="mb-6 border-t-2 border-[var(--ink)] pt-3 text-[15px] font-semibold text-[var(--ink)]">
        {said.text}
      </p>
    );
  }

  return (
    <section aria-labelledby="no-access" className="mb-6 border-t-2 border-[var(--border)] pt-3">
      <h2 id="no-access" className="portal-label">
        Could not get in
      </h2>
      {open ? (
        <div className="mt-2 flex max-w-[60ch] flex-col gap-2">
          <label htmlFor="no-access-note" className="text-[14px] text-[var(--ink)]">
            What happened: who you called, what was locked. The office reads this, and the customer is charged a trip fee.
          </label>
          <textarea
            id="no-access-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-[2px] border border-[var(--border)] bg-white p-3 text-[15px] text-[var(--ink)]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || note.trim().length < 3}
              onClick={() => void record()}
              className="inline-flex min-h-[48px] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Recording" : "Record that I could not get in"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[48px] items-center rounded-[2px] border border-[var(--border)] px-4 text-[15px] font-semibold text-[var(--navy)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex min-h-[48px] items-center rounded-[2px] border border-[var(--border)] px-4 text-[15px] font-semibold text-[var(--navy)]"
        >
          I could not get in
        </button>
      )}
      {said && !said.ok ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--ink)]">
          {said.text}
        </p>
      ) : null}
    </section>
  );
}
