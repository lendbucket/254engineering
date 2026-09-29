"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/account/session", { method: "DELETE" });
        router.push("/account/login");
        router.refresh();
      }}
      className="min-h-[var(--tap-target)] text-[14px] font-semibold text-[var(--color-link)] disabled:opacity-50"
    >
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
