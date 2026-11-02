"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CALL_OUTCOMES, CALL_OUTCOME_LABEL, type CallOutcome } from "@/lib/crm-queue-rules";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * What happened on the call, Robert's R3 outcomes. A callback asks for a date
 * and a time (Central), a refusal for a reason, a wrong number for which
 * number. Recording one draws the next card; Interested opens the company's
 * own page, where the existing conversion opens an account prefilled.
 */
export function OutcomeForm({ prospectId, contacts }: { prospectId: string; contacts: { id: string; label: string }[] }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function record() {
    if (!outcome) return setError("Choose what happened first.");
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson("/api/portal/crm/queue", {
      action: "outcome",
      prospectId,
      outcome,
      contactId,
      callbackDate,
      callbackTime,
      reason,
      note,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(String(result.said ?? "Recorded."));
    if (result.openConversion) {
      router.push(`/portal/prospects/${prospectId}`);
      return;
    }
    setOutcome(null);
    setReason("");
    setNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className={labelClass}>Outcome</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CALL_OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={outcome === o}
              disabled={busy}
              className={outcome === o ? primaryClass : ghostClass}
              onClick={() => {
                setOutcome(o);
                setError(null);
              }}
            >
              {CALL_OUTCOME_LABEL[o]}
            </button>
          ))}
        </div>
      </fieldset>

      {contacts.length > 1 || outcome === "wrong_number" ? (
        <div>
          <label htmlFor="q-contact" className={labelClass}>Who you called</label>
          <select id="q-contact" value={contactId} onChange={(e) => setContactId(e.target.value)} className={`${fieldClass} mt-1.5`}>
            {contacts.length === 0 ? <option value="">Nobody with a number</option> : null}
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {outcome === "callback" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="q-cb-date" className={labelClass}>Call back on</label>
            <input id="q-cb-date" type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)} className={`${fieldClass} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="q-cb-time" className={labelClass}>At (Central, 8 AM to 8 PM)</label>
            <input id="q-cb-time" type="time" min="08:00" max="19:59" value={callbackTime} onChange={(e) => setCallbackTime(e.target.value)} className={`${fieldClass} mt-1.5`} />
          </div>
        </div>
      ) : null}

      {outcome === "not_interested" ? (
        <div>
          <label htmlFor="q-reason" className={labelClass}>Why they are not interested</label>
          <input id="q-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
      ) : null}

      {outcome === "do_not_call" ? (
        <p className="text-[14px] font-semibold leading-[1.6] text-[var(--ink)]">
          This is for good. The company leaves the queue and its email addresses go on the suppression list. Nobody can undo it from a screen.
        </p>
      ) : null}

      <div>
        <label htmlFor="q-note" className={labelClass}>Note (optional)</label>
        <textarea id="q-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>

      <div>
        <button type="button" disabled={busy || !outcome} className={primaryClass} onClick={() => void record()}>
          {busy ? "Recording" : "Record and take the next card"}
        </button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
