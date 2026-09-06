"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Adding a partner.
 *
 * THE CODE IS THE ONE FIELD WORTH ARGUING ABOUT
 * ---------------------------------------------
 * It has to survive being read down a telephone, because a real referral often
 * arrives spoken rather than clicked. The server puts it through the same
 * normaliser and the same shape rule the capture endpoint uses, so a code an
 * operator can create but a customer cannot type is impossible rather than a
 * problem discovered months later as an attribution complaint.
 */
export function NewPartner() {
  const router = useRouter();
  const [organisation, setOrganisation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisation, contactName, contactEmail, code }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; id?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }
      router.push(`/portal/partners/${body.id}`);
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]";
  const label = "block text-[13.5px] font-semibold text-[var(--ink)]";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="organisation" className={label}>
          Organisation
        </label>
        <input
          id="organisation"
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          required
          className={field}
        />
      </div>

      <div>
        <label htmlFor="code" className={label}>
          Referral code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          aria-describedby="code-hint"
          className={field}
        />
        <p id="code-hint" className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
          Somebody will say this down a telephone. Three to thirty two characters.
        </p>
      </div>

      <div>
        <label htmlFor="contactName" className={label}>
          Contact
        </label>
        <input
          id="contactName"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          required
          className={field}
        />
      </div>

      <div>
        <label htmlFor="contactEmail" className={label}>
          Contact email
        </label>
        <input
          id="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          className={field}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.5] text-[var(--red)] sm:col-span-2"
        >
          {error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {busy ? "Adding" : "Add partner"}
        </button>
        <p className="mt-3 max-w-[70ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
          Adding a partner does not give anybody a login. Their people are invited from the partner
          page, one at a time, and each gets a one time link you send yourself.
        </p>
      </div>
    </form>
  );
}
