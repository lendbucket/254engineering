"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * THE TWO ONE-TIME ACTS OF OPENING, 254-WF-024 steps 3 and 4.
 *
 * Robert, 10:52 Central 2026-10-29: the proving charge "admin only. It is used
 * only on Robert's word, and states the charge before it runs." And the "we are
 * open" email, "enabled only when the gate reads live, and sends Robert a
 * preview first. Never sent by a board or a probe."
 *
 * The screen states and asks; every refusal lives on the server, in
 * ops-proving-charge.ts and ops-announce.ts. A button drawn here is never the
 * permission, which is why each panel shows the server's own reasons.
 */

type Proving = {
  canCharge: boolean;
  amount: string;
  reference: string;
  blockers: string[];
};

type Announcement = {
  blocked: string | null;
  contentHash: string;
  previewed: boolean;
  sent: boolean;
  recipients: number | null;
  readError: string | null;
  previewTo: string;
};

const input = "min-h-[44px] w-[min(100%,16rem)] rounded-[2px] border border-limestone-line px-3 text-[13.5px] text-[var(--ink)]";
const button = "min-h-[44px] rounded-[2px] bg-[var(--navy)] px-5 text-[13.5px] font-bold text-white disabled:opacity-50";
const label = "text-[12.5px] font-bold text-[var(--secondary)]";

export function ProvingChargePanel({ proving }: { proving: Proving }) {
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/proving-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "The proving charge did not start. Nothing was charged.");
        return;
      }
      window.location.assign(String(data.url));
    } catch {
      setError("The request did not complete. Nothing was charged.");
    } finally {
      setBusy(false);
    }
  }

  const ready = proving.canCharge && proving.blockers.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[72ch] text-[13.5px] leading-[1.6] text-[var(--ink)]">
        <span className="font-semibold">The charge:</span> {proving.amount}, taken once on Stripe&apos;s own checkout
        page from the card you enter there, under the reference {proving.reference}. Refund it in full in Stripe
        straight afterwards, then record the charge and the refund in <code>stripeAccount.proof</code>. It is used
        only on Robert&apos;s word.
      </p>

      {proving.blockers.length > 0 ? (
        <ul className="flex max-w-[72ch] flex-col gap-2 text-[13.5px] leading-[1.55] text-[var(--ink)]">
          {proving.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

      {ready ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5" htmlFor="proving-confirm">
            <span className={label}>Type {proving.reference} to confirm</span>
            <input id="proving-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={input} />
          </label>
          <label className="flex flex-col gap-1.5" htmlFor="proving-password">
            <span className={label}>Your password, entered again</span>
            <input
              id="proving-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={input}
            />
          </label>
          <button type="submit" disabled={busy} className={button}>
            {busy ? "Starting" : `Take the ${proving.amount} proving charge`}
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="max-w-[72ch] text-[13.5px] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AnnouncementPanel({ announcement }: { announcement: Announcement }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(step: "preview" | "send") {
    setBusy(step);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/launch-announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, password, contentHash: announcement.contentHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That did not work. Nothing was sent.");
        return;
      }
      setNote(String(data.message ?? "Done."));
      setPassword("");
      router.refresh();
    } catch {
      setError("The request did not complete. Check the job queue before trying again.");
    } finally {
      setBusy(null);
    }
  }

  const enabled = announcement.blocked === null && !announcement.sent;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[72ch] text-[13.5px] leading-[1.6] text-[var(--ink)]">
        First a preview goes to {announcement.previewTo}. Only then can the same announcement go to the waitlist
        {announcement.recipients === null ? "" : `, ${announcement.recipients} address${announcement.recipients === 1 ? "" : "es"}`},
        skipping anybody who asked not to be contacted.
      </p>

      {announcement.blocked ? <p className="max-w-[72ch] text-[13.5px] leading-[1.55] text-[var(--ink)]">{announcement.blocked}</p> : null}
      {announcement.readError ? <p className="max-w-[72ch] text-[13.5px] leading-[1.55] text-[var(--ink)]">{announcement.readError}</p> : null}
      {announcement.sent ? (
        <p className="max-w-[72ch] text-[13.5px] leading-[1.55] text-[var(--ink)]">This announcement has been sent to the waitlist. It is not sent twice.</p>
      ) : null}

      {enabled ? (
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5" htmlFor="announce-password">
            <span className={label}>Your password, entered again</span>
            <input
              id="announce-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={input}
            />
          </label>
          <button type="button" disabled={busy !== null} onClick={() => act("preview")} className={button}>
            {busy === "preview" ? "Sending the preview" : "Send me the preview"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !announcement.previewed}
            onClick={() => act("send")}
            className={button}
          >
            {busy === "send" ? "Sending" : "Send to the waitlist"}
          </button>
        </div>
      ) : null}

      {enabled && !announcement.previewed ? (
        <p className="text-[13.5px] text-[var(--secondary)]">Send yourself the preview first. The waitlist button opens once it is sent.</p>
      ) : null}
      {note ? <p className="text-[13.5px] text-[var(--ink)]">{note}</p> : null}
      {error ? (
        <p role="alert" className="max-w-[72ch] text-[13.5px] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
