"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * OPEN THIS FILE'S CONVERSATION. Operator ruling, 2026-10-15.
 *
 * Every file has had a thread since messaging shipped, and nothing on any
 * screen could reach it: the open_file_thread action had no caller, so the
 * office, the technician and the engineer could only message each other
 * directly, one pair at a time. One button, on the three screens a file is
 * worked from, opens it.
 *
 * Opening it also brings the participants up to date, because fileThread adds
 * whoever is on the file now: an engineer assigned after the thread began is
 * added the next time anybody presses this.
 */
export function FileThreadButton({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_file_thread", fileId }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string } | null;
      if (!res.ok || !body?.ok || !body.id) {
        setError(body?.error ?? "The conversation could not be opened.");
        setBusy(false);
        return;
      }
      router.push(`/portal/messages?id=${body.id}`);
    } catch {
      setError("The network dropped that. Try again when you have signal.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="inline-flex min-h-[48px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-4 text-[15px] font-semibold text-[var(--ink)] disabled:opacity-50"
      >
        {busy ? "Opening" : "Messages on this file"}
      </button>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13.5px] leading-[1.5] font-semibold text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
