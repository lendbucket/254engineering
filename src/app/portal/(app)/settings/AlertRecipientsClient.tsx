"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/** Add an address the office's alerts go to (addendum item 8b, 0099). */
export function AddAlertRecipient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setDone(null);
        const result = await postJson("/api/portal/alerts", { action: "add", email });
        setBusy(false);
        if (!result.ok) return setError(result.error);
        setDone(`${email.trim()} receives the next alert.`);
        setEmail("");
        router.refresh();
      }}
    >
      <div className="min-w-[240px] flex-1">
        <label htmlFor="alert-email" className={labelClass}>Email address</label>
        <input
          id="alert-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${fieldClass} mt-1.5`}
        />
      </div>
      <button type="submit" disabled={busy || !email.trim()} className={primaryClass}>{busy ? "Adding" : "Add the address"}</button>
      <div className="w-full"><Problem message={error} /><Done message={done} /></div>
    </form>
  );
}

/** Remove one address. The row stays, stamped with who removed it and when. */
export function RemoveAlertRecipient({ id, email, last }: { id: string; email: string; last: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        className={ghostClass}
        onClick={async () => {
          const warning = last
            ? `Remove ${email}? It is the only address on the list, so alerts go back to the firm's notification address.`
            : `Remove ${email}? It stops receiving the office's alerts.`;
          if (!window.confirm(warning)) return;
          setBusy(true);
          setError(null);
          const result = await postJson("/api/portal/alerts", { action: "remove", id });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          router.refresh();
        }}
      >
        {busy ? "Removing" : "Remove"}
      </button>
      <Problem message={error} />
    </div>
  );
}
