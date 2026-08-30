"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/primitives";

/**
 * The passphrase form.
 *
 * WHY THE REDIRECT TARGET IS VALIDATED HERE
 * -----------------------------------------
 * The middleware puts the path the operator was heading for into `?next=`. Using
 * it back without checking is an open redirect, and an open redirect on a login
 * screen is a phishing primitive: a link that shows the real domain, takes a
 * real passphrase, and lands somewhere else. Only a path that starts with a
 * single slash and then `/admin` is accepted; anything else goes to the
 * dashboard.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/admin")) return "/admin";
  // "//evil.com" is a protocol relative URL, not a path.
  if (raw.startsWith("//")) return "/admin";
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: form.get("passphrase") }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Sign in failed.");
        setBusy(false);
        return;
      }
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch {
      setError("Sign in failed. Check the connection and try again.");
      setBusy(false);
    }
  }

  return (
    /*
     * method="post" and a real action, and this is a security fix rather than a
     * nicety.
     *
     * The form had neither, so before React hydrated a submit was a NATIVE GET
     * to the current URL, which put the passphrase in the query string:
     * /admin/login?passphrase=... It reached browser history, the server log,
     * and the Referer header of the next request. Caught on the live site,
     * because a real network is slow enough to submit before hydration in a way
     * localhost never is.
     *
     * With these two attributes the same pre hydration submit posts the
     * credential in a request body to the endpoint that expects it, and the
     * route handles the form encoded case with a redirect. onSubmit still
     * intercepts once hydrated, so the normal path is unchanged.
     */
    <form onSubmit={onSubmit} method="post" action="/api/admin/session" noValidate>
      <label htmlFor="passphrase" className="block font-sans text-[14px] font-bold text-slate">
        Passphrase
      </label>
      <input
        id="passphrase"
        name="passphrase"
        type="password"
        autoComplete="current-password"
        required
        className="mt-2 block w-full min-h-[48px] rounded-[3px] border border-limestone-line bg-white px-4 py-3 font-sans text-[16px] text-slate-ink transition-colors focus:border-slate"
      />
      {error ? (
        <p role="alert" className="mt-3 border-l-4 border-brass bg-limestone px-4 py-3 text-[14.5px] leading-[1.6] text-slate">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`${buttonClass("primary")} mt-5 w-full`}>
        {busy ? "Checking" : "Sign in"}
      </button>
    </form>
  );
}
