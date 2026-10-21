import { can, type Actor } from "@/lib/ops-authz";
import { canReadContactLog, contactLogFor } from "@/lib/ops-contact-log";
import { OUTCOME_LABEL, type ContactSubject } from "@/lib/contact-log-rules";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { EmptyState, ErrorState, Panel } from "@/components/portal/surfaces";
import { ContactLogForm } from "./ContactLogForm";

/**
 * The calls, emails and notes on a record, newest first, with the form to add
 * one above them. Any record screen renders this with its own subject, which
 * is how a call log entry is one click from every record (2026-10-20).
 *
 * Renders nothing for somebody who cannot read the record's log, rather than
 * an empty history that would read as "nobody ever called".
 */
export async function ContactLogPanel({
  actor,
  subject,
  subjectId,
  className = "mt-6",
}: {
  actor: Actor | null;
  subject: ContactSubject;
  subjectId: string;
  className?: string;
}) {
  if (!canReadContactLog(actor, subject)) return null;
  const log = await contactLogFor(actor, subject, subjectId);
  const canWrite = can(actor, "contact_log.write");

  return (
    <Panel
      className={className}
      title="Calls, emails and notes"
      description="Every entry is kept as written. A correction is a new entry that says so."
    >
      {canWrite ? <ContactLogForm subject={subject} subjectId={subjectId} /> : null}
      <div className={canWrite ? "mt-6" : ""}>
        {!log.ok ? (
          <ErrorState title="The history could not be read" body={`${log.error} Nothing here means nobody was contacted.`} />
        ) : log.rows.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            body={canWrite ? "Log the first call or note above. It appears here, newest first." : "When somebody logs a call or a note it appears here, newest first."}
          />
        ) : (
          <ol className="divide-y divide-[var(--row-rule)] border-t border-[var(--row-rule)]">
            {log.rows.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-[14px] font-semibold text-[var(--ink)]">
                  {e.channel === "note" ? "Note" : e.channel === "call" ? "Call" : "Email"}
                  {e.direction ? `, ${e.direction === "outbound" ? "we started it" : "they started it"}` : ""}
                  {e.outcome ? `, ${OUTCOME_LABEL[e.outcome]}` : ""}
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--secondary)]">
                  {formatInFirmZone(e.createdAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  {e.byName ? `, ${e.byName}` : ""}
                  {e.visitAt ? `. Visit: ${formatInFirmZone(e.visitAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                  {e.followUpOn ? `. Follow up on ${e.followUpOn}` : ""}
                </p>
                {e.body ? <p className="mt-1.5 max-w-[70ch] whitespace-pre-line text-[14px] leading-[1.55] text-[var(--ink)]">{e.body}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
