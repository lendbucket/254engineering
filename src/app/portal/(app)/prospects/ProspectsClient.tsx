"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROSPECT_TYPES, PROSPECT_TYPE_LABEL, IMPORT_ROW_LIMIT } from "@/lib/prospect-import";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * ADD ONE PROSPECT, OR IMPORT A SPREADSHEET OF THEM. 2026-10-20.
 *
 * The import reads the file in the browser and sends its text; the server
 * checks every row and answers row by row before anything is saved. "Check
 * the file" is a dry run that writes nothing. Only "Import" writes, and it
 * names every row it did not take and why.
 */
export function AddProspect() {
  const router = useRouter();
  const [form, setForm] = useState({ company: "", contactName: "", phone: "", email: "", city: "", prospectType: "roofer", followUpOn: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setDone(null);
        const result = await postJson("/api/portal/prospects", { action: "create", ...form });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone(`${form.company} added to the sales list.`);
        setForm({ ...form, company: "", contactName: "", phone: "", email: "", city: "" });
        router.refresh();
      }}
    >
      <div><label htmlFor="p-company" className={labelClass}>Company</label><input id="p-company" required value={form.company} onChange={set("company")} className={`${fieldClass} mt-1.5`} /></div>
      <div><label htmlFor="p-contact" className={labelClass}>Contact</label><input id="p-contact" value={form.contactName} onChange={set("contactName")} className={`${fieldClass} mt-1.5`} /></div>
      <div><label htmlFor="p-phone" className={labelClass}>Phone</label><input id="p-phone" type="tel" value={form.phone} onChange={set("phone")} className={`${fieldClass} mt-1.5`} /></div>
      <div><label htmlFor="p-email" className={labelClass}>Email</label><input id="p-email" type="email" value={form.email} onChange={set("email")} className={`${fieldClass} mt-1.5`} /></div>
      <div><label htmlFor="p-city" className={labelClass}>City</label><input id="p-city" value={form.city} onChange={set("city")} className={`${fieldClass} mt-1.5`} /></div>
      <div>
        <label htmlFor="p-type" className={labelClass}>Type</label>
        <select id="p-type" value={form.prospectType} onChange={set("prospectType")} className={`${fieldClass} mt-1.5`}>
          {PROSPECT_TYPES.map((t) => <option key={t} value={t}>{PROSPECT_TYPE_LABEL[t]}</option>)}
        </select>
      </div>
      <div><label htmlFor="p-follow" className={labelClass}>First follow-up</label><input id="p-follow" type="date" value={form.followUpOn} onChange={set("followUpOn")} className={`${fieldClass} mt-1.5`} /></div>
      <div className="flex items-end"><button type="submit" disabled={busy} className={primaryClass}>{busy ? "Adding" : "Add prospect"}</button></div>
      <div className="sm:col-span-2 lg:col-span-4"><Problem message={error} /><Done message={done} /></div>
    </form>
  );
}

type Answer = { imported: number; refused: { line: number; reason: string }[] };

export function ImportProspects() {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Answer | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(dryRun: boolean) {
    if (!text) return setError("Choose a CSV file first.");
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson("/api/portal/prospects", { action: "import", csv: text, defaultType: defaultType || null, dryRun });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const answer = (result as unknown as { result: Answer }).result;
    if (dryRun) setChecked(answer);
    else {
      setChecked(answer);
      setDone(`${answer.imported} prospect${answer.imported === 1 ? "" : "s"} imported. Each is due a first call today.`);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
        Save the spreadsheet as CSV (in Excel or Google Sheets, File, then Save as or Download, then CSV). The first row names
        the columns: Company, and a Phone or an Email, are required; Contact, City and Type are read when present. Up to{" "}
        {IMPORT_ROW_LIMIT.toLocaleString("en-US")} rows in one file.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor="imp-file" className={labelClass}>CSV file</label>
          <input
            id="imp-file"
            type="file"
            accept=".csv,text/csv"
            className={`${fieldClass} mt-1.5 py-2`}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setChecked(null);
              setDone(null);
              setError(null);
              if (!f) return;
              if (!/\.csv$/i.test(f.name)) return setError("That is not a CSV file. Save the spreadsheet as CSV and choose that file.");
              setFileName(f.name);
              setText(await f.text());
            }}
          />
        </div>
        <div>
          <label htmlFor="imp-type" className={labelClass}>Type, where the file has none</label>
          <select id="imp-type" value={defaultType} onChange={(e) => setDefaultType(e.target.value)} className={`${fieldClass} mt-1.5`}>
            <option value="">Read it from the file</option>
            {PROSPECT_TYPES.map((t) => <option key={t} value={t}>{PROSPECT_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !text} className={ghostClass} onClick={() => void send(true)}>Check the file</button>
        <button type="button" disabled={busy || !checked || checked.imported === 0} className={primaryClass} onClick={() => void send(false)}>
          {busy ? "Working" : checked ? `Import ${checked.imported} prospect${checked.imported === 1 ? "" : "s"}` : "Import"}
        </button>
      </div>
      {checked && !done ? (
        <p className="text-[14px] text-[var(--ink)]">
          {fileName}: {checked.imported} row{checked.imported === 1 ? "" : "s"} ready to import, {checked.refused.length} not.
        </p>
      ) : null}
      {checked && checked.refused.length ? (
        <div>
          <p className="text-[14px] font-semibold text-[var(--ink)]">Rows that will not be imported</p>
          <ul className="mt-1.5 max-h-[280px] overflow-auto text-[14px] leading-[1.5] text-[var(--ink)]">
            {checked.refused.map((r) => <li key={r.line}>Row {r.line}: {r.reason}</li>)}
          </ul>
        </div>
      ) : null}
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
