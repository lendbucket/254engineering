"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The second factor, at sign in.
 *
 * ONE FIELD FOR BOTH KINDS OF ANSWER
 * ----------------------------------
 * A six digit code and a recovery code go in the same box, and the endpoint
 * decides which it is by looking at it. Two fields would ask somebody who has
 * lost their phone to first understand the difference between two things they
 * have never used, at the moment they are already locked out.
 *
 * WHAT A FAILURE SAYS
 * -------------------
 * The endpoint's own words, not a generic "invalid". A code that is arithmetically
 * right and has already been used says exactly that and tells them to wait for
 * the next one, because "that code is not right" would send somebody to check a
 * phone that is working perfectly.
 */
export function MfaChallengeForm({ breakGlassOffered }: { breakGlassOffered: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showBreakGlass, setShowBreakGlass] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; redirect?: string; recoveryRemaining?: number }
        | null;

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "That did not work. Try again.");
        return;
      }
      if (typeof data.recoveryRemaining === "number") setRemaining(data.recoveryRemaining);
      /*
       * A full refresh rather than a client navigation. The cookie changed from
       * pending to full, and every server component above this needs to be
       * re-rendered against the new one.
       */
      window.location.assign(data.redirect ?? "/portal");
    } catch {
      setError("The network did not answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="mt-4 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void post({ action: "verify", code });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-[var(--navy)]">
          Code from your authenticator app
        </span>
        <input
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          /*
           * inputMode text rather than numeric, because a recovery code goes in
           * this box too and a numeric keypad cannot type one.
           */
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          required
          aria-describedby={error ? "mfa-error" : undefined}
          aria-invalid={error ? true : undefined}
          placeholder="000000 or a recovery code"
          className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
        />
      </label>

      {error ? (
        <p
          id="mfa-error"
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--red-border)] bg-[var(--red-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      {remaining !== null ? (
        <p className="text-[13px] leading-[1.55] text-[var(--secondary)]">
          You have {remaining} recovery {remaining === 1 ? "code" : "codes"} left.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Checking" : "Continue"}
      </button>

      <p className="text-[13px] leading-[1.55] text-[var(--secondary)]">
        Lost your phone? Use one of the recovery codes you saved when you enrolled. Each one works
        once.
      </p>

      {/*
        THE BREAK GLASS IS ONLY OFFERED WHEN IT IS ACTUALLY SET.
        Rendering it always would advertise a bypass that does not exist and
        teach somebody to look for it. The server decides; this only draws it.
      */}
      {breakGlassOffered ? (
        <div className="mt-1 border-t border-[var(--border)] pt-3">
          {showBreakGlass ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[var(--navy)]">
                  Break glass token
                </span>
                <input
                  name="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                  className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
                />
              </label>
              <p className="text-[13px] leading-[1.55] text-[var(--secondary)]">
                This removes the second factor from this account and you will set up a new one
                immediately. It is recorded in the audit trail.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void post({ action: "break_glass", token })}
                className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-60"
              >
                Remove the second factor
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowBreakGlass(true)}
              className="min-h-[var(--tap-target)] text-[13px] font-semibold text-[var(--navy)] underline"
            >
              I have lost my phone and my recovery codes
            </button>
          )}
        </div>
      ) : null}
    </form>
  );
}
