"use client";

import { useEffect, useRef, useState } from "react";
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
  "mt-1.5 min-h-[48px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";
const label = "block text-[13.5px] font-semibold text-[var(--navy)]";

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
  const [byHand, setByHand] = useState(false);

  /*
   * SHOWN ONCE AND NEVER AGAIN.
   *
   * eng_auth_tokens stores a hash, so this string exists nowhere else the
   * moment this component drops it. That is a property worth keeping rather
   * than working around: a one time link that could be looked up later is not
   * a one time link. It does mean the panel below has to say so plainly.
   */
  const [handedLink, setHandedLink] = useState<{ url: string; expires: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const linkPanel = useRef<HTMLDivElement | null>(null);

  /*
   * BRING THE PANEL TO THEM.
   *
   * Submitting closes the form, which shortens the page, and the panel renders
   * where the form was: above wherever they are now. On a phone that put the
   * one time link off the top of the screen and left them looking at the
   * roster, which for a link shown exactly once is the difference between
   * having it and not.
   *
   * Caught in a 390 screenshot, not by reasoning about it. Focus as well as
   * scroll, so it is announced rather than merely visible.
   */
  useEffect(() => {
    if (!handedLink) return;
    linkPanel.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    linkPanel.current?.focus();
  }, [handedLink]);

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
      deliverBy: byHand ? "hand" : "email",
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
        | {
            ok: boolean;
            error?: string;
            emailSent?: boolean;
            emailError?: string | null;
            deliveredByHand?: boolean;
            setPasswordUrl?: string | null;
            setPasswordExpires?: string | null;
            linked?: boolean;
          }
        | null;

      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }

      /*
       * The account exists whether or not the mail was queued. Say which
       * happened, and say queued rather than sent, because that is what the
       * route actually did.
       */
      if (body.deliveredByHand) {
        if (body.setPasswordUrl) {
          setHandedLink({
            url: body.setPasswordUrl,
            expires: body.setPasswordExpires ?? "",
            name: String(form.get("displayName") ?? "them"),
          });
          setNotice(null);
        } else {
          /*
           * LINKED, so there is no link to hand over. That address already had
           * credentials on this shared project and keeps them. Saying "here is
           * their link" with nothing to show would be the worse failure.
           */
          setNotice(
            "Account created and linked to the password that address already uses on this project. " +
              "There is no link to send: they sign in with the password they already have.",
          );
        }
        setBusy(false);
        setOpen(false);
        router.refresh();
        return;
      }

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
          <p role="status" className="text-[13.5px] leading-[1.5] text-[var(--green)]">
            {notice}
          </p>
        ) : null}
      </div>

      {open ? (
        <form
          onSubmit={onSubmit}
          className="mt-4 rounded-[4px] border border-[var(--border)] bg-white p-4 sm:p-5"
        >
          <fieldset>
            <legend className={label}>Role</legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              {(["admin", "engineer", "field_tech"] as Role[]).map((r) => (
                <label
                  key={r}
                  className={`flex min-h-[48px] flex-1 cursor-pointer items-center gap-2 rounded-[3px] border px-3 text-[13.5px] font-semibold ${
                    role === r ? "border-slate bg-[var(--canvas)] text-[var(--navy)]" : "border-[var(--border)] text-[var(--secondary)]"
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
              <p className="mt-4 text-[13.5px] leading-[1.55] text-[var(--secondary)]">
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
                className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--navy)] outline-none focus:border-slate"
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
            <p role="alert" className="mt-4 rounded-[3px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] text-[var(--red)]">
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            No password is set here. They receive a one time link and choose their own, which
            nobody at the firm can see.
          </p>

          {/*
            WHO DELIVERS THE LINK.

            Emailing is the default and stays the default. This exists for the
            account that needs saying more than a template can say: the invite
            email announces an account and a button, and there are hires where
            the first thing the person needs is context the template has no
            business guessing at.
          */}
          <label className="mt-4 flex min-h-[var(--tap-target)] items-start gap-3 text-[13.5px] leading-[1.55] text-[var(--navy)]">
            <input
              type="checkbox"
              checked={byHand}
              onChange={(e) => setByHand(e.target.checked)}
              className="mt-[3px] h-[18px] w-[18px] shrink-0"
            />
            <span>
              Give me the link instead of emailing it.
              <span className="block text-[var(--secondary)]">
                Nothing is sent to them. The link appears once on this screen and cannot be shown
                again, because only its hash is stored.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {busy ? "Creating..." : byHand ? "Create and show me the link" : "Create and send the invite"}
          </button>
        </form>
      ) : null}

      {handedLink ? (
        <div
          ref={linkPanel}
          role="status"
          tabIndex={-1}
          className="mt-4 rounded-[3px] border border-[var(--gold-deep)] bg-[var(--gold-wash)] p-4 outline-none"
        >
          <p className="portal-kicker text-[var(--gold-deep)]">Send this to {handedLink.name}</p>
          <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--navy)]">
            Nothing was emailed. This link works once{handedLink.expires ? ` and expires ${handedLink.expires}` : ""}.
            It is not stored anywhere and will not be shown again. If you lose it, use Resend invite
            on their row, which issues a new one.
          </p>
          <p className="mt-3 break-all rounded-[3px] border border-[var(--border)] bg-white px-3 py-2.5 font-mono text-[12.5px] leading-[1.5] text-[var(--navy)]">
            {handedLink.url}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(handedLink.url)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
              className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--navy-hover)]"
            >
              {copied ? "Copied" : "Copy the link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setHandedLink(null);
                setCopied(false);
              }}
              className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-4 text-[13.5px] font-bold text-[var(--navy)]"
            >
              I have sent it
            </button>
          </div>
        </div>
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
    "inline-flex min-h-[40px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] hover:bg-[var(--canvas)] disabled:opacity-50";

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
          <span className="inline-flex min-h-[40px] items-center text-[13.5px] text-[var(--secondary)]">
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
      {notice ? <p className="mt-2 text-[12.5px] text-[var(--green)]">{notice}</p> : null}
      {error ? <p role="alert" className="mt-2 text-[12.5px] text-[var(--red)]">{error}</p> : null}
    </div>
  );
}
