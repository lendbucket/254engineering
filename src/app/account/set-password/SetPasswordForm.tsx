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
      <label htmlFor="password" className="mt-4 block text-[13px] font-bold text-slate">
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
        className="mt-1.5 w-full rounded-[3px] border border-limestone-line px-3 py-2.5 text-[15px] text-slate"
      />
      <p className="mt-1.5 text-[12.5px] text-slate-muted">At least {minLength} characters.</p>

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] bg-[#fdecec] px-3 py-2 text-[13.5px] text-[#8a1f1f]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || password.length < minLength}
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-[3px] bg-slate px-5 text-[14px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Saving" : "Set the password"}
      </button>
    </form>
  );
}
