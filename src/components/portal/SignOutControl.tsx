"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sign out from the two second factor screens, where the portal chrome (and its
 * own sign out) is not on the page.
 *
 * Product audit, 2026-10-10: both screens offered "Sign out" as a plain link to
 * /api/portal/session. A link is a GET, and that route answers only POST (sign
 * in) and DELETE (sign out), so the press answered 405 and left the half signed
 * in session in place. This sends the DELETE the chrome sends, then goes to the
 * sign in screen. A network failure says so rather than doing nothing.
 */
export function SignOutControl({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    try {
      await fetch("/api/portal/session", { method: "DELETE" });
      router.push("/portal/login");
      router.refresh();
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <>
      <button type="button" onClick={signOut} disabled={busy} className="underline disabled:opacity-60">
        {busy ? "Signing out" : label}
      </button>
      {failed ? <span role="alert"> The network dropped that. Try again.</span> : null}
    </>
  );
}
