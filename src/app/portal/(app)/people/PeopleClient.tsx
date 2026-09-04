"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABEL, type Role } from "@/lib/ops-authz";

type Person = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: "invited" | "active" | "suspended";
  phone: string | null;
  license_number: string | null;
  base_county: string | null;
  coverage_counties: string[];
  last_sign_in_at: string | null;
  created_at: string;
};

const field =
  "mt-1.5 min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate";
const label = "block text-[13px] font-semibold text-slate";

/**
 * Creating an account.
 *
 * The role picker changes which fields exist, because an engineer has a licence
 * and a technician has counties, and showing both to everybody is how a form
 * teaches people to ignore it.
 *
 * There is no password field here and there never will be. See the note in
 * src/lib/ops-auth.ts: the person chooses their own behind a one time link.
 */
export function NewPersonForm({ counties }: { counties: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("field_tech");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      action: "create",
      role,
      displayName: form.get("displayName"),
      email: form.get("email"),
      phone: form.get("phone"),
      licenseNumber: form.get("licenseNumber"),
      tdiAppointment: form.get("tdiAppointment"),
      baseCity: form.get("baseCity"),
      baseCounty: form.get("baseCounty"),
      coverageCounties: form.getAll("coverageCounties"),
    };

    try {
      const res = await fetch("/api/portal/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; emailSent?: boolean; emailError?: string | null }
        | null;

      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }

      // The account exists whether or not the mail was queued. Say which
      // happened, and say queued rather than sent, because that is what the
      // route actually did.
      setNotice(
        body.emailSent
          ? "Account created and the invite is queued to send."
          : (body.emailError ?? "Account created. The invite email could not be queued."),
      );
      setBusy(false);
      setOpen(false);
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--navy-hover)]"
        >
          {open ? "Cancel" : "Add a person"}
        </button>
        {notice ? (
          <p role="status" className="text-[13.5px] leading-[1.5] text-[#14522f]">
            {notice}
          </p>
        ) : null}
      </div>

      {open ? (
        <form
          onSubmit={onSubmit}
          className="mt-4 rounded-[4px] border border-limestone-line bg-white p-4 sm:p-5"
        >
          <fieldset>
            <legend className={label}>Role</legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              {(["admin", "engineer", "field_tech"] as Role[]).map((r) => (
                <label
                  key={r}
                  className={`flex min-h-[48px] flex-1 cursor-pointer items-center gap-2 rounded-[3px] border px-3 text-[14px] font-semibold ${
                    role === r ? "border-slate bg-limestone text-slate" : "border-limestone-line text-slate-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="h-4 w-4"
                  />
                  {ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="displayName" className={label}>Full name</label>
              <input id="displayName" name="displayName" required className={field} />
            </div>
            <div>
              <label htmlFor="email" className={label}>Email</label>
              <input id="email" name="email" type="email" required className={field} />
            </div>
            <div>
              <label htmlFor="phone" className={label}>Phone (optional)</label>
              <input id="phone" name="phone" type="tel" className={field} />
            </div>
          </div>

          {role === "engineer" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="licenseNumber" className={label}>Texas PE licence number</label>
                <input id="licenseNumber" name="licenseNumber" className={field} />
              </div>
              <div>
                <label htmlFor="tdiAppointment" className={label}>TDI windstorm appointment</label>
                <select id="tdiAppointment" name="tdiAppointment" defaultValue="none" className={field}>
                  <option value="none">Not appointed</option>
                  <option value="applied">Applied</option>
                  <option value="appointed">Appointed</option>
                </select>
              </div>
            </div>
          ) : null}

          {role === "field_tech" ? (
            <div className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="baseCity" className={label}>Base city</label>
                  <input id="baseCity" name="baseCity" className={field} />
                </div>
                <div>
                  <label htmlFor="baseCounty" className={label}>Base county</label>
                  <input id="baseCounty" name="baseCounty" list="tx-counties" className={field} />
                  <datalist id="tx-counties">
                    {counties.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-[1.55] text-slate-muted">
                Coverage counties decide which job offers reach this technician. They can be set
                here or later, and dispatch will not offer work in a county that is not on the list.
              </p>
              <label htmlFor="coverageCounties" className={`${label} mt-3`}>
                Coverage counties
              </label>
              <select
                id="coverageCounties"
                name="coverageCounties"
                multiple
                size={6}
                className="mt-1.5 w-full rounded-[3px] border border-limestone-line bg-white px-3 py-2 text-[16px] text-slate outline-none focus:border-slate"
              >
                {counties.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-[3px] border border-[#f3c9c6] bg-[#fdeceb] px-3 py-2.5 text-[13.5px] text-[#8c1d18]">
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-[13px] leading-[1.55] text-slate-muted">
            No password is set here. They receive a one time link and choose their own, which
            nobody at the firm can see.
          </p>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {busy ? "Creating..." : "Create and send the invite"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Suspend, restore, resend, force reset. */
export function PersonActions({ person, selfId }: { person: Person; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/portal/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profileId: person.id }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; emailSent?: boolean }
        | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(null);
        return;
      }
      setNotice(
        action === "resend_invite"
          ? body.emailSent
            ? "Invite reissued and queued to send."
            : "Link reissued, but the email could not be queued."
          : action === "force_reset"
            ? body.emailSent
              ? "Reset link reissued and queued to send."
              : "Link reissued, but the email could not be queued."
            : action === "suspend"
              ? "Suspended."
              : "Restored.",
      );
      setBusy(null);
      router.refresh();
    } catch {
      setError("The network dropped that.");
      setBusy(null);
    }
  }

  const btn =
    "inline-flex min-h-[40px] items-center rounded-[3px] border border-limestone-line px-3 text-[13px] font-semibold text-slate hover:bg-limestone disabled:opacity-50";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {person.status === "invited" ? (
          <button type="button" disabled={busy !== null} onClick={() => run("resend_invite")} className={btn}>
            {busy === "resend_invite" ? "Sending..." : "Resend invite"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("force_reset", `Force a password reset for ${person.display_name}? Their current password stops working.`)}
            className={btn}
          >
            {busy === "force_reset" ? "Sending..." : "Force reset"}
          </button>
        )}

        {person.id === selfId ? (
          <span className="inline-flex min-h-[40px] items-center text-[13px] text-slate-muted">
            This is you
          </span>
        ) : person.status === "suspended" ? (
          <button type="button" disabled={busy !== null} onClick={() => run("restore")} className={btn}>
            {busy === "restore" ? "Restoring..." : "Restore"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("suspend", `Suspend ${person.display_name}? They are signed out immediately and cannot sign back in.`)}
            className={btn}
          >
            {busy === "suspend" ? "Suspending..." : "Suspend"}
          </button>
        )}
      </div>
      {notice ? <p className="mt-2 text-[12.5px] text-[#14522f]">{notice}</p> : null}
      {error ? <p role="alert" className="mt-2 text-[12.5px] text-[#8c1d18]">{error}</p> : null}
    </div>
  );
}
