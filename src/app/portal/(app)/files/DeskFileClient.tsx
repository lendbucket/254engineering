"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FILE_DETAIL_FIELDS } from "@/lib/file-detail-fields";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * A job's contact, access and scheduling details, and nothing else.
 * files.update_details, 2026-10-20. The closed list is file-detail-fields.ts;
 * the server refuses any other field, so a price can never arrive this way.
 */
export function FileDetailsForm({ fileId, values }: { fileId: string; values: Record<string, string> }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => (values[k] ?? "") !== v));

  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (Object.keys(changed).length === 0) return setError("Nothing has changed.");
        setBusy(true);
        setError(null);
        setDone(null);
        const result = await postJson("/api/portal/desk", { action: "update_file_details", fileId, values: changed });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("Saved. The audit trail records who changed what.");
        router.refresh();
      }}
    >
      {FILE_DETAIL_FIELDS.map((f) => (
        <div key={f.id} className={f.id === "access_notes" ? "sm:col-span-2" : ""}>
          <label htmlFor={`fd-${f.id}`} className={labelClass}>{f.label}</label>
          {f.id === "access_notes" ? (
            <textarea id={`fd-${f.id}`} rows={2} value={form[f.id] ?? ""} onChange={(e) => setForm({ ...form, [f.id]: e.target.value })} className={`${fieldClass} mt-1.5 py-2`} />
          ) : (
            <input id={`fd-${f.id}`} type={f.id === "site_contact_phone" ? "tel" : "text"} value={form[f.id] ?? ""} onChange={(e) => setForm({ ...form, [f.id]: e.target.value })} className={`${fieldClass} mt-1.5`} />
          )}
        </div>
      ))}
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving" : "Save details"}</button>
        <Problem message={error} />
        <Done message={done} />
      </div>
    </form>
  );
}

/**
 * Release the technician who accepted the job, so it can be offered again.
 * Only before evidence has started; the server refuses after.
 */
export function ReleaseTechnician({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm("Take this job off the technician's schedule? They are told they do not need to attend, and the job goes back to dispatch.")) return;
        setBusy(true);
        setError(null);
        const result = await postJson("/api/portal/desk", { action: "release_technician", fileId, reason });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone("Released. Offer it to another technician from the dispatch panel.");
        router.refresh();
      }}
    >
      <label htmlFor={`rel-${fileId}`} className={labelClass}>Why it is being moved</label>
      <input id={`rel-${fileId}`} value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
      <div><button type="submit" disabled={busy} className={ghostClass}>{busy ? "Releasing" : "Release the technician"}</button></div>
      <Problem message={error} />
      <Done message={done} />
    </form>
  );
}
