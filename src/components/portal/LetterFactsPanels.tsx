"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * The screens for operator ruling 7 of 2026-10-23 (migration 0085): what a
 * foundation or permit letter prints that somebody records. Every rule is on
 * the server (src/lib/letter-facts.ts and 0085's checks); these only ask.
 */

const FOUNDATION_TYPES = ["slab-on-grade", "pier-and-beam", "crawlspace"] as const;

/** PL-2: the office records the authority's address and salutation before review. */
export function AuthorityDetailsForm({
  fileId,
  authorityName,
  address,
  salutation,
}: {
  fileId: string;
  authorityName: string | null;
  address: string | null;
  salutation: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ authority_address: address ?? "", authority_salutation: salutation ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const changed = (["authority_address", "authority_salutation"] as const).filter(
    (k) => form[k].trim() !== ((k === "authority_address" ? address : salutation) ?? ""),
  );
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (changed.length === 0) return setError("Nothing has changed.");
        setBusy(true);
        setError(null);
        setDone(null);
        for (const fact of changed) {
          const result = await postJson("/api/portal/letter-facts", { action: "office_fact", fileId, fact, value: form[fact] });
          if (!result.ok) {
            setBusy(false);
            return setError(result.error);
          }
        }
        setBusy(false);
        setDone("Recorded. The engineer sees it at review, and the letter prints it as recorded.");
        router.refresh();
      }}
    >
      <p className="text-[14px] leading-[1.55] text-[var(--secondary)] sm:col-span-2">
        The authority, from the order: {authorityName ? <span className="text-[var(--ink)]">{authorityName}</span> : "not given yet"}.
      </p>
      <div className="sm:col-span-2">
        <label htmlFor={`af-address-${fileId}`} className={labelClass}>The authority&apos;s address, as the letter should print it</label>
        <textarea id={`af-address-${fileId}`} rows={3} value={form.authority_address} onChange={(e) => setForm({ ...form, authority_address: e.target.value })} className={`${fieldClass} mt-1.5 py-2`} />
      </div>
      <div>
        <label htmlFor={`af-salutation-${fileId}`} className={labelClass}>The salutation</label>
        <input id={`af-salutation-${fileId}`} value={form.authority_salutation} onChange={(e) => setForm({ ...form, authority_salutation: e.target.value })} className={`${fieldClass} mt-1.5`} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Recording" : "Record the authority's details"}</button>
        <Problem message={error} />
        <Done message={done} />
      </div>
    </form>
  );
}

/** FC-3: the engineer confirms or corrects the foundation type. The confirmed value prints. */
export function FoundationTypeConfirm({ fileId, fromIntake, confirmed }: { fileId: string; fromIntake: string | null; confirmed: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(confirmed ?? (FOUNDATION_TYPES as readonly string[]).find((t) => t === fromIntake) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setDone(null);
        const result = await postJson("/api/portal/letter-facts", { action: "engineer_fact", fileId, fact: "foundation_type", value });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("Confirmed. The letter prints this foundation type.");
        router.refresh();
      }}
    >
      <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
        The customer said: {fromIntake ? <span className="text-[var(--ink)]">{fromIntake}</span> : "nothing"}.{" "}
        {confirmed ? <>You confirmed: <span className="text-[var(--ink)]">{confirmed}</span>.</> : "Not yet confirmed."}
      </p>
      <label htmlFor={`ft-${fileId}`} className={labelClass}>Foundation type, as the evidence shows it</label>
      <select id={`ft-${fileId}`} value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass}>
        <option value="">Choose one</option>
        {FOUNDATION_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <div><button type="submit" disabled={busy || !value} className={primaryClass}>{busy ? "Confirming" : "Confirm the foundation type"}</button></div>
      <Problem message={error} />
      <Done message={done} />
    </form>
  );
}

/** PL-3: the engineer may correct the element described. The reviewed text prints. */
export function ElementDescribedReview({
  fileId,
  category,
  fromIntake,
  reviewed,
}: {
  fileId: string;
  category: string | null;
  fromIntake: string | null;
  reviewed: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(reviewed ?? fromIntake ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setDone(null);
        const result = await postJson("/api/portal/letter-facts", { action: "engineer_fact", fileId, fact: "element_described", value });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("Recorded. The letter names the element in these words.");
        router.refresh();
      }}
    >
      <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
        Category from the order: {category ? <span className="text-[var(--ink)]">{category}</span> : "not given"}.{" "}
        {reviewed ? "You have reviewed the description below." : "The description below is the customer's until you record it."}
      </p>
      <label htmlFor={`el-${fileId}`} className={labelClass}>The element, as the letter should name it</label>
      <textarea id={`el-${fileId}`} rows={2} value={value} onChange={(e) => setValue(e.target.value)} className={`${fieldClass} py-2`} />
      <div><button type="submit" disabled={busy} className={primaryClass}>{busy ? "Recording" : "Record the element"}</button></div>
      <Problem message={error} />
      <Done message={done} />
    </form>
  );
}

/** PL-4 and PL-5: site job or desk job, and the engineer's own capture items. */
export function TriagePanel({
  fileId,
  basis,
  additions,
}: {
  fileId: string;
  basis: "site" | "desk" | null;
  additions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const triage = async (next: "site" | "desk") => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson("/api/portal/letter-facts", { action: "triage", fileId, basis: next });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(next === "site" ? "Recorded as a site job." : "Recorded as a desk job.");
    router.refresh();
  };
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
        {basis ? <>Triaged as a <span className="text-[var(--ink)]">{basis} job</span>. The letter&apos;s basis sentence comes from this record.</> : "Not triaged yet. The letter's basis sentence comes only from this record."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => triage("site")} className={basis === "site" ? primaryClass : ghostClass}>Site job</button>
        <button type="button" disabled={busy} onClick={() => triage("desk")} className={basis === "desk" ? primaryClass : ghostClass}>Desk job</button>
      </div>
      <div>
        <p className={labelClass}>Your items on this job&apos;s capture list, beside the protocol&apos;s</p>
        {additions.length ? (
          <ul className="mt-1.5 flex flex-col gap-1 text-[14px] leading-[1.5] text-[var(--ink)]">
            {additions.map((a) => <li key={a.id}>{a.label}</li>)}
          </ul>
        ) : (
          <p className="mt-1.5 text-[14px] text-[var(--secondary)]">None added. The protocol&apos;s items are the list.</p>
        )}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          setDone(null);
          const result = await postJson("/api/portal/letter-facts", { action: "capture_item", fileId, label });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          setLabel("");
          setDone("Added to this job's capture list.");
          router.refresh();
        }}
      >
        <label htmlFor={`ca-${fileId}`} className={labelClass}>Add an item, in your words</label>
        <input id={`ca-${fileId}`} value={label} onChange={(e) => setLabel(e.target.value)} className={fieldClass} />
        <div><button type="submit" disabled={busy || label.trim().length < 3} className={ghostClass}>Add the item</button></div>
      </form>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
