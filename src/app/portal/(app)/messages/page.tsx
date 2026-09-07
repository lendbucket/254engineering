import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listThreads, MENTION_PAGE, mentionsFor, messageablepeople, threadView } from "@/lib/ops-threads";
import { roleLabel } from "@/lib/ops-authz";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { Composer, MessageSearch, NewChannel, StartDirect } from "./MessagesClient";

export const dynamic = "force-dynamic";

/**
 * The communication centre.
 *
 * THREE KINDS IN ONE LIST
 * -----------------------
 * File threads, direct messages, and channels sit together, ordered by what
 * happened most recently. Splitting them into tabs would be tidier and would
 * mean somebody misses the one message they needed because it was under the
 * tab they were not looking at.
 *
 * WHAT AN ADMINISTRATOR DOES NOT SEE
 * ----------------------------------
 * Direct threads they are not in. Not filtered out of the list, never selected:
 * listThreads asks canReadThread for every row, and that function has no
 * administrator override. An admin who could read every private message is one
 * nobody would send an honest message near, and the platform would be worse for
 * it.
 */

const KIND_LABEL: Record<string, string> = {
  file: "File",
  direct: "Direct",
  channel: "Channel",
};

const when = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; view?: string }>;
}) {
  const actor = await currentActor();
  /*
   * can() narrows nothing for TypeScript, because it accepts a null actor and
   * answers false. The explicit check is what tells the compiler, and it is not
   * redundant: it is the same fact said in the language the compiler reads.
   */
  if (!actor || !can(actor, "messages.use")) notFound();
  const params = await searchParams;

  const threads = await listThreads(actor);
  const open = params.id ? await threadView(actor, params.id) : null;
  const people = await messageablepeople(actor);

  /*
   * EVERYTHING THAT NAMED YOU, item 5 of docs/messaging-section-3.md.
   *
   * Loaded on every render rather than only when the view is open, because the
   * count is the point: a collected view nobody knows about is a page nobody
   * opens, and the number beside the switch is what makes writing a mention
   * worth doing.
   *
   * The threads this page already has are handed over, so this costs one query
   * rather than repeating the readable set.
   */
  const mentions = await mentionsFor(actor, threads);
  const showing = params.view === "mentions" ? "mentions" : "threads";

  return (
    <>
      <PageHead
        eyebrow="Communication"
        title="Messages"
        lede="Conversations about files, direct messages, and the channels for your role. A direct message is private, including from an administrator."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <div className={open ? "hidden lg:block" : "block"}>
          <div className="flex flex-col gap-2">
            <StartDirect people={people} />
            {can(actor, "profiles.list") ? <NewChannel /> : null}
          </div>

          {/*
            TWO VIEWS OF THE SAME COLUMN, AND NOT A TAB BAR ELSEWHERE.

            The conversations and the things that named you are the same kind of
            answer to the same question, so they share the column and the thread
            beside it. A separate route would put a second inbox on the
            navigation, and the point of this view is to be the thing you check
            INSTEAD of reading five threads, not a sixth place to look.

            Two links rather than a client toggle: the server renders what is
            asked for, so the state survives a reload and can be linked to.
            It comes before the search, because it decides what this column IS
            and the search is a tool inside one of the two. Below it on a phone,
            the search box was the third thing between the header and the
            answer.
          */}
          <div className="mt-4 flex gap-2" role="group" aria-label="What this column shows">
            <Link
              href="/portal/messages"
              aria-current={showing === "threads" ? "true" : undefined}
              className={`flex min-h-[44px] flex-1 items-center justify-center rounded-[3px] border px-3 text-[13.5px] font-semibold ${
                showing === "threads"
                  ? "border-slate bg-[var(--canvas)] text-[var(--navy)]"
                  : "border-[var(--border)] text-[var(--secondary)]"
              }`}
            >
              Conversations
            </Link>
            <Link
              href="/portal/messages?view=mentions"
              aria-current={showing === "mentions" ? "true" : undefined}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[3px] border px-3 text-[13.5px] font-semibold ${
                showing === "mentions"
                  ? "border-slate bg-[var(--canvas)] text-[var(--navy)]"
                  : "border-[var(--border)] text-[var(--secondary)]"
              }`}
            >
              Addressed to you
              {mentions.unread > 0 ? <Chip label={String(mentions.unread)} tone="warn" /> : null}
            </Link>
          </div>

          {/*
            Search sits above the thread list rather than in the header,
            because it searches THIS surface. A magnifying glass in the chrome
            already opens the command palette, which goes to screens, and two
            searches that mean different things behind one icon is how somebody
            stops trusting either.
          */}
          <div className="mt-4">
            <MessageSearch people={people.map((p) => ({ id: p.id, name: p.name }))} />
          </div>

          {showing === "mentions" ? (
            <div className="mt-4">
              {mentions.items.length === 0 ? (
                <EmptyState
                  title="Nothing has named you"
                  body="Somebody writes @ and your name in a message and it appears here, with what they said. An empty list is a result rather than a gap: nothing is waiting on you."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {mentions.items.map((m) => (
                    <li key={m.messageId}>
                      <Link
                        href={`/portal/messages?id=${m.threadId}`}
                        className="block rounded-[4px] border border-[var(--border)] bg-white p-4 transition-colors hover:border-slate"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {/*
                              A DIRECT THREAD IS TITLED WITH THE OTHER PERSON,
                              so "Devon Probe in Devon Probe" is what the
                              obvious line renders. Seen in a screenshot at 390
                              before this was written any other way.
                            */}
                            <p className="text-[13.5px] font-semibold text-[var(--navy)]">
                              {m.kind === "direct" ? m.authorName : `${m.authorName} in ${m.threadTitle}`}
                            </p>
                            <p className="mt-1 line-clamp-3 text-[13.5px] leading-[1.5] text-[var(--secondary)]">
                              {m.body}
                            </p>
                            <p className="mt-1 text-[12px] text-[var(--secondary)]">
                              {KIND_LABEL[m.kind]}
                              {`, ${when(m.createdAt)}`}
                            </p>
                          </div>
                          {m.unread ? <Chip label="new" tone="warn" /> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {mentions.truncated ? (
                <p className="mt-3 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
                  The {MENTION_PAGE} most recent are shown. Older ones are still in their
                  conversations, and search finds them.
                </p>
              ) : null}
            </div>
          ) : (
          <div className="mt-4">
            {threads.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                body="A file gets a thread the first time somebody writes on it. You can also message a colleague directly, and an administrator can open a channel for a role."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {threads.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/portal/messages?id=${t.id}`}
                      className={`block rounded-[4px] border bg-white p-4 transition-colors hover:border-slate ${
                        open?.thread.id === t.id
                          ? "border-slate"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-[var(--navy)]">{t.title}</p>
                          {t.preview ? (
                            <p className="mt-1 line-clamp-2 text-[13.5px] leading-[1.5] text-[var(--secondary)]">
                              {t.preview}
                            </p>
                          ) : (
                            <p className="mt-1 text-[13.5px] text-[var(--secondary)]">Nothing said yet.</p>
                          )}
                          <p className="mt-1 text-[12px] text-[var(--secondary)]">
                            {KIND_LABEL[t.kind]}
                            {t.last_message_at ? `, ${when(t.last_message_at)}` : ""}
                          </p>
                        </div>
                        {t.unread > 0 ? <Chip label={`${t.unread} new`} tone="warn" /> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </div>

        {open ? (
          <div>
            <Link
              href="/portal/messages"
              className="mb-3 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--secondary)] lg:hidden"
            >
              Back to conversations
            </Link>

            <div className="rounded-[4px] border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
                <h2 className="font-display text-[17px] leading-[1.25] font-bold text-[var(--navy)]">
                  {open.thread.title}
                </h2>
                <p className="mt-0.5 text-[12.5px] text-[var(--secondary)]">
                  {KIND_LABEL[open.thread.kind]}
                  {open.thread.kind === "channel" && open.thread.channel_roles?.length
                    ? `, readable by ${open.thread.channel_roles.join(" and ")}`
                    : ""}
                  {open.thread.participants.length
                    ? `, ${open.thread.participants.map((p) => p.name).join(", ")}`
                    : ""}
                </p>
              </div>

              <div className="px-4 py-4 sm:px-5">
                {open.messages.length === 0 ? (
                  <p className="text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                    Nothing said yet. Whatever you write here reaches everybody named above and
                    nobody else.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-4">
                    {open.olderCount > 0 ? (
                      <li className="pb-1 text-center text-[12.5px] text-[var(--secondary)]">
                        {/*
                          SAYS WHAT IT IS NOT SHOWING. The read was capped at
                          500 silently before, taking the OLDEST 500, so a long
                          thread showed its beginning and hid everything since.
                          It now takes the newest hundred and says how many are
                          behind them, which is the TableFooter rule applied to
                          a conversation.
                        */}
                        {open.olderCount} older {open.olderCount === 1 ? "message is" : "messages are"} not shown.
                      </li>
                    ) : null}
                    {open.messages.map((m) => {
                      const mine = m.author_id === actor!.id;
                      return (
                        <li key={m.id} className={mine ? "sm:pl-10" : "sm:pr-10"}>
                          <div
                            className={`rounded-[4px] border px-3.5 py-3 ${
                              mine ? "border-slate bg-[var(--canvas)]" : "border-[var(--border)] bg-white"
                            }`}
                          >
                            <p className="text-[12.5px] font-semibold text-[var(--gold-deep)]">
                              {mine ? "You" : m.author_name}
                              {m.author_role && !mine ? `, ${roleLabel(m.author_role)}` : ""}
                            </p>
                            {m.body ? (
                              <p className="mt-1 text-[13.5px] leading-[1.55] whitespace-pre-wrap text-[var(--navy)]">
                                {m.body}
                              </p>
                            ) : null}

                            {m.attachments.length > 0 ? (
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {m.attachments.map((a) => (
                                  <li key={a.key}>
                                    {/*
                                      A NULL URL IS SAID, NOT SHOWN AS A BROKEN
                                      IMAGE. The bucket is private and every
                                      view is a signed url; when the signing
                                      call fails the screen says the attachment
                                      could not be opened, because a broken
                                      image icon reads as "this was deleted".
                                    */}
                                    {a.url === null ? (
                                      <p className="rounded-[3px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-2.5 py-1.5 text-[12.5px] text-[var(--warn-ink)]">
                                        {a.name} could not be opened just now.
                                      </p>
                                    ) : a.contentType.startsWith("image/") ? (
                                      <a href={a.url} target="_blank" rel="noreferrer" className="block">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={a.url}
                                          alt={a.name}
                                          className="h-28 w-28 rounded-[3px] border border-[var(--border)] object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={a.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-h-[40px] items-center rounded-[3px] border border-[var(--border)] bg-white px-3 text-[13.5px] font-semibold text-[var(--navy)] active:bg-[var(--row-hover)]"
                                      >
                                        {a.name}
                                      </a>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : null}

                            <p className="mt-1.5 text-[12px] text-[var(--secondary)]">{when(m.created_at)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {open.seenBy.length > 0 ? (
                  <p className="mt-3 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
                    {/*
                      FILE THREADS ONLY, and the narrowness is the decision.
                      Whether the engineer saw the technician's question is
                      operational. Whether somebody read a direct message is not
                      the platform's business to broadcast.
                    */}
                    Read by {open.seenBy.map((p) => p.name).join(", ")}.
                  </p>
                ) : null}

                {open.canPost ? (
                  <div className="mt-5 border-t border-[var(--border)] pt-4">
                    <Composer
                      selfId={actor.id}
                      threadId={open.thread.id}
                      participants={open.thread.participants}
                    />
                  </div>
                ) : (
                  <p className="mt-5 border-t border-[var(--border)] pt-4 text-[13.5px] text-[var(--secondary)]">
                    You can read this conversation and not add to it.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block">
            <EmptyState
              title="No conversation open"
              body="Choose one from the list. File threads follow the file, so whoever can see the file can read what was said about it."
            />
          </div>
        )}
      </div>
    </>
  );
}
