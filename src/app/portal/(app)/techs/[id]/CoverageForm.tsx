"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Set a working technician's coverage counties. setTechCoverage on the server
 * canonicalises the names and refuses any it does not know, and that sentence
 * is shown as written. One county per line or separated by commas.
 *
 * Design V10: a bordered input, square buttons, no box around the section.
 */
export function CoverageForm({
  profileId,
  current,
  allCounties,
}: {
  profileId: string;
  current: string[];
  allCounties: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(current.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const parse = (value: string) =>
    value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_coverage", profileId, counties: parse(text) }),
      });
      const out = await res.json().catch(() => ({ ok: false, error: "The answer could not be read." }));
      if (!out.ok) {
        setError(out.error ?? "Coverage was not saved.");
      } else {
        const n = (out.counties as string[]).length;
        setDone(`Coverage saved: ${n} count${n === 1 ? "y" : "ies"}.`);
        router.refresh();
      }
    } catch {
      setError("Coverage was not saved, because the connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4">
      <label className="block">
        <span className="text-[13px] font-semibold text-[var(--ink)]">Counties</span>
        <span className="block text-[13px] text-[var(--secondary)]">
          One per line or separated by commas. {parse(text).length} entered.
        </span>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2 text-[15px] leading-[1.5] text-[var(--ink)]"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-[2px] bg-[var(--navy)] px-5 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Saving" : "Save coverage"}
        </button>
        <button
          type="button"
          onClick={() => setText(allCounties.join(", "))}
          className="min-h-[44px] rounded-[2px] border border-[var(--ink)] bg-white px-5 text-[15px] font-semibold text-[var(--ink)]"
        >
          Fill in all {allCounties.length} Texas counties
        </button>
        {done ? (
          <p role="status" className="text-[14px] text-[var(--ink)]">
            {done}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-semibold leading-[1.55] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
