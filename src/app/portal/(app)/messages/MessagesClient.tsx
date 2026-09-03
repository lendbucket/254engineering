"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Writing, starting a conversation, and opening a channel.
 *
 * The composer names who will be notified before anything is sent. A message
 * that quietly emails four people is one somebody regrets writing, and a
 * platform where you cannot tell who is listening is one people use carefully
 * and therefore barely.
 */

const field =
  "min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate";

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
}: {
  threadId: string;
  participants: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Who a mention would reach, computed the same way the server does: first
   * names of the people already on this thread. Shown live so somebody typing
   * "@rob" can see it landed before they send.
   */
  const mentioned = participants.filter((p) => {
    const first = p.name.trim().split(/\s+/)[0]?.toLowerCase();
    return first && first.length > 1 && body.toLowerCase().includes(`@${first}`);
  });

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        setError(null);
        try {
          await post({ action: "post_message", threadId, body });
          setBody("");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="composer" className="sr-only">
        Write a message
      </label>
      <textarea
        id="composer"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write a message. Use @ and a first name to get somebody's attention."
        className="w-full rounded-[3px] border border-limestone-line bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-slate outline-none focus:border-slate"
      />

      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-slate-muted">
        {mentioned.length > 0
          ? `${mentioned.map((p) => p.name).join(" and ")} will be emailed, because you named them.`
          : `${participants.length - 1 > 0 ? participants.length - 1 : "No"} other ${
              participants.length - 1 === 1 ? "person" : "people"
            } will see this in the portal. Nobody is emailed unless you name them.`}
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-[13.5px] font-semibold text-[#a3241c]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !body.trim()}
        className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-[3px] bg-brass px-6 text-[15px] font-bold text-slate-ink transition-colors hover:bg-brass-light disabled:opacity-50"
      >
        {busy ? "Sending" : "Send"}
      </button>
    </form>
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
        className="inline-flex min-h-[44px] items-center justify-center rounded-[3px] bg-brass px-4 text-[14px] font-bold text-slate-ink"
      >
        Message somebody
      </button>
    );
  }

  return (
    <div className="rounded-[4px] border border-limestone-line bg-white p-3">
      <p className="text-[13px] font-semibold text-slate">Who</p>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] font-semibold text-[#a3241c]">
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
              className="flex min-h-[44px] w-full items-center justify-between rounded-[3px] border border-limestone-line px-3 text-left text-[14px] text-slate hover:border-slate disabled:opacity-50"
            >
              <span>{p.name}</span>
              <span className="text-[12px] text-slate-muted">{p.role.replace(/_/g, " ")}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 inline-flex min-h-[40px] items-center text-[13px] font-semibold text-slate-muted"
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
        className="inline-flex min-h-[44px] items-center justify-center rounded-[3px] border border-limestone-line px-4 text-[14px] font-semibold text-slate hover:border-slate"
      >
        Open a channel
      </button>
    );
  }

  return (
    <form
      className="rounded-[4px] border border-limestone-line bg-white p-3"
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
      <label htmlFor="channel-name" className="block text-[13px] font-semibold text-slate">
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
        <legend className="text-[13px] font-semibold text-slate">Who can read it</legend>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {[
            ["admin", "Administrators"],
            ["engineer", "Engineers"],
            ["field_tech", "Field technicians"],
          ].map(([value, label]) => (
            <label key={value} className="flex min-h-[44px] items-center gap-2.5 text-[14px] text-slate">
              <input
                type="checkbox"
                checked={roles.includes(value)}
                onChange={(e) =>
                  setRoles((prev) => (e.target.checked ? [...prev, value] : prev.filter((r) => r !== value)))
                }
                className="h-5 w-5 accent-[#1d2a35]"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-slate-muted">
          Anybody with one of these roles can read the channel without being added to it. A channel
          with no roles is readable by nobody, so at least one is required.
        </p>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-[#a3241c]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[44px] items-center rounded-[3px] bg-brass px-4 text-[14px] font-bold text-slate-ink disabled:opacity-50"
        >
          {busy ? "Opening" : "Open the channel"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line px-4 text-[14px] font-semibold text-slate"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
