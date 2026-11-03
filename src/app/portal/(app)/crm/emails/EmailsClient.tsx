"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, postJson, primaryClass, ghostClass } from "@/components/portal/staff-kit";

/**
 * Send one company's due sequence email, or read one reply. Robert's sales CRM
 * ruling of 2026-11-02, item R7, and his answer 6: a rep presses Send on each
 * email. The server asks again whether the email is due, consults the
 * suppression list, and refuses a second send to an address on the same day.
 */
export function SendButton({ prospectId, disabled }: { prospectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson("/api/portal/crm/queue", { action: "send_email", prospectId });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(String(result.said ?? "Sent."));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button type="button" disabled={busy || disabled} className={primaryClass} onClick={() => void send()}>
          {busy ? "Sending" : "Send this email"}
        </button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

export function ReadButton({ replyId }: { replyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function read() {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson("/api/portal/crm/queue", { action: "read_reply", replyId });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(String(result.said ?? "Read."));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button type="button" disabled={busy} className={ghostClass} onClick={() => void read()}>
          {busy ? "Recording" : "Mark read and take it from here"}
        </button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
