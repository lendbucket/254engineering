"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/primitives";
import { Panel } from "@/components/admin/shell";

/**
 * Create an onboarding and send its invite.
 *
 * The invite URL is shown back to the operator whether or not the email sent.
 * That is deliberate: an operator whose mail bounced needs a way to get the link
 * to the person, and hiding it would leave them holding a record they cannot act
 * on. The outcome of the send is reported beside it rather than assumed, so
 * "invited" never silently means "invited and they never heard".
 */
export function NewOnboarding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    inviteUrl: string;
    emailed: boolean;
    outcome: string;
  } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    const f = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        personName: f.get("personName"),
        email: f.get("email"),
        phone: f.get("phone") || undefined,
        role: f.get("role"),
        notes: f.get("notes") || undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      inviteUrl?: string;
      emailed?: boolean;
      emailOutcome?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Could not create the onboarding.");
      return;
    }
    setResult({
      inviteUrl: body.inviteUrl ?? "",
      emailed: Boolean(body.emailed),
      outcome: body.emailOutcome ?? "unknown",
    });
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        Invite somebody
      </button>
    );
  }

  const fields: [string, string, string, boolean][] = [
    ["personName", "Full name", "text", true],
    ["email", "Email", "email", true],
    ["phone", "Phone", "tel", false],
  ];

  return (
    <Panel title="New onboarding">
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {fields.map(([name, label, type, required]) => (
          <div key={name}>
            <label htmlFor={name} className="block font-sans text-[14px] font-bold text-slate">
              {label}
              {required ? null : <span className="ml-2 font-normal text-slate-muted">optional</span>}
            </label>
            <input
              id={name}
              name={name}
              type={type}
              required={required}
              className="mt-2 block min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-4 py-3 font-sans text-[16px] text-slate-ink focus:border-slate"
            />
          </div>
        ))}

        <div>
          <label htmlFor="role" className="block font-sans text-[14px] font-bold text-slate">
            Role
          </label>
          <select
            id="role"
            name="role"
            className="mt-2 block min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-4 py-3 font-sans text-[16px] text-slate-ink focus:border-slate"
          >
            <option value="engineer">Professional Engineer</option>
            <option value="field_tech">Field Inspection Technician</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="notes" className="block font-sans text-[14px] font-bold text-slate">
            Notes <span className="ml-2 font-normal text-slate-muted">optional</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="mt-2 block w-full rounded-[3px] border border-limestone-line bg-white px-4 py-3 font-sans text-[16px] text-slate-ink focus:border-slate"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="border-l-4 border-brass bg-limestone px-4 py-3 text-[14.5px] text-slate sm:col-span-2"
          >
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="border-l-4 border-brass bg-limestone px-4 py-3 sm:col-span-2">
            <p className="text-[12px] font-bold tracking-[0.12em] text-brass-ink uppercase">
              {result.emailed ? "Invited, email queued" : `Invited, email ${result.outcome}`}
            </p>
            <p className="mt-2 break-all text-[14px] leading-[1.6] text-slate">{result.inviteUrl}</p>
            <p className="mt-2 text-[13.5px] text-slate-muted">
              Copy this link if the email did not arrive. Generating a new one invalidates it.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={busy} className={buttonClass("primary")}>
            {busy ? "Creating" : "Create and send invite"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")}>
            Close
          </button>
        </div>
      </form>
    </Panel>
  );
}
