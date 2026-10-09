"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountSetPasswordForm({ token, minLength }: { token: string; minLength: number }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/account/set-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setError(data.error ?? "That did not work.");
            return;
          }
          router.push("/account/login");
        } catch {
          setError("The request did not complete. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="password" className="mt-7 block text-[13px] font-semibold text-[var(--color-ink)]">
        Choose a password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="new-password"
        minLength={minLength}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        /* 16px is the form control step, and it is the iOS zoom guard. */
        className="mt-2 min-h-[var(--tap-target)] w-full rounded-[2px] border border-[var(--color-limestone-edge)] bg-white px-3 text-[16px] text-[var(--color-ink)]"
      />
      <p className="mt-2 text-[13px] text-[var(--color-ink-quiet)]">
        At least {minLength} characters.
      </p>

      {/* Ink, not red. See the note on the sign up form for why. */}
      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-5 border-l-2 border-[var(--color-ink)] pl-3 text-[15px] leading-[1.55] font-semibold text-[var(--color-ink)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || password.length < minLength}
        className="mt-6 inline-flex min-h-[var(--tap-target)] w-full items-center justify-center rounded-[2px] bg-[var(--color-slate)] px-5 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving" : "Set the password"}
      </button>
    </form>
  );
}
