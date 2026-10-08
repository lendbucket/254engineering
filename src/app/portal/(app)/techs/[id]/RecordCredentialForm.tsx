"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Record one credential, verified by the administrator recording it.
 *
 * Every rule that decides whether this is accepted lives in recordCredential on
 * the server: the kinds dispatch reads, a required expiration where the kind
 * expires, the insurer and policy for insurance. This form says what it needs
 * and shows the server's sentence when it refuses, rather than keeping a
 * second copy of the rules that could disagree with the first.
 *
 * Design V10: choices are rows with a radio and a 1px rule between them,
 * inputs keep a 1px border, the button is square.
 */
export function RecordCredentialForm({
  profileId,
  kinds,
}: {
  profileId: string;
  kinds: { kind: string; label: string; expires: boolean }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState(kinds[0]?.kind ?? "");
  const [label, setLabel] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const chosen = kinds.find((k) => k.kind === kind);
  const insurance = kind === "vehicle_insurance";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_credential", profileId, kind, label, issuedOn, expiresOn }),
      });
      const out = await res.json().catch(() => ({ ok: false, error: "The answer could not be read." }));
      if (!out.ok) {
        setError(out.error ?? "That was not recorded.");
      } else {
        setDone(`${chosen?.label ?? "The credential"} was recorded and verified.`);
        setLabel("");
        setIssuedOn("");
        setExpiresOn("");
        router.refresh();
      }
    } catch {
      setError("That was not recorded, because the connection failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <fieldset>
        <legend className="text-[13px] font-semibold text-[var(--ink)]">Credential</legend>
        <ul className="mt-2 border-t border-[var(--row-rule)]">
          {kinds.map((k) => (
            <li key={k.kind} className="border-b border-[var(--row-rule)]">
              <label className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2 text-[15px] text-[var(--ink)]">
                <input
                  type="radio"
                  name="credential-kind"
                  value={k.kind}
                  checked={kind === k.kind}
                  onChange={() => setKind(k.kind)}
                  className="h-[18px] w-[18px] accent-[var(--navy)]"
                />
                <span>
                  {k.label}
                  <span className="block text-[13px] text-[var(--secondary)]">
                    {k.expires ? "Expires, so its expiration date is required" : "Does not expire"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className="text-[13px] font-semibold text-[var(--ink)]">
            {insurance ? "Insurer and policy number" : "Label"}
          </span>
          <span className="block text-[13px] text-[var(--secondary)]">
            {insurance ? "Required, as written on the declarations page." : "Optional. What the document says it is."}
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)]"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-[var(--ink)]">{insurance ? "Effective date" : "Issue date"}</span>
          <input
            type="date"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)]"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-[var(--ink)]">
            Expiration date{chosen?.expires ? "" : ", if any"}
          </span>
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)]"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-[2px] bg-[var(--navy)] px-5 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
        >
          {busy ? "Recording" : "Record and verify"}
        </button>
        {done ? (
          <p role="status" className="text-[14px] text-[var(--ink)]">
            {done}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-semibold leading-[1.55] text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
