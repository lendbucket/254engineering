"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * The owner drafts a scope addendum for one deliverable the engineer's agreement
 * leaves out. Robert's ruling of 2026-10-26, 07:10 Central (0095): line, amount,
 * text. The database writes the text he signs from these and its hash; drafting
 * opens nothing and pays nothing until he signs it from his own session.
 */
export function AddendumDraftForm({
  deliverable,
  label,
  defaultPay,
  defaultScope,
}: {
  deliverable: string;
  label: string;
  defaultPay: string;
  defaultScope: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const id = deliverable.replace(/[^a-z0-9]+/g, "-");
  return (
    <form
      className="mt-3 grid max-w-[760px] gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        setDone(null);
        const result = await postJson("/api/portal/addenda/draft", {
          deliverable,
          payDollars: String(form.get("payDollars") ?? ""),
          scope: String(form.get("scope") ?? ""),
        });
        setBusy(false);
        if (!result.ok) setError(result.error);
        else {
          setDone(`The addendum for ${label} is drafted and waits for the engineer's signature. Nothing opens until he signs it.`);
          router.refresh();
        }
      }}
    >
      <div className="min-w-0">
        <label htmlFor={`pay-${id}`} className={labelClass}>His pay per job, in dollars</label>
        <input id={`pay-${id}`} name="payDollars" inputMode="decimal" defaultValue={defaultPay} required className={`${fieldClass} mt-1.5 max-w-[220px]`} />
      </div>
      <div className="min-w-0">
        <label htmlFor={`scope-${id}`} className={labelClass}>What the pay covers, in plain words. It is printed as you write it.</label>
        <textarea id={`scope-${id}`} name="scope" rows={4} defaultValue={defaultScope} required className={`${fieldClass} mt-1.5 py-2`} />
      </div>
      <div>
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Drafting" : "Draft the addendum for his signature"}</button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </form>
  );
}
