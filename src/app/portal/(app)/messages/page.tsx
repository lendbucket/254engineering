import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listThreads, messageablepeople, threadView } from "@/lib/ops-threads";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { Composer, NewChannel, StartDirect } from "./MessagesClient";

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
  searchParams: Promise<{ id?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "messages.use")) notFound();
  const params = await searchParams;

  const threads = await listThreads(actor);
  const open = params.id ? await threadView(actor, params.id) : null;
  const people = await messageablepeople(actor);

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
                          : "border-limestone-line"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14.5px] font-semibold text-slate">{t.title}</p>
                          {t.preview ? (
                            <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-slate-muted">
                              {t.preview}
                            </p>
                          ) : (
                            <p className="mt-1 text-[13px] text-slate-muted">Nothing said yet.</p>
                          )}
                          <p className="mt-1 text-[12px] text-slate-muted">
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
        </div>

        {open ? (
          <div>
            <Link
              href="/portal/messages"
              className="mb-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-slate-muted lg:hidden"
            >
              Back to conversations
            </Link>

            <div className="rounded-[4px] border border-limestone-line bg-white">
              <div className="border-b border-limestone-line px-4 py-3 sm:px-5">
                <h2 className="font-display text-[18px] leading-[1.25] font-bold text-slate">
                  {open.thread.title}
                </h2>
                <p className="mt-0.5 text-[12.5px] text-slate-muted">
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
                  <p className="text-[13.5px] leading-[1.55] text-slate-muted">
                    Nothing said yet. Whatever you write here reaches everybody named above and
                    nobody else.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-4">
                    {open.messages.map((m) => {
                      const mine = m.author_id === actor!.id;
                      return (
                        <li key={m.id} className={mine ? "sm:pl-10" : "sm:pr-10"}>
                          <div
                            className={`rounded-[4px] border px-3.5 py-3 ${
                              mine ? "border-slate bg-limestone" : "border-limestone-line bg-white"
                            }`}
                          >
                            <p className="text-[12.5px] font-semibold text-brass-ink">
                              {mine ? "You" : m.author_name}
                              {m.author_role && !mine ? `, ${m.author_role.replace(/_/g, " ")}` : ""}
                            </p>
                            <p className="mt-1 text-[14.5px] leading-[1.55] whitespace-pre-wrap text-slate">
                              {m.body}
                            </p>
                            <p className="mt-1.5 text-[12px] text-slate-muted">{when(m.created_at)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {open.canPost ? (
                  <div className="mt-5 border-t border-limestone-line pt-4">
                    <Composer threadId={open.thread.id} participants={open.thread.participants} />
                  </div>
                ) : (
                  <p className="mt-5 border-t border-limestone-line pt-4 text-[13px] text-slate-muted">
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
