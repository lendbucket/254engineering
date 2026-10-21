"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * The client half of the office ready screens (2026-10-20): the field and
 * button styles the portal already uses, one way to post, and one way to say
 * what failed. Every control posts and refreshes rather than keeping a local
 * copy, because the server is the only thing that knows what another member of
 * staff changed thirty seconds ago.
 *
 * AN ERROR SAYS WHAT FAILED, IN PLAIN WORDS. The server's sentence is shown as
 * it came, and a dropped connection says that nothing may have been saved
 * rather than pretending to know.
 */

export const fieldClass =
  "min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/20";
export const labelClass = "block text-[14px] font-semibold text-[var(--ink)]";
export const primaryClass =
  "inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:opacity-50";
export const ghostClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--ink)] hover:border-[var(--navy)] disabled:opacity-50";

export type PostResult = { ok: true; [key: string]: unknown } | { ok: false; error: string };

export async function postJson(url: string, payload: Record<string, unknown>): Promise<PostResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body?.ok) {
      return { ok: false, error: typeof body?.error === "string" ? body.error : `The server answered ${res.status} and said nothing more. Nothing was confirmed as saved.` };
    }
    return body as PostResult;
  } catch {
    return { ok: false, error: "The connection dropped before the server answered, so this may not have been saved. Reload the page and check before trying again." };
  }
}

export function Problem({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 max-w-[70ch] text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
      {message}
    </p>
  );
}

export function Done({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="mt-3 max-w-[70ch] text-[14px] leading-[1.5] text-[var(--ink)]">
      {message}
    </p>
  );
}

/**
 * One button that posts one payload. `confirm` asks first, for anything that
 * moves money or tells a customer something. `done` is what to say when it
 * worked; the page then refreshes to show the new state.
 */
export function ActionButton({
  url,
  payload,
  children,
  confirm,
  done,
  tone = "ghost",
}: {
  url: string;
  payload: Record<string, unknown>;
  children: ReactNode;
  confirm?: string;
  done?: string;
  tone?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={tone === "primary" ? primaryClass : ghostClass}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError(null);
          setOk(null);
          const result = await postJson(url, payload);
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOk(done ?? "Done.");
          router.refresh();
        }}
      >
        {busy ? "Working" : children}
      </button>
      <Problem message={error} />
      <Done message={ok} />
    </div>
  );
}
