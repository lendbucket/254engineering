"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * WITHDRAW OR RESTORE A TECHNICIAN'S CERTIFICATION, FROM THE ENGINEER'S OWN
 * SCREEN. Robert's ruling of 2026-10-29 (WF-017 step 6): engineer only, and the
 * reason is required both ways. The page draws this only for the licence
 * holder, and revokeCertification and restoreCertification refuse anybody else
 * on the server, so hiding it is never the only guard.
 */
export type StandingRow = {
  profileId: string;
  technician: string;
  serviceSlug: string;
  line: string;
  status: "certified" | "revoked";
};

export function CertificationStandingPanel({ rows }: { rows: StandingRow[] }) {
  return (
    <ul className="mt-2 border-t border-[var(--row-rule)]">
      {rows.map((r) => (
        <StandingItem key={`${r.profileId}:${r.serviceSlug}`} row={r} />
      ))}
    </ul>
  );
}

function StandingItem({ row }: { row: StandingRow }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withdrawing = row.status === "certified";
  const fieldId = `standing-${row.profileId}-${row.serviceSlug}`;

  async function decide() {
    if (!reason.trim()) {
      setError(withdrawing ? "Say why you are withdrawing it. The technician is told your reason." : "Say why you are restoring it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: withdrawing ? "revoke_certification" : "restore_certification",
          profileId: row.profileId,
          serviceSlug: row.serviceSlug,
          reason,
        }),
      });
      const out = await res.json().catch(() => ({ ok: false, error: "The answer could not be read." }));
      if (!out.ok) setError(out.error ?? "That was not recorded.");
      else {
        setReason("");
        router.refresh();
      }
    } catch {
      setError("That was not recorded, because the connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-b border-[var(--row-rule)] py-3">
      <p className="text-[14px] text-[var(--ink)]">
        <span className="font-semibold">{row.technician}</span>, {row.line}:{" "}
        {withdrawing ? "certified for dispatch" : "withdrawn, not offered work on this line"}
      </p>
      <label htmlFor={fieldId} className="mt-2 block text-[14px] font-semibold text-[var(--ink)]">
        {withdrawing ? "Your reason for withdrawing it" : "Your reason for restoring it"}
      </label>
      <textarea
        id={fieldId}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-2 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2 text-[14px] text-[var(--ink)]"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide()}
          className="min-h-[44px] rounded-[2px] border border-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--ink)] active:bg-[var(--row-hover)] disabled:opacity-40"
        >
          {withdrawing ? "Withdraw with this reason" : "Restore with this reason"}
        </button>
      </div>
      {!withdrawing ? (
        <p className="mt-2 text-[14px] leading-[1.6] text-[var(--secondary)]">
          Restoring sets the line back to uncertified, so the technician can retake the check. It does not certify them.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-[14px] leading-[1.6] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </li>
  );
}
