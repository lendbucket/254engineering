"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROSPECT_TYPES, PROSPECT_TYPE_LABEL } from "@/lib/prospect-import";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

type Details = {
  id: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  prospectType: string;
  followUpOn: string | null;
};

/** Change a prospect's details, follow-up date, owner and status. */
export function EditProspect({ p, actorId, ownerId }: { p: Details; actorId: string; ownerId: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    company: p.company,
    contactName: p.contactName ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    city: p.city ?? "",
    prospectType: p.prospectType,
    followUpOn: p.followUpOn ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function send(payload: Record<string, unknown>, said: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson("/api/portal/prospects", { action: "update", id: p.id, ...payload });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(said);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ details: form }, "Saved.");
        }}
      >
        <div><label htmlFor="e-company" className={labelClass}>Company</label><input id="e-company" value={form.company} onChange={set("company")} className={`${fieldClass} mt-1.5`} /></div>
        <div><label htmlFor="e-contact" className={labelClass}>Contact</label><input id="e-contact" value={form.contactName} onChange={set("contactName")} className={`${fieldClass} mt-1.5`} /></div>
        <div><label htmlFor="e-phone" className={labelClass}>Phone</label><input id="e-phone" type="tel" value={form.phone} onChange={set("phone")} className={`${fieldClass} mt-1.5`} /></div>
        <div><label htmlFor="e-email" className={labelClass}>Email</label><input id="e-email" type="email" value={form.email} onChange={set("email")} className={`${fieldClass} mt-1.5`} /></div>
        <div><label htmlFor="e-city" className={labelClass}>City</label><input id="e-city" value={form.city} onChange={set("city")} className={`${fieldClass} mt-1.5`} /></div>
        <div>
          <label htmlFor="e-type" className={labelClass}>Type</label>
          <select id="e-type" value={form.prospectType} onChange={set("prospectType")} className={`${fieldClass} mt-1.5`}>
            {PROSPECT_TYPES.map((t) => <option key={t} value={t}>{PROSPECT_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div><label htmlFor="e-follow" className={labelClass}>Follow up on</label><input id="e-follow" type="date" value={form.followUpOn} onChange={set("followUpOn")} className={`${fieldClass} mt-1.5`} /></div>
        <div className="flex items-end"><button type="submit" disabled={busy} className={primaryClass}>Save changes</button></div>
      </form>
      <div className="flex flex-wrap gap-2">
        {ownerId !== actorId ? (
          <button type="button" disabled={busy} className={ghostClass} onClick={() => void send({ ownerId: actorId }, "It is yours now.")}>Make it mine</button>
        ) : (
          <button type="button" disabled={busy} className={ghostClass} onClick={() => void send({ ownerId: null }, "Nobody owns it now.")}>Give it up</button>
        )}
        <button type="button" disabled={busy} className={ghostClass} onClick={() => void send({ status: "not_interested" }, "Marked not interested. It leaves the call list.")}>Not interested</button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

export function ReopenProspect({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className={ghostClass}
        onClick={async () => {
          const result = await postJson("/api/portal/prospects", { action: "update", id, status: "open" });
          if (!result.ok) return setError(result.error);
          router.refresh();
        }}
      >
        Open it again
      </button>
      <Problem message={error} />
    </div>
  );
}

/** One click from prospect to commercial account, billed by card, with no credit. */
export function ConvertProspect({ id, company, hasEmail }: { id: string; company: string; hasEmail: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy || !hasEmail}
        className={primaryClass}
        onClick={async () => {
          if (!window.confirm(`Open a commercial account for ${company}? It is billed by card with no credit, and the contact is emailed a link to set a password.`)) return;
          setBusy(true);
          setError(null);
          const result = await postJson("/api/portal/prospects", { action: "convert", id });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          setDone(`${company} is a customer now. The contact has been sent a link to set a password.`);
          router.refresh();
        }}
      >
        {busy ? "Opening the account" : "Convert to a commercial account"}
      </button>
      {!hasEmail ? <p className="mt-2 text-[14px] text-[var(--secondary)]">An account is opened against an email address. Add one above first.</p> : null}
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
