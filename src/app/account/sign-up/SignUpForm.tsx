"use client";

import { useState } from "react";

/**
 * The self service sign up form.
 *
 * WHAT IT DOES NOT DO, AND THE ABSENCES ARE THE DESIGN
 * ----------------------------------------------------
 * No password field. A password typed here would have to be held somewhere
 * between this form and the address being proven, and the only honest places to
 * hold it are the session and the database, both of which mean this platform
 * stores a credential for an address nobody has shown they can open. The link
 * is where a password is chosen, on a screen reached only from that address.
 *
 * No "already have an account?" branch on the result. The server answers one
 * sentence whatever happened, and a form that rendered a different state for
 * the two cases would put the oracle back in the browser after the route was
 * careful to keep it out.
 *
 * THE RESULT REPLACES THE FORM RATHER THAN SITTING UNDER IT. A form still
 * standing after a successful submit invites a second submit, and the second
 * one is the request that gets rate limited.
 */
export function SignUpForm() {
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
          The link lasts 3 days. If it has expired by the time you open it, sign in and the page
          will send you a fresh one.
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
          const res = await fetch("/api/account/sign-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, organisation, email, phone, website }),
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
        <span className="text-[13px] font-semibold text-[var(--navy)]">Your name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          className="min-h-[var(--tap-target)] rounded-[3px] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-[var(--navy)]">
          Company <span className="font-normal text-[var(--secondary)]">(optional)</span>
        </span>
        <input
          name="organisation"
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          autoComplete="organization"
          className="min-h-[var(--tap-target)] rounded-[3px] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
        />
      </label>

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
          aria-describedby={error ? "sign-up-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="min-h-[var(--tap-target)] rounded-[3px] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-[var(--navy)]">
          Telephone <span className="font-normal text-[var(--secondary)]">(optional)</span>
        </span>
        <input
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          inputMode="tel"
          className="min-h-[var(--tap-target)] rounded-[3px] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
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
          id="sign-up-error"
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
        {busy ? "Sending" : "Create the account"}
      </button>

      <p className="text-[13px] leading-[1.55] text-[var(--secondary)]">
        You choose a password from the link we send. Nobody here can see it, and the account cannot
        do anything until that link is opened.
      </p>
    </form>
  );
}
