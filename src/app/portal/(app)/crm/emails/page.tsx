import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { emailsDueFor, repliesFor } from "@/lib/crm-email";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ReadButton, SendButton } from "./EmailsClient";

export const dynamic = "force-dynamic";

/**
 * THE SEQUENCE EMAILS AND THE REPLIES. crm.use, Robert's sales CRM ruling of
 * 2026-11-02, item R7, with the templates he approved as drafted and his
 * answers 1 and 6: a rep presses Send on each email, and replies go to the
 * support mailbox until the reply subdomain exists.
 *
 * Two lists, one column on a phone and two on a desk: the emails due now,
 * each with the words it would send and a Send button; and the replies the
 * webhook recorded, each with what it said and a button that writes it to the
 * company's history and hands the company back to the rep.
 */

export default async function EmailsPage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const [due, replies] = await Promise.all([emailsDueFor(actor), repliesFor(actor, { includeRead: false })]);

  return (
    <>
      <PageHead
        eyebrow="Sales"
        title="Sequence emails"
        lede="The emails your companies are due, written from the approved template for their vertical. Nothing sends until you press Send, and one address gets at most one sales email a day. Replies to these emails go to the support mailbox until the reply address is set up; once it is, they appear here."
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Due now" description={due.ok ? `${due.rows.length.toLocaleString("en-US")} due.` : undefined}>
          {!due.ok ? (
            <ErrorState title="The emails due could not be read" body={`${due.error} This is a failed read, not an empty list.`} />
          ) : due.rows.length === 0 ? (
            <EmptyState title="No email is due" body="A company's email comes due the day after its first call, and again after its second. Make the calls on the call queue and the emails arrive here." />
          ) : (
            <ul className="grid gap-6">
              {due.rows.map((d) => (
                <li key={d.prospectId} className="border-b border-[var(--row-rule)] pb-6">
                  <p className="text-[15px] font-semibold text-[var(--ink)]">
                    <Link href={`/portal/crm/${d.prospectId}`} className="text-[var(--navy)] underline">{d.company}</Link>
                    <span className="font-normal text-[var(--secondary)]">, {d.stageLabel}</span>
                  </p>
                  <p className="mt-1 text-[14px] text-[var(--ink)]">
                    To: {d.to ? `${d.toName ? `${d.toName}, ` : ""}${d.to}` : "nobody at this company has an email address. Sending records that and moves to the next call."}
                  </p>
                  {d.preview.ok ? (
                    <div className="mt-3 max-w-[70ch] border-l-2 border-[var(--row-rule)] pl-4 text-[14px] leading-[1.7] text-[var(--ink)]">
                      <p className="font-semibold">{d.preview.subject}</p>
                      {d.preview.paragraphs.map((p, i) => (
                        <p key={i} className="mt-2">{p}</p>
                      ))}
                      <p className="mt-2">{d.preview.signOff}</p>
                      <p className="mt-2 text-[var(--secondary)]">
                        {d.preview.variant === "open" ? "This line can be ordered now." : "This line is not open for ordering yet, so the email offers word of when it opens."}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <ErrorState title="This email could not be written" body={d.preview.error} />
                    </div>
                  )}
                  <div className="mt-3">
                    <SendButton prospectId={d.prospectId} disabled={!d.preview.ok && Boolean(d.to)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Replies" description={replies.ok ? `${replies.rows.length.toLocaleString("en-US")} unread.` : undefined}>
          {!replies.ok ? (
            <ErrorState title="The replies could not be read" body={`${replies.error} This is a failed read, not an empty list.`} />
          ) : replies.rows.length === 0 ? (
            <EmptyState title="No unread reply" body="Replies arrive here once the reply address is set up. Until then they go to the support mailbox, and you record them on the company page." />
          ) : (
            <ul className="grid gap-6">
              {replies.rows.map((r) => (
                <li key={r.id} id={`reply-${r.id}`} className="border-b border-[var(--row-rule)] pb-6 text-[14px]">
                  <p className="font-semibold text-[var(--ink)]">
                    {r.prospectId ? (
                      <Link href={`/portal/crm/${r.prospectId}`} className="text-[var(--navy)] underline">{r.company ?? "The company"}</Link>
                    ) : (
                      "Matched no company on the sales list"
                    )}
                  </p>
                  <p className="text-[var(--secondary)]">{formatInFirmZone(r.receivedAt)}{r.fromAddress ? `, from ${r.fromAddress}` : ""}</p>
                  <p className="mt-2 font-semibold text-[var(--ink)]">{r.subject ?? "(no subject)"}</p>
                  {r.body ? <p className="mt-1 max-w-[70ch] whitespace-pre-wrap text-[var(--ink)]">{r.body.slice(0, 4000)}</p> : <p className="mt-1 text-[var(--secondary)]">No text came with this reply.</p>}
                  <div className="mt-3">
                    <ReadButton replyId={r.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
