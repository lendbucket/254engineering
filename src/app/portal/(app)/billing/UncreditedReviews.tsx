"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/ops-money";

/**
 * A DECIDED REVIEW THAT CREDITED THE ENGINEER NOTHING, AND THE ONE CONTROL THAT
 * FIXES IT. Operator ruling 2 of 2026-10-10.
 *
 * One row per review. Where the file does not record which deliverable it is,
 * the office chooses it here and that is recorded on the file; the credit is
 * then written at the tier in src/config/engineer-pay.ts. Where the credit was
 * simply due and never written, the button writes it.
 */
export type UncreditedRow = {
  sessionId: string;
  fileId: string;
  fileNumber: string;
  decision: string;
  missing: string | null;
  choices: string[];
  dueCents: number | null;
};

const field =
  "min-h-[var(--tap-target)] rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--ink)]";

export function UncreditedReviews({ rows }: { rows: UncreditedRow[] }) {
  return (
    <ul className="divide-y divide-[var(--row-rule)]">
      {rows.map((row) => (
        <Row key={row.sessionId} row={row} />
      ))}
    </ul>
  );
}

function Row({ row }: { row: UncreditedRow }) {
  const router = useRouter();
  const [choice, setChoice] = useState(row.choices[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsChoice = row.dueCents === null && row.choices.length > 1;

  async function credit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "credit", fileId: row.fileId, deliverable: needsChoice ? choice : null }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        return;
      }
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="text-[14px] font-semibold text-[var(--ink)]">
        {row.fileNumber}, {row.decision === "refuse" ? "declined to seal" : row.decision}
      </p>
      <p className="mt-1 text-[13px] leading-[1.6] text-[var(--secondary)]">
        {row.missing
          ? `Missing: ${row.missing}.`
          : `A credit of ${money(row.dueCents)} is due and was never written.`}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {needsChoice ? (
          <label className="flex items-center gap-2 text-[14px] text-[var(--ink)]">
            Deliverable
            <select value={choice} onChange={(e) => setChoice(e.target.value)} className={field}>
              {row.choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={credit}
          className="inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Crediting" : needsChoice ? "Record and credit" : "Credit this review"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </li>
  );
}
