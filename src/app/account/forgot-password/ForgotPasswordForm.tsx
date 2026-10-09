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
      <div className="mt-7 border-t border-[var(--color-limestone-line)] pt-6">
        <p role="status" className="text-[16px] leading-[1.6] font-semibold text-[var(--color-ink)]">
          {sent}
        </p>
        <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
          The link works once. If it has expired by the time you open it, ask for another from
          here.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-7 flex flex-col gap-5"
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
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">Email address</span>
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
          /* 16px is the form control step, and it is the iOS zoom guard. */
          className="min-h-[var(--tap-target)] w-full rounded-[2px] border border-[var(--color-limestone-edge)] bg-white px-3 text-[16px] text-[var(--color-ink)]"
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

      {/*
        INK, NOT RED. See the note on the sign up form, which carries the
        reasoning for all of them.
      */}
      {error ? (
        <p
          id="forgot-error"
          role="alert"
          aria-live="assertive"
          className="border-l-2 border-[var(--color-ink)] pl-3 text-[15px] leading-[1.55] font-semibold text-[var(--color-ink)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-1 flex min-h-[var(--tap-target)] w-full items-center justify-center rounded-[2px] bg-[var(--color-slate)] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Sending" : "Email me a link"}
      </button>

      <p className="text-[14px] leading-[1.6] text-[var(--color-ink-quiet)]">
        Nothing changes until you open the link and choose a new password. Your current password
        keeps working until then.
      </p>
    </form>
  );
}
