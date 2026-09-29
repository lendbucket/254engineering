"use client";

import { useState } from "react";

/**
 * Ask for a password reset link.
 *
 * WHAT IT DOES NOT DO, AND THE ABSENCES ARE THE DESIGN
 * ----------------------------------------------------
 * No "we could not find that address" branch. The server answers one sentence
 * whatever happened, and a form that rendered a different state for the two
 * cases would put the enumeration oracle back in the browser after the route
 * was careful to keep it out. That is not a theoretical concern here: a reset
 * form is the one place where the honest answer is a complete answer to the
 * question an attacker is actually asking.
 *
 * No password field. Nothing is chosen here; the link is where a password is
 * set, on a screen reached only from the address.
 *
 * THE RESULT REPLACES THE FORM RATHER THAN SITTING UNDER IT, as on sign up. A
 * form still standing after a successful submit invites a second submit, and
 * the second one is the request that gets rate limited.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  /* Off screen, never filled by a person. See the route's honeypot note. */
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="mt-5 rounded-[3px] border border-[var(--border)] bg-[var(--surface-muted,#f7f8f9)] px-3.5 py-3">
        <p role="status" className="text-[13.5px] leading-[1.6] text-[var(--navy)]">
          {sent}
        </p>
        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--secondary)]">
          The link works once. If it has expired by the time you open it, ask for another from
          here.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-5 flex flex-col gap-3.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/account/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, website }),
          });
          const data = (await res.json().catch(() => null)) as
            | { ok?: boolean; error?: string; message?: string }
            | null;
          if (!res.ok || !data?.ok) {
            setError(data?.error ?? "That did not work. Try again.");
            return;
          }
          setSent(data.message ?? "Check your email.");
        } catch {
          setError("The network did not answer. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-[var(--navy)]">Email address</span>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          aria-describedby={error ? "forgot-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="min-h-[var(--tap-target)] rounded-[3px] border border-[var(--border)] px-3 text-[16px] text-[var(--navy)]"
        />
      </label>

      {/*
        THE HONEYPOT. Hidden from people and from assistive technology, and
        named for something a bot expects to fill. aria-hidden and tabIndex
        together are what keep it out of a screen reader's way; display:none
        alone is skipped by some bots too, which defeats the point.
      */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p
          id="forgot-error"
          role="alert"
          className="rounded-[3px] border border-[var(--red-border)] bg-[var(--red-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="min-h-[var(--tap-target)] rounded-[3px] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Sending" : "Email me a link"}
      </button>

      <p className="text-[13px] leading-[1.55] text-[var(--secondary)]">
        Nothing changes until you open the link and choose a new password. Your current password
        keeps working until then.
      </p>
    </form>
  );
}
