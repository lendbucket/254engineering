"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * A FRANCHISEE'S ONBOARDING CONTROLS (0128). Robert's overnight orders of
 * 2026-11-10, platform item X4. The agreement goes to /api/portal/franchisees;
 * a certificate, with its PDF, to /api/portal/franchisees/certificates. Both
 * ask franchise.manage, which only admin holds.
 */

export function AgreementForm({ id }: { id: string }) {
  const router = useRouter();
  const [signedOn, setSignedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`agreement-${id}`} className={labelClass}>Day the agreement was signed</label>
        <input id={`agreement-${id}`} type="date" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button
        type="button"
        disabled={busy}
        className={primaryClass}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setDone(null);
          const result = await postJson("/api/portal/franchisees", { action: "agreement", id, signedOn });
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone(String(result.said ?? "Recorded."));
          router.refresh();
        }}
      >
        {busy ? "Recording" : "Record the agreement"}
      </button>
      <div className="w-full">
        <Problem message={error} />
        <Done message={done} />
      </div>
    </div>
  );
}

export function CertificateForm({ id, kinds }: { id: string; kinds: { value: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError(null);
        setDone(null);
        try {
          const res = await fetch("/api/portal/franchisees/certificates", { method: "POST", body: new FormData(form) });
          const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
          if (!res.ok || !body?.ok) {
            setError(typeof body?.error === "string" ? body.error : `The server answered ${res.status} and said nothing more. Nothing was confirmed as recorded.`);
          } else {
            setDone("The certificate is recorded with its PDF.");
            form.reset();
            router.refresh();
          }
        } catch {
          setError("The connection dropped before the server answered, so this may not have been recorded. Reload the page and check before trying again.");
        }
        setBusy(false);
      }}
    >
      <input type="hidden" name="franchiseeId" value={id} />
      <div>
        <label htmlFor={`cert-kind-${id}`} className={labelClass}>What it covers</label>
        <select id={`cert-kind-${id}`} name="kind" defaultValue={kinds[0]?.value} className={`${fieldClass} mt-1.5`}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`cert-carrier-${id}`} className={labelClass}>Carrier</label>
        <input id={`cert-carrier-${id}`} name="carrier" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor={`cert-number-${id}`} className={labelClass}>Policy number</label>
        <input id={`cert-number-${id}`} name="policyNumber" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor={`cert-effective-${id}`} className={labelClass}>Effective date</label>
        <input id={`cert-effective-${id}`} name="effectiveOn" type="date" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor={`cert-expires-${id}`} className={labelClass}>Expiry date</label>
        <input id={`cert-expires-${id}`} name="expiresOn" type="date" required className={`${fieldClass} mt-1.5`} />
      </div>
      {/* min-w-0 and max-w-full: a native file input's own width put the insurance form 2px past a 320px screen (board 40308999656). */}
      <div className="min-w-0 max-w-full sm:col-span-2">
        <label htmlFor={`cert-file-${id}`} className={labelClass}>Certificate of insurance, PDF</label>
        <input id={`cert-file-${id}`} name="certificate" type="file" accept="application/pdf" required className="mt-1.5 block min-h-[44px] min-w-0 max-w-full text-[14px] text-[var(--ink)]" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Recording" : "Record the certificate"}</button>
        <Problem message={error} />
        <Done message={done} />
      </div>
    </form>
  );
}

/** Withdraw a certificate, with the reason the record keeps. */
export function WithdrawCertificate({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" className={ghostClass} onClick={() => setOpen(true)}>
        Withdraw
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px]">
        <label htmlFor={`withdraw-${id}`} className={labelClass}>Why it is withdrawn</label>
        <input id={`withdraw-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button
        type="button"
        disabled={busy}
        className={primaryClass}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await postJson("/api/portal/franchisees/certificates", { action: "withdraw", id, reason });
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          router.refresh();
        }}
      >
        {busy ? "Withdrawing" : "Withdraw it"}
      </button>
      <button type="button" className={ghostClass} onClick={() => setOpen(false)}>
        Keep it
      </button>
      <div className="w-full">
        <Problem message={error} />
      </div>
    </div>
  );
}
