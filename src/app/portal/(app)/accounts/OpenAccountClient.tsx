"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE OPERATOR'S SIDE OF THE TELEPHONE DOOR.
 *
 * Somebody rings who is not yet a customer, and the operator opens an account
 * while they are still on the call. No order is attached, because there may
 * never be one: the point of this door is that the relationship starts before
 * the work does.
 *
 * IT WAS A ROUTE WITH NO SCREEN, WHICH IS NOT BUILT.
 *
 * /api/portal/accounts/create shipped permission gated, audited and walked end
 * to end, and the only way to reach it was a POST. The operator ruling that
 * produced this component is worth keeping in front of whoever reads it next:
 * a door an operator owns and can only open with a POST is not built, and the
 * telephone path is the one this firm's operator actually uses.
 *
 * A DISCLOSURE RATHER THAN A FORM SITTING OPEN.
 *
 * The question this screen is opened with is which accounts are stuck, and that
 * answer must not be pushed down the page by a form used a few times a week.
 * Closed it is one line; open it is the whole form. It does not collapse itself
 * again on success, because the operator is on a call and may have a second
 * person to add.
 *
 * WHAT IT NEVER SHOWS, AND THE ABSENCE IS THE DESIGN.
 *
 * No password field, and no link. The route mints a set password token and
 * emails it to the address being claimed, and returns nothing. An operator
 * reading a link down the telephone would be reading out a credential, and it
 * would then live in whatever they wrote it on. The mail is the channel because
 * it goes to the address, which is what makes using it prove the address.
 */
export function OpenAccountClient() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[var(--tap-target)] inline-flex items-center rounded-[var(--radius-control)] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--navy)]"
      >
        Open an account from a call
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        setDone(null);
        try {
          const res = await fetch("/api/portal/accounts/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, organisation, email, phone }),
          });
          const data = (await res.json().catch(() => null)) as
            | { ok?: boolean; error?: string; message?: string }
            | null;
          if (!res.ok || !data?.ok) {
            setError(data?.error ?? "That did not work. Try again.");
            return;
          }
          setDone(data.message ?? "The account is open.");
          setName("");
          setOrganisation("");
          setEmail("");
          setPhone("");
          /*
           * The list above is server rendered, so it has to be re-fetched for
           * the new account to appear. Without this the operator sees a success
           * message above a list that does not contain what they just made, and
           * the reasonable conclusion is that it did not work.
           */
          router.refresh();
        } catch {
          setError("The network did not answer. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[13.5px] leading-[1.6] text-[var(--secondary)]">
        For somebody who has rung and is not yet a customer. They choose their own password from a
        link sent to the address below, so nobody here sets one or can see one.
      </p>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--navy)]">Their name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--navy)]">
            Company <span className="font-normal text-[var(--secondary)]">(optional)</span>
          </span>
          <input
            name="organisation"
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--navy)]">Email address</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-describedby={error ? "open-account-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--navy)]">
            Telephone <span className="font-normal text-[var(--secondary)]">(optional)</span>
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
          />
        </label>
      </div>

      {error ? (
        <p
          id="open-account-error"
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--red-border)] bg-[var(--red-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      {done ? (
        <p
          role="status"
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted,#f7f8f9)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--navy)]"
        >
          {done}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Opening" : "Open the account"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setDone(null);
          }}
          className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--navy)]"
        >
          Done
        </button>
      </div>
    </form>
  );
}
