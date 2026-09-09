import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listDeletionRequests } from "@/lib/deletion-requests";
import { Chip, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { AnswerRequest, TakeRequest } from "./DeletionRequestsClient";

export const dynamic = "force-dynamic";

/**
 * Somebody asked to be forgotten.
 *
 * Phase 12 Section 3, the customer side. Operator ruling: A DELETION REQUEST
 * PRODUCES A TASK, NOT A DELETION. There is no control on this screen that
 * removes anything, and there is no path from here to a retention run.
 *
 * WHY IT IS BEHIND THE SUPPRESSION PERMISSION
 * --------------------------------------------
 * Same desk, same telephone call. "Stop writing to me" and "delete everything
 * you have about me" arrive in the same sentence more often than not, and a
 * firm where the person answering can record half of what they were told is a
 * firm that loses the other half.
 *
 * It is emphatically not `retention.execute`, which the administrator holds
 * alone. Taking the request and acting on it are different acts by different
 * people, and that separation is the ruling rather than a consequence of it.
 *
 * WHAT THIS SCREEN PROMISES, AND IT IS DELIBERATELY NARROW
 * --------------------------------------------------------
 * That the request is written down as it was made, that a task exists for a
 * person to answer it, and that the firm has stopped sending marketing to that
 * address. That last one is the only part the firm can do immediately and
 * without a ruling, and the screen says so in those words rather than letting a
 * recorded request read as a request granted.
 *
 * What it does NOT promise is deletion, because what the firm may remove is
 * with counsel and TBPELS. Forty one tables in retention-policy.ts say
 * `kept_pending_counsel` for that reason, and the published privacy policy
 * already tells the public that engineering records are kept for the periods
 * Texas requires. A screen that promised more would make that policy false.
 */
export default async function DeletionRequestsPage() {
  const actor = await currentActor();
  if (!can(actor, "suppressions.manage")) notFound();

  const rows = await listDeletionRequests();
  const open = rows?.filter((r) => r.answered === null) ?? [];

  return (
    <>
      <PageHead
        eyebrow="Customer service"
        title="Asked to be forgotten"
        lede="Every person who has asked the firm to delete what it holds about them, written down as they asked it. Recording a request stops marketing to that address immediately and raises a task for somebody to answer. It deletes nothing: what the firm may remove is a question for counsel, and the only path that removes a record is a retention run an administrator plans."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <Panel title="Take a request">
          <TakeRequest />
        </Panel>

        <Panel title={rows === null ? "Requests" : `Requests (${open.length} unanswered)`}>
          {/*
            Null is a failed read and it is not an empty list. On this screen the
            wrong answer means telling somebody nobody has asked when the query
            never ran, about a request they made out loud.
          */}
          {rows === null ? (
            <ErrorState
              title="The requests could not be read"
              body="This is not the same as nobody having asked. Do not tell anybody their request is not on file on the strength of this screen. Tell an administrator."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nobody has asked"
              body="The query ran and found no rows. A request taken on the telephone, by email or in a letter appears here once somebody records it."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[4px] border border-[var(--border)] bg-white p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold break-words text-[var(--navy)]">
                        {row.subjectEmail}
                      </p>
                      {row.subjectNote ? (
                        <p className="mt-0.5 text-[12.5px] break-words text-[var(--secondary)]">
                          {row.subjectNote}
                        </p>
                      ) : null}
                    </div>
                    <p className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--secondary)]">
                      <Chip
                        label={row.answered ? "Answered" : "Waiting on an answer"}
                        tone={row.answered ? "good" : "warn"}
                      />
                      <Chip
                        label={row.suppressed ? "Marketing stopped" : "MARKETING NOT STOPPED"}
                        tone={row.suppressed ? "good" : "bad"}
                      />
                      {row.createdAtCt}
                    </p>
                  </div>

                  {/*
                    Their words, quoted rather than summarised. A paraphrase is
                    the firm's account of what somebody wanted, which is the
                    thing this record exists so nobody has to take on trust.
                  */}
                  <blockquote className="mt-2 border-l-2 border-[var(--border)] pl-3 text-[13px] break-words text-[var(--ink)]">
                    {row.askedFor}
                  </blockquote>

                  <p className="mt-2 text-[12px] text-[var(--secondary)]">
                    Taken by {row.takenByEmail ?? "somebody no longer on the roster"} through{" "}
                    {row.channel.replace("_", " ")}
                    {row.channelNote ? `, ${row.channelNote}` : ""}.{" "}
                    {row.taskId ? (
                      <Link href="/portal/tasks" className="underline">
                        A task was raised.
                      </Link>
                    ) : (
                      <span className="font-semibold text-[var(--bad)]">
                        No task was raised for this. Raise one.
                      </span>
                    )}
                  </p>

                  {row.answered ? (
                    <p className="mt-2 rounded-[4px] bg-[var(--paper)] p-2 text-[12.5px] break-words text-[var(--ink)]">
                      <span className="font-semibold">What the firm said: </span>
                      {row.answered.because}
                    </p>
                  ) : (
                    <div className="mt-2">
                      <AnswerRequest id={row.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
