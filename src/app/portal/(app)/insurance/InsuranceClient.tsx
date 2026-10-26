"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/** The form a policy is recorded through: the certificate's figures and the certificate itself. */
export function RecordPolicyForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="grid max-w-[760px] gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError(null);
        setDone(null);
        try {
          const res = await fetch("/api/portal/insurance", { method: "POST", body: new FormData(form) });
          const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
          if (!res.ok || !body?.ok) {
            setError(typeof body?.error === "string" ? body.error : `The server answered ${res.status} and said nothing more. Nothing was confirmed as recorded.`);
          } else {
            setDone("The policy is recorded with its certificate.");
            form.reset();
            router.refresh();
          }
        } catch {
          setError("The connection dropped before the server answered, so this may not have been recorded. Reload the page and check before trying again.");
        }
        setBusy(false);
      }}
    >
      <div>
        <label htmlFor="ins-kind" className={labelClass}>Kind of cover</label>
        <select id="ins-kind" name="kind" defaultValue="professional_liability" className={`${fieldClass} mt-1.5`}>
          <option value="professional_liability">Professional liability</option>
          <option value="general_liability">General liability</option>
        </select>
      </div>
      <div>
        <label htmlFor="ins-carrier" className={labelClass}>Carrier</label>
        <input id="ins-carrier" name="carrier" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="ins-number" className={labelClass}>Policy number</label>
        <input id="ins-number" name="policyNumber" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="ins-claim" className={labelClass}>Per claim limit, in dollars</label>
        <input id="ins-claim" name="limitPerClaim" inputMode="decimal" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="ins-aggregate" className={labelClass}>Aggregate limit, in dollars</label>
        <input id="ins-aggregate" name="limitAggregate" inputMode="decimal" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="ins-effective" className={labelClass}>Effective date</label>
        <input id="ins-effective" name="effectiveOn" type="date" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="ins-expires" className={labelClass}>Expiry date</label>
        <input id="ins-expires" name="expiresOn" type="date" required className={`${fieldClass} mt-1.5`} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ins-insureds" className={labelClass}>Named insureds, one per line</label>
        <textarea id="ins-insureds" name="namedInsureds" rows={3} required className={`${fieldClass} mt-1.5 py-2`} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ins-certificate" className={labelClass}>Certificate of insurance, PDF</label>
        <input id="ins-certificate" name="certificate" type="file" accept="application/pdf" required className="mt-1.5 block min-h-[44px] text-[14px] text-[var(--ink)]" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Recording" : "Record the policy"}</button>
        <Problem message={error} />
        <Done message={done} />
      </div>
    </form>
  );
}

/** Withdraw a policy, with the reason the record keeps. */
export function WithdrawPolicy({ id }: { id: string }) {
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
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await postJson("/api/portal/insurance", { action: "withdraw", id, reason });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        router.refresh();
      }}
    >
      <div className="min-w-[260px] flex-1">
        <label htmlFor={`withdraw-${id}`} className={labelClass}>Why it is withdrawn</label>
        <input id={`withdraw-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Withdrawing" : "Withdraw the policy"}</button>
      <div className="w-full"><Problem message={error} /></div>
    </form>
  );
}
