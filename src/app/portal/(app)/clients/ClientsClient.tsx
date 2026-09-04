"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const field =
  "mt-1.5 min-h-[48px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";
const label = "block text-[13.5px] font-semibold text-[var(--navy)]";

export function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"organization" | "individual">("organization");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_client",
          kind,
          name: form.get("name"),
          clientType: form.get("clientType"),
          email: form.get("email"),
          phone: form.get("phone"),
          city: form.get("city"),
          notes: form.get("notes"),
        }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError("The network dropped that.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--navy-hover)]"
      >
        {open ? "Cancel" : "Add a client"}
      </button>

      {open ? (
        <form
          onSubmit={onSubmit}
          className="mt-4 rounded-[4px] border border-[var(--border)] bg-white p-4 sm:p-5"
        >
          <fieldset>
            <legend className={label}>Kind</legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              {/*
                THE LABEL IS WRITTEN, NOT CAPITALIZED BY CSS.

                These are the stored enum values, and `capitalize` was making
                the screen say "Organization" while the DOM said "organization".
                A screen reader and a copy and paste both get the DOM, so the
                two were disagreeing about the same word. Written out, they
                agree, and the stored value is untouched.
              */}
              {([
                ["organization", "Organization"],
                ["individual", "Individual"],
              ] as const).map(([k, label]) => (
                <label
                  key={k}
                  className={`flex min-h-[var(--tap-target)] flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border px-3 text-[13.5px] font-semibold ${
                    kind === k
                      ? "border-[var(--navy)] bg-[var(--canvas)] text-[var(--navy)]"
                      : "border-[var(--border)] text-[var(--secondary)]"
                  }`}
                >
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={label}>Name</label>
              <input id="name" name="name" required className={field} />
            </div>
            <div>
              <label htmlFor="clientType" className={label}>Type</label>
              <select id="clientType" name="clientType" defaultValue="" className={field}>
                <option value="">Not set</option>
                <option value="homeowner">Homeowner</option>
                <option value="solar_installer">Solar installer</option>
                <option value="lender">Lender</option>
                <option value="realtor">Realtor</option>
                <option value="title">Title</option>
                <option value="general_contractor">General contractor</option>
                <option value="roofer">Roofer</option>
                <option value="insurance_carrier">Insurance carrier</option>
                <option value="municipality">Municipality</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="email" className={label}>Email</label>
              <input id="email" name="email" type="email" className={field} />
            </div>
            <div>
              <label htmlFor="phone" className={label}>Phone</label>
              <input id="phone" name="phone" type="tel" className={field} />
            </div>
            <div>
              <label htmlFor="city" className={label}>City</label>
              <input id="city" name="city" className={field} />
            </div>
            <div>
              <label htmlFor="notes" className={label}>Notes</label>
              <input id="notes" name="notes" className={field} />
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-[3px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] text-[var(--red)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-4 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {busy ? "Saving..." : "Add the client"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Converting a lead.
 *
 * One action produces a client and a file and links both back to the lead. The
 * lead row is never deleted: it carries the attribution the public sites
 * captured, and a converted lead that vanished would take that with it.
 */
export function ConvertLead({
  lead,
  services,
  counties,
}: {
  lead: { id: string; name: string | null; email: string | null; city: string | null; service: string | null; site: string };
  services: { slug: string; name: string }[];
  counties: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_lead",
          leadId: lead.id,
          serviceSlug: form.get("serviceSlug"),
          propertyAddress: form.get("propertyAddress"),
          county: form.get("county"),
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; fileNumber?: string; fileId?: string }
        | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }
      setDone(body.fileNumber ?? "done");
      setBusy(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError("The network dropped that.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="text-[13.5px] text-[var(--green)]">
        Converted to file {done}.{" "}
        <a href="/portal/files" className="underline underline-offset-2">
          Open files
        </a>
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[40px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] hover:bg-[var(--canvas)]"
      >
        {open ? "Cancel" : "Convert to client and file"}
      </button>

      {open ? (
        <form onSubmit={onSubmit} className="mt-3 rounded-[3px] border border-[var(--border)] bg-[var(--canvas)] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor={`svc-${lead.id}`}>Service line</label>
              <select id={`svc-${lead.id}`} name="serviceSlug" defaultValue={lead.service ?? ""} className={field}>
                {services.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor={`addr-${lead.id}`}>Property address</label>
              <input id={`addr-${lead.id}`} name="propertyAddress" required defaultValue={lead.city ?? ""} className={field} />
            </div>
            <div>
              <label className={label} htmlFor={`cty-${lead.id}`}>County</label>
              <select id={`cty-${lead.id}`} name="county" defaultValue="" className={field}>
                <option value="">Derive from the city</option>
                {counties.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          {error ? (
            <p role="alert" className="mt-3 rounded-[3px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-[13.5px] text-[var(--red)]">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-3 min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60"
          >
            {busy ? "Converting..." : "Convert"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
