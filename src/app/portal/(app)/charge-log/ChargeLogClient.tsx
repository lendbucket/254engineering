"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The export, and manual time entry.
 *
 * THE EXPORT IS A REAL FILE DOWNLOAD
 * ----------------------------------
 * A GET that returns text/csv with a Content-Disposition, opened in a new tab
 * rather than fetched and reassembled in JavaScript. The thing an engineer
 * wants is a file on their machine to hand to a regulator, and building a blob
 * in the browser to produce the same file is more code that can go wrong
 * between the row and the disk.
 */

const field =
  "min-h-[44px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate";

export function ExportButton({ period }: { period: string }) {
  return (
    <a
      href={`/api/portal/review?period=${encodeURIComponent(period)}`}
      className="inline-flex min-h-[44px] items-center justify-center rounded-[3px] bg-brass px-4 text-[14px] font-bold text-slate-ink transition-colors hover:bg-brass-light"
    >
      Export {period}
    </a>
  );
}

/**
 * Time entered by hand.
 *
 * Always flagged as manual, and the flag is not optional. The measured number
 * and the corrected number are both legitimate and they are not the same kind of
 * fact: one is what the clock saw, the other is what a person says happened. A
 * log that cannot tell them apart is one where the measurement stops meaning
 * anything.
 */
export function TimeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("review");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line px-3 text-[13.5px] font-semibold text-slate hover:border-slate"
      >
        Add time by hand
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/portal/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "record_time",
              kind,
              minutes: Number(minutes),
              note,
            }),
          });
          const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
          if (!res.ok || !body?.ok) {
            setError(body?.error ?? "That did not work.");
            return;
          }
          setOpen(false);
          setMinutes("");
          setNote("");
          router.refresh();
        } catch {
          setError("The network dropped that. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="time-kind" className="block text-[13px] font-semibold text-slate">
            What kind
          </label>
          <select id="time-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`${field} mt-1.5`}>
            <option value="review">Review</option>
            <option value="site_visit">Site visit</option>
            <option value="protocol_authoring">Protocol authoring</option>
            <option value="admin">Administrative</option>
          </select>
        </div>
        <div>
          <label htmlFor="time-minutes" className="block text-[13px] font-semibold text-slate">
            Minutes
          </label>
          <input
            id="time-minutes"
            type="number"
            min={1}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor="time-note" className="block text-[13px] font-semibold text-slate">
            What it was (optional)
          </label>
          <input id="time-note" value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1.5`} />
        </div>
      </div>

      <p className="mt-2 text-[12.5px] leading-[1.5] text-slate-muted">
        Saved as entered by hand, always. Review time recorded by the clock is kept separate.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-[#a3241c]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[3px] bg-brass px-4 text-[14px] font-bold text-slate-ink disabled:opacity-50"
        >
          {busy ? "Saving" : "Save time"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line px-4 text-[14px] font-semibold text-slate"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
