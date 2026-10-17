"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * A TECHNICIAN SUBMITS A CREDENTIAL: THE TYPE, THE ISSUING STATE, THE EXPIRY.
 * Operator ruling of 2026-10-09. No number, no image, no document: a credential
 * is a record, never a document. The state is asked only of a kind that has one
 * and the expiry only of a kind that expires; the server refuses anything else,
 * and refuses a date that has passed.
 */
export type Kind = { kind: string; label: string; asksState: boolean; asksExpiry: boolean };

export function SubmitCredentialForm({ kinds, states }: { kinds: Kind[]; states: { code: string; name: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState(kinds[0]?.kind ?? "");
  const [state, setState] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const chosen = kinds.find((k) => k.kind === kind) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaid(null);
    /*
     * A fetch that throws (no signal, a dropped connection) is caught, so the
     * button is never left disabled with nothing said. Found by the product
     * audit's brute force, 2026-10-09, reproduced twice: offline, the submit
     * stayed "busy" for good. The sentence is the one the jobs screen uses.
     */
    let body: { ok?: boolean; error?: string } | null = null;
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_credential",
          kind,
          issuingState: chosen?.asksState ? state : null,
          expiresOn: chosen?.asksExpiry ? expiresOn : null,
        }),
      });
      body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    } catch {
      setBusy(false);
      setSaid({ ok: false, text: "The network dropped that. Nothing was submitted. Try again when you have signal." });
      return;
    }
    setBusy(false);
    if (!body?.ok) {
      setSaid({ ok: false, text: body?.error ?? "That did not go through. Nothing was submitted." });
      return;
    }
    setSaid({ ok: true, text: `${chosen?.label ?? "Your credential"} is submitted, awaiting verification.` });
    setState("");
    setExpiresOn("");
    router.refresh();
  }

  if (kinds.length === 0) return null;
  const field = "mt-1.5 min-h-[var(--tap-target)] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--ink)]";

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <div>
        <label htmlFor="cred-kind" className="block text-[14px] font-semibold text-[var(--ink)]">
          Credential
        </label>
        <select id="cred-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {chosen?.asksState ? (
        <div>
          <label htmlFor="cred-state" className="block text-[14px] font-semibold text-[var(--ink)]">
            Issuing state
          </label>
          <select id="cred-state" value={state} onChange={(e) => setState(e.target.value)} className={field}>
            <option value="">Choose a state</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {chosen?.asksExpiry ? (
        <div>
          <label htmlFor="cred-expiry" className="block text-[14px] font-semibold text-[var(--ink)]">
            Expiry date
          </label>
          <input id="cred-expiry" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={field} />
        </div>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[2px] bg-[var(--navy)] px-5 text-[15px] font-bold text-white disabled:opacity-50"
      >
        Submit for verification
      </button>
      {said ? (
        <p role={said.ok ? "status" : "alert"} className="text-[14px] font-semibold text-[var(--ink)]">
          {said.text}
        </p>
      ) : null}
    </form>
  );
}
