"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/*
 * A partner uploads its logo (run item 19, migration 0072). The server judges
 * the file by its bytes; this form only carries it there and says what came back.
 */
export function LogoUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; note?: string; error?: string } | null>(null);

  async function submit(form: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/partner/branding", { method: "POST", body: new FormData(form) });
      const payload = (await res.json().catch(() => null)) as { ok: boolean; note?: string; error?: string } | null;
      setResult(payload ?? { ok: false, error: "That came back as nothing." });
      if (payload?.ok) router.refresh();
    } catch {
      setResult({ ok: false, error: "The network dropped that. Try again." });
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor="logo" className="text-[13.5px] font-semibold text-[var(--ink)]">
        PNG, JPEG or WebP, up to one megabyte
      </label>
      <input
        id="logo"
        name="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        required
        className="min-h-[var(--tap-target)] text-[13.5px] text-[var(--ink)]"
      />
      <button
        type="submit"
        disabled={busy}
        className="min-h-[var(--tap-target)] self-start rounded-[2px] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:opacity-45"
      >
        {busy ? "Uploading" : "Upload for approval"}
      </button>
      {result ? (
        <p role="status" className="text-[13.5px] leading-[1.6] text-[var(--ink)]">
          {result.ok ? result.note : result.error}
        </p>
      ) : null}
    </form>
  );
}
