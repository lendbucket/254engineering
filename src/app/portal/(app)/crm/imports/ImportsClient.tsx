"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRM_VERTICALS, VERTICAL_LABEL } from "@/lib/crm-rules";
import { telLink } from "@/lib/phone-link";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * THE IMPORTS SCREEN'S ACTS. Robert's sales CRM ruling of 2026-11-02, item R2.
 * Each posts to /api/portal/crm/imports, which audits it; nothing here writes
 * on its own, and every answer is the server's sentence.
 */

const ENDPOINT = "/api/portal/crm/imports";

/** Preview one source now. Writes nothing to the list: the preview opens, and a person presses Write there. */
export function PreviewButton({ source, label }: { source: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        className={ghostClass}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await postJson(ENDPOINT, { action: "preview", source });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          router.push(`/portal/crm/imports?run=${String((result as unknown as { runId: string }).runId)}`);
        }}
        aria-label={`Preview ${label} now`}
      >
        {busy ? "Reading the source" : "Preview now"}
      </button>
      <Problem message={error} />
    </div>
  );
}

/** A bought list, as CSV, previewed through the same dedupe as every source. */
export function BoughtListForm() {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [vertical, setVertical] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text) return setError("Choose a CSV file first.");
        setBusy(true);
        setError(null);
        const result = await postJson(ENDPOINT, { action: "preview_csv", csv: text, fileName, defaultVertical: vertical || null });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        router.push(`/portal/crm/imports?run=${String((result as unknown as { runId: string }).runId)}`);
      }}
    >
      <p className="max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
        Save the list as CSV. The first row names the columns: Company is required; Contact, Phone, Email, Address, City, ZIP, County,
        Website and Vertical are read when present. A company with no phone and no email waits in Held until one is found.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_260px]">
        <div>
          <label htmlFor="list-file" className={labelClass}>CSV file</label>
          <input
            id="list-file"
            type="file"
            accept=".csv,text/csv"
            className={`${fieldClass} mt-1.5 py-2`}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setError(null);
              if (!f) return;
              if (!/\.csv$/i.test(f.name)) return setError("That is not a CSV file. Save the list as CSV and choose that file.");
              setFileName(f.name);
              setText(await f.text());
            }}
          />
        </div>
        <div>
          <label htmlFor="list-vertical" className={labelClass}>Vertical, where the file has none</label>
          <select id="list-vertical" value={vertical} onChange={(e) => setVertical(e.target.value)} className={`${fieldClass} mt-1.5`}>
            <option value="">Read it from the file</option>
            {CRM_VERTICALS.map((v) => <option key={v} value={v}>{VERTICAL_LABEL[v]}</option>)}
          </select>
        </div>
      </div>
      <div><button type="submit" disabled={busy || !text} className={primaryClass}>{busy ? "Checking" : "Check the list"}</button></div>
      <Problem message={error} />
    </form>
  );
}

/** Write a previewed run. The server re-plans every record first and refuses if the list moved. */
export function WriteButton({ runId, adds, merges, waiting }: { runId: string; adds: number; merges: number; waiting: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
        Write adds {adds.toLocaleString("en-US")} new {adds === 1 ? "company" : "companies"} and records this source on{" "}
        {merges.toLocaleString("en-US")} already on the list. {waiting ? `${waiting.toLocaleString("en-US")} waiting for a choice stay here until someone chooses.` : ""}{" "}
        If the list changed since this preview, nothing is written and the screen says so.
      </p>
      <div>
        <button
          type="button"
          disabled={busy || adds + merges === 0}
          className={primaryClass}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const result = await postJson(ENDPOINT, { action: "write", runId });
            setBusy(false);
            if (!result.ok) return setError(result.error);
            const r = result as unknown as { added: number; merged: number };
            setDone(`Written: ${r.added} new, ${r.merged} already on the list.`);
            router.refresh();
          }}
        >
          {busy ? "Writing" : "Write"}
        </button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

/** A held record given a phone, which brings it onto the list. */
export function HeldPhoneForm({ rowId, company }: { rowId: string; company: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const result = await postJson(ENDPOINT, { action: "resolve_held", rowId, phone });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        router.refresh();
      }}
    >
      <div>
        <label htmlFor={`held-${rowId}`} className={labelClass}>Phone for {company}</label>
        <input id={`held-${rowId}`} type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button type="submit" disabled={busy} className={ghostClass}>{busy ? "Adding" : "Add with this phone"}</button>
      <DismissButton rowId={rowId} />
      <div className="w-full"><Problem message={error} /></div>
    </form>
  );
}

/** A conflict settled onto the company a person chooses, from the ones it could be. */
export function ConflictChoice({ rowId, candidates }: { rowId: string; candidates: { id: string; company: string; phone: string | null; county: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {candidates.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] text-[var(--ink)]">
              {c.company}
              {c.phone && telLink(c.phone) ? (
                <>
                  {", "}
                  <a href={telLink(c.phone)!} className="font-semibold text-[var(--navy)] underline">{c.phone}</a>
                </>
              ) : null}
              {c.county ? `, ${c.county} County` : ""}
            </span>
            <button
              type="button"
              disabled={busy}
              className={ghostClass}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await postJson(ENDPOINT, { action: "resolve_conflict", rowId, prospectId: c.id });
                setBusy(false);
                if (!result.ok) return setError(result.error);
                router.refresh();
              }}
            >
              This one
            </button>
          </li>
        ))}
      </ul>
      <DismissButton rowId={rowId} />
      <Problem message={error} />
    </div>
  );
}

/** Set a held record or a conflict aside: marked, never deleted. */
export function DismissButton({ rowId }: { rowId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        className={ghostClass}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await postJson(ENDPOINT, { action: "dismiss", rowId });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          router.refresh();
        }}
      >
        {busy ? "Setting aside" : "Not one for us"}
      </button>
      <Problem message={error} />
    </span>
  );
}
