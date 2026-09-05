"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyboardAwareComposer } from "@/components/portal/design";
import type { Role } from "@/lib/ops-authz";

/**
 * Writing, starting a conversation, and opening a channel.
 *
 * The composer names who will be notified before anything is sent. A message
 * that quietly emails four people is one somebody regrets writing, and a
 * platform where you cannot tell who is listening is one people use carefully
 * and therefore barely.
 */

const field =
  "min-h-[48px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";

async function post(payload: Record<string, unknown>) {
  const res = await fetch("/api/portal/comms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; id?: string } | null;
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? "That did not work.");
  return body;
}

export function Composer({
  threadId,
  participants,
  selfId,
}: {
  threadId: string;
  participants: { id: string; name: string; role: Role }[];
  selfId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<
    { key: string; name: string; contentType: string; byteSize: number; preview: string | null }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const camera = useRef<HTMLInputElement | null>(null);
  const library = useRef<HTMLInputElement | null>(null);

  const mentioned = participants.filter((p) => {
    if (p.id === selfId) return false;
    const first = p.name.split(" ")[0]?.toLowerCase();
    return first && first.length > 1 && body.toLowerCase().includes(`@${first}`);
  });

  /*
   * THE UPLOAD GOES PHONE TO STORAGE, NEVER THROUGH THE SERVER.
   *
   * prepare_attachment returns a signed url and the key it will land at. A
   * twelve megabyte photograph through a serverless function is a timeout
   * waiting for a bad signal, which is the signal a technician on a roof has.
   */
  async function attach(fileList: FileList | null) {
    const chosen = [...(fileList ?? [])];
    if (chosen.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of chosen.slice(0, 6 - pending.length)) {
        const prepared = (await post({
          action: "prepare_attachment",
          threadId,
          contentType: file.type,
          byteSize: file.size,
        })) as { url: string; key: string };

        const put = await fetch(prepared.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error("That upload did not finish. Try again.");

        setPending((p) => [
          ...p,
          {
            key: prepared.key,
            name: file.name,
            contentType: file.type,
            byteSize: file.size,
            preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That attachment did not work.");
    } finally {
      setUploading(false);
      if (camera.current) camera.current.value = "";
      if (library.current) library.current.value = "";
    }
  }

  const canSend = (body.trim().length > 0 || pending.length > 0) && !busy && !uploading;

  return (
    <KeyboardAwareComposer>
      <form
        className="px-3 py-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canSend) return;
          setBusy(true);
          setError(null);
          try {
            await post({
              action: "post_message",
              threadId,
              body,
              attachments: pending.map(({ key, name, contentType, byteSize }) => ({
                key,
                name,
                contentType,
                byteSize,
              })),
            });
            setBody("");
            for (const p of pending) if (p.preview) URL.revokeObjectURL(p.preview);
            setPending([]);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "That did not work.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {pending.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-2">
            {pending.map((p) => (
              <li
                key={p.key}
                className="flex items-center gap-2 rounded-[3px] border border-[var(--border)] bg-[var(--canvas)] py-1 pr-1 pl-2"
              >
                {p.preview ? (
                  <img src={p.preview} alt="" className="h-8 w-8 rounded-[2px] object-cover" />
                ) : null}
                <span className="max-w-[12ch] truncate text-[12.5px] text-[var(--ink)]">{p.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => {
                    if (p.preview) URL.revokeObjectURL(p.preview);
                    setPending((list) => list.filter((x) => x.key !== p.key));
                  }}
                  className="grid h-8 w-8 place-items-center rounded-[2px] text-[var(--secondary)] active:bg-[var(--row-hover)]"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/*
          THE TEXTAREA GETS ITS OWN ROW, AND THE CONTROLS SIT BENEATH IT.

          Three 44px targets and their gaps take 156px of a 390 screen, which
          left the input 142px wide and wrapped its placeholder after two words
          with the second line clipped. Tap targets are not negotiable and the
          width is not available, so the row is what changes.

          Two things were tried first: a shorter placeholder, which only moved
          where it wrapped, and field-sizing content, which sizes the width as
          well as the height and squeezed it further.
        */}
        <div className="flex flex-col gap-2">
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => attach(e.target.files)}
          />

          <label htmlFor="composer" className="sr-only">
            Write a message
          </label>
          <textarea
            id="composer"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            placeholder="Write a message"
            /*
              One row that grows to max-h, and no field-sizing. field-sizing
              content was tried and sizes the WIDTH as well as the height, which
              squeezed the box until the placeholder wrapped after two words.
              The placeholder is short for the same reason: at 390 the camera,
              attach and send buttons take 148px before this starts.
            */
            className="max-h-[120px] min-h-[44px] w-full resize-none rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.4] text-[var(--navy)] outline-none focus:border-slate"
          />

          <div className="flex items-center gap-2">
            <button
            type="button"
            aria-label="Take a photograph"
            disabled={uploading || pending.length >= 6}
            onClick={() => camera.current?.click()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--border-strong)] text-[var(--navy)] active:bg-[var(--row-hover)] disabled:opacity-45 sm:hidden"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </button>
            <button
            type="button"
            aria-label="Attach a file"
            disabled={uploading || pending.length >= 6}
            onClick={() => library.current?.click()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--border-strong)] text-[var(--navy)] active:bg-[var(--row-hover)] disabled:opacity-45"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 11.5 12.5 19a4.5 4.5 0 0 1-6.4-6.4l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.6 7.6a1.5 1.5 0 0 1-2.2-2.2l7-7" />
            </svg>
          </button>
            <span className="flex-1" />
            <button
            type="submit"
            disabled={!canSend}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--navy)] text-white active:bg-[var(--ink-navy)] disabled:opacity-45"
            aria-label={busy ? "Sending" : "Send"}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m4 12 16-8-6 16-2.5-6z" />
            </svg>
          </button>
          </div>
        </div>

        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
          {uploading
            ? "Uploading."
            : mentioned.length > 0
              ? `${mentioned.map((p) => p.name).join(" and ")} will be emailed, because you named them.`
              : `${participants.length - 1 > 0 ? participants.length - 1 : "No"} other ${
                  participants.length - 1 === 1 ? "person" : "people"
                } will see this in the portal. Nobody is emailed unless you name them.`}
        </p>

        {error ? (
          <p role="alert" className="mt-2 text-[13.5px] font-semibold text-[var(--red)]">
            {error}
          </p>
        ) : null}
      </form>
    </KeyboardAwareComposer>
  );
}

export function StartDirect({ people }: { people: { id: string; name: string; role: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (people.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white"
      >
        Message somebody
      </button>
    );
  }

  return (
    <div className="rounded-[4px] border border-[var(--border)] bg-white p-3">
      <p className="text-[13.5px] font-semibold text-[var(--navy)]">Who</p>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
      <ul className="mt-2 flex flex-col gap-1.5">
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const body = await post({ action: "open_direct", profileId: p.id });
                  setOpen(false);
                  router.push(`/portal/messages?id=${body.id}`);
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "That did not work.");
                } finally {
                  setBusy(false);
                }
              }}
              className="flex min-h-[44px] w-full items-center justify-between rounded-[3px] border border-[var(--border)] px-3 text-left text-[13.5px] text-[var(--navy)] hover:border-slate disabled:opacity-50"
            >
              <span>{p.name}</span>
              <span className="text-[12px] text-[var(--secondary)]">{p.role.replace(/_/g, " ")}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 inline-flex min-h-[40px] items-center text-[13.5px] font-semibold text-[var(--secondary)]"
      >
        Cancel
      </button>
    </div>
  );
}

export function NewChannel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-[3px] border border-[var(--border)] px-4 text-[13.5px] font-semibold text-[var(--navy)] hover:border-slate"
      >
        Open a channel
      </button>
    );
  }

  return (
    <form
      className="rounded-[4px] border border-[var(--border)] bg-white p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const body = await post({ action: "create_channel", name, roles });
          setOpen(false);
          setName("");
          setRoles([]);
          router.push(`/portal/messages?id=${body.id}`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="channel-name" className="block text-[13.5px] font-semibold text-[var(--navy)]">
        Channel name
      </label>
      <input
        id="channel-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Field announcements"
        className={`${field} mt-1.5`}
        required
      />

      <fieldset className="mt-3">
        <legend className="text-[13.5px] font-semibold text-[var(--navy)]">Who can read it</legend>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {[
            ["admin", "Administrators"],
            ["engineer", "Engineers"],
            ["field_tech", "Field technicians"],
          ].map(([value, label]) => (
            <label key={value} className="flex min-h-[44px] items-center gap-2.5 text-[13.5px] text-[var(--navy)]">
              <input
                type="checkbox"
                checked={roles.includes(value)}
                onChange={(e) =>
                  setRoles((prev) => (e.target.checked ? [...prev, value] : prev.filter((r) => r !== value)))
                }
                className="h-5 w-5 accent-[var(--navy)]"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
          Anybody with one of these roles can read the channel without being added to it. A channel
          with no roles is readable by nobody, so at least one is required.
        </p>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Opening" : "Open the channel"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-4 text-[13.5px] font-semibold text-[var(--navy)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * SEARCH, AND WHY IT IS A CLIENT COMPONENT CALLING THE SAME API.
 *
 * The results come from searchMessages, which resolves the readable thread set
 * FIRST and searches inside it. That is the property the section 3 report names
 * as the place the pricing constraint would bite: search sees exactly what the
 * thread list sees, never its own set, so it cannot surface a direct message an
 * administrator is not part of.
 */
export function MessageSearch({ people }: { people: { id: string; name: string }[] }) {
  const [text, setText] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [since, setSince] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{
    results: { id: number; created_at: string; threadId: string; threadTitle: string; authorName: string; body: string; attachmentCount: number }[];
    truncated: boolean;
  } | null>(null);

  const field =
    "min-h-[44px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const r = (await post({
              action: "search_messages",
              text: text || null,
              authorId: authorId || null,
              since: since ? new Date(since).toISOString() : null,
            })) as { results: typeof found extends null ? never : NonNullable<typeof found>["results"]; truncated: boolean };
            setFound({ results: r.results, truncated: r.truncated });
          } catch (err) {
            setError(err instanceof Error ? err.message : "That search did not work.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="msg-q" className="block text-[13.5px] font-semibold text-[var(--navy)]">
          Search every conversation you can read
        </label>
        <input
          id="msg-q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A word, an address, a gate code"
          className={`mt-1.5 ${field}`}
        />

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="msg-who" className="block text-[12.5px] font-semibold text-[var(--secondary)]">
              Written by
            </label>
            <select id="msg-who" value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={`mt-1 ${field}`}>
              <option value="">Anybody</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="msg-since" className="block text-[12.5px] font-semibold text-[var(--secondary)]">
              Since
            </label>
            <input id="msg-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} className={`mt-1 ${field}`} />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-3 inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[15px] font-bold text-white active:bg-[var(--ink-navy)] disabled:opacity-50"
        >
          {busy ? "Searching" : "Search"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}

      {found ? (
        found.results.length === 0 ? (
          <p className="mt-3 text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            Nothing matched, in any conversation you can read. A direct message you are not part of
            is not searched and never will be.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[12.5px] text-[var(--secondary)]">
              {found.truncated
                ? `The first ${found.results.length} matches, newest first. Narrow it to see the rest.`
                : `${found.results.length} ${found.results.length === 1 ? "match" : "matches"}, newest first.`}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {found.results.map((r) => (
                <li key={r.id}>
                  <a
                    href={`/portal/messages?id=${r.threadId}`}
                    className="block rounded-[3px] border border-[var(--border)] p-3 hover:bg-[var(--canvas)] active:bg-[var(--row-hover)]"
                  >
                    <p className="text-[12.5px] font-semibold text-[var(--gold-deep)]">{r.threadTitle}</p>
                    <p className="mt-1 text-[13.5px] leading-[1.5] text-[var(--navy)]">
                      {r.body.length > 180 ? `${r.body.slice(0, 177)}...` : r.body}
                      {r.attachmentCount > 0 && !r.body
                        ? `${r.attachmentCount} ${r.attachmentCount === 1 ? "attachment" : "attachments"}`
                        : ""}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--secondary)]">
                      {r.authorName}, {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}
    </div>
  );
}
