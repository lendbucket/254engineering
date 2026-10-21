"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OUTCOMES_FOR, OUTCOME_LABEL, type ContactChannel, type ContactSubject } from "@/lib/contact-log-rules";
import { Done, Problem, fieldClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * LOG A CALL, AN EMAIL OR A NOTE. One click from any record (office ready,
 * 2026-10-20): the form is open on the record's own screen, channel first,
 * already set to a call.
 *
 * On a job, a call can carry the visit time agreed with the customer, which
 * is the visit-time call the rep logs when dispatching. On a prospect, any
 * entry can move the follow-up date, which is what the call list sorts on.
 */
export function ContactLogForm({ subject, subjectId }: { subject: ContactSubject; subjectId: string }) {
  const router = useRouter();
  const [channel, setChannel] = useState<ContactChannel>("call");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [outcome, setOutcome] = useState<string>("");
  const [body, setBody] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const outcomes = channel === "note" ? [] : OUTCOMES_FOR[channel];

  return (
    <form
      id="log"
      className="flex flex-col gap-3 print:hidden"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setDone(null);
        const result = await postJson("/api/portal/contact-log", {
          subject,
          subjectId,
          channel,
          direction: channel === "note" ? null : direction,
          outcome: channel === "note" || visitAt ? null : outcome || null,
          body,
          followUpOn: subject === "prospect" ? followUpOn || null : null,
          visitAt: subject === "file" && channel === "call" ? (visitAt ? new Date(visitAt).toISOString() : null) : null,
        });
        setBusy(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDone(channel === "note" ? "Note saved." : `${channel === "call" ? "Call" : "Email"} logged.`);
        setBody("");
        setOutcome("");
        setVisitAt("");
        router.refresh();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="log-channel" className={labelClass}>What</label>
          <select id="log-channel" value={channel} onChange={(e) => { setChannel(e.target.value as ContactChannel); setOutcome(""); }} className={`${fieldClass} mt-1.5`}>
            <option value="call">A call</option>
            <option value="email">An email</option>
            <option value="note">A note</option>
          </select>
        </div>
        {channel !== "note" ? (
          <div>
            <label htmlFor="log-direction" className={labelClass}>Who started it</label>
            <select id="log-direction" value={direction} onChange={(e) => setDirection(e.target.value as "outbound" | "inbound")} className={`${fieldClass} mt-1.5`}>
              <option value="outbound">We did</option>
              <option value="inbound">They did</option>
            </select>
          </div>
        ) : null}
        {channel !== "note" && !visitAt ? (
          <div>
            <label htmlFor="log-outcome" className={labelClass}>Outcome</label>
            <select id="log-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${fieldClass} mt-1.5`}>
              <option value="">Not recorded</option>
              {outcomes.map((o) => (
                <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      {subject === "file" && channel === "call" ? (
        <div className="max-w-[320px]">
          <label htmlFor="log-visit" className={labelClass}>Visit time agreed, if that is what the call set</label>
          <input id="log-visit" type="datetime-local" value={visitAt} onChange={(e) => setVisitAt(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
      ) : null}
      {subject === "prospect" ? (
        <div className="max-w-[240px]">
          <label htmlFor="log-follow" className={labelClass}>Next follow-up</label>
          <input id="log-follow" type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
      ) : null}
      <div>
        <label htmlFor="log-body" className={labelClass}>{channel === "note" ? "The note" : "What was said"}</label>
        <textarea id="log-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={`${fieldClass} mt-1.5 py-2`} />
      </div>
      <div>
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? "Saving" : channel === "note" ? "Save the note" : `Log the ${channel}`}
        </button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </form>
  );
}
