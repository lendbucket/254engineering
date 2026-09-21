"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Recording that somebody answered a windstorm brief.
 *
 * IT RECORDS A REPLY RATHER THAN SENDING ONE, the same ruling the design brief
 * carries. Whether an existing building can be certified turns on what is
 * covered up and what can be opened to verify it, so the reply is a person
 * telling another person what can be established about their property. A button
 * that offered to send it would be offering to write an engineering opinion
 * from a dropdown. This marks that the conversation happened, which is the fact
 * `responded_at` exists to hold.
 */
export function MarkAnswered({ inquiryId, name }: { inquiryId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      {error ? (
        <p role="alert" className="mb-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/portal/windstorm-inquiries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_answered", inquiryId }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !body?.ok) {
              setError(body?.error ?? "That did not work.");
              return;
            }
            router.refresh();
          } catch {
            setError("The network dropped that. Try again.");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-50"
      >
        {busy ? "Recording" : `I have replied to ${name.split(" ")[0]}`}
      </button>
    </div>
  );
}
