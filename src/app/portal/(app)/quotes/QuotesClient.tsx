"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * Price a quote request and send it. The figure is shown back and asked about
 * before it goes, because once sent it is what the customer can accept and pay.
 */
export function SendQuoteForm({
  id,
  reference,
  scope: initialScope,
  propertyAddress: initialAddress,
  county: initialCounty,
  defaultDays,
}: {
  id: string;
  reference: string;
  scope: string;
  propertyAddress: string;
  county: string;
  defaultDays: number;
}) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [scope, setScope] = useState(initialScope);
  const [days, setDays] = useState(String(defaultDays));
  const [address, setAddress] = useState(initialAddress);
  const [county, setCounty] = useState(initialCounty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm(`Send ${reference} to the customer at $${price.trim().replace(/^\$/, "")}, holding for ${days} days?`)) return;
        setBusy(true);
        setError(null);
        const result = await postJson("/api/portal/quotes", {
          action: "send",
          id,
          price,
          scope,
          holdDays: Number(days),
          propertyAddress: address,
          county,
        });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("Sent. The customer has the quote by email, with the link that accepts it.");
        router.refresh();
      }}
    >
      <div className="flex flex-wrap gap-4">
        <div className="w-[200px]">
          <label htmlFor={`price-${id}`} className={labelClass}>Price, in dollars</label>
          <input id={`price-${id}`} inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
        <div className="w-[200px]">
          <label htmlFor={`days-${id}`} className={labelClass}>Holds for, in days</label>
          <input id={`days-${id}`} inputMode="numeric" required value={days} onChange={(e) => setDays(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
      </div>
      <div>
        <label htmlFor={`scope-${id}`} className={labelClass}>The scope the price covers, as the customer will read it</label>
        <textarea id={`scope-${id}`} required rows={5} value={scope} onChange={(e) => setScope(e.target.value)} className={`${fieldClass} mt-1.5 w-full`} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[260px] flex-[2]">
          <label htmlFor={`address-${id}`} className={labelClass}>Property address</label>
          <input id={`address-${id}`} required value={address} onChange={(e) => setAddress(e.target.value)} className={`${fieldClass} mt-1.5 w-full`} />
        </div>
        <div className="min-w-[180px] flex-1">
          <label htmlFor={`county-${id}`} className={labelClass}>County</label>
          <input id={`county-${id}`} required value={county} onChange={(e) => setCounty(e.target.value)} className={`${fieldClass} mt-1.5 w-full`} />
        </div>
      </div>
      <div>
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Sending" : "Send the quote"}</button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </form>
  );
}

/** Send a sent quote's email again, unchanged, with a fresh link. */
export function ResendQuoteButton({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] text-[var(--secondary)]">The same price, scope and date, with a new link. Use it when the customer cannot find the first email.</p>
      <div>
        <button
          type="button"
          disabled={busy}
          className={ghostClass}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const result = await postJson("/api/portal/quotes", { action: "resend", id });
            setBusy(false);
            if (!result.ok) return setError(result.error);
            setDone(`The email for ${reference} is on its way again.`);
            router.refresh();
          }}
        >
          {busy ? "Sending" : "Send the email again"}
        </button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

/** Decline a request, with the reason the record keeps. */
export function DeclineQuoteForm({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm(`Decline ${reference}? The customer is not emailed by this; reply to them yourself.`)) return;
        setBusy(true);
        setError(null);
        const result = await postJson("/api/portal/quotes", { action: "decline", id, reason });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("Declined.");
        router.refresh();
      }}
    >
      <div className="min-w-[260px] flex-1">
        <label htmlFor={`decline-${id}`} className={labelClass}>Why, for the record</label>
        <input id={`decline-${id}`} required value={reason} onChange={(e) => setReason(e.target.value)} className={`${fieldClass} mt-1.5 w-full`} />
      </div>
      <button type="submit" disabled={busy} className={ghostClass}>{busy ? "Declining" : "Decline"}</button>
      <div className="w-full"><Problem message={error} /><Done message={done} /></div>
    </form>
  );
}
