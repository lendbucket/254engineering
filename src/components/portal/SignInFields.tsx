"use client";

import { useState } from "react";

/**
 * THE SIGN-IN FORM'S PARTS, shared by the staff, customer and partner forms
 * (Robert, 2026-11-08). Presentation only: each form keeps its own state, its
 * own submit and its own endpoint; these draw the field, the password with its
 * show and hide toggle, the button and the reset link the same way on all
 * three.
 *
 * 16px in the inputs, so iOS does not zoom the page on focus. Every control is
 * at least the tap target the mobile audit asks for.
 */

export const SIGN_IN_INPUT =
  "mt-2 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/20 disabled:bg-[var(--canvas)]";

export const SIGN_IN_LABEL = "block text-[15px] font-semibold text-[var(--ink)]";

/**
 * The password, with a show and hide toggle that never submits the form.
 *
 * `name` is opt in, never defaulted. The staff and partner forms post natively
 * before hydration (method and action, asserted by security-audit), so their
 * fields are named. The customer form has no method and carries no names on
 * purpose: a submit before hydration there is a GET, and an unnamed field sends
 * nothing into the address. A default here would quietly put its password in a
 * query string.
 */
export function PasswordField({
  id,
  name,
  value,
  onChange,
  disabled,
  autoComplete = "current-password",
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="mt-5">
      <label htmlFor={id} className={SIGN_IN_LABEL}>
        Password
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${SIGN_IN_INPUT} pr-[72px]`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-controls={id}
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          disabled={disabled}
          className="absolute top-2 right-1 inline-flex min-h-[var(--tap-target)] min-w-[64px] items-center justify-center rounded-[var(--radius-control)] px-2 text-[15px] font-semibold text-[var(--navy)] underline-offset-2 hover:underline disabled:opacity-45"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

/** The one primary button. */
export function SignInButton({ busy, disabled }: { busy: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="mt-7 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[16px] font-semibold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {busy ? "Signing in" : "Sign in"}
    </button>
  );
}

/** "Forgot your password?", to the reset flow that already exists. */
export function ForgotPasswordLink({ href }: { href: string }) {
  return (
    <p className="mt-5 text-center">
      <a
        href={href}
        className="inline-flex min-h-[var(--tap-target)] items-center px-2 text-[15px] font-semibold text-[var(--navy)] underline underline-offset-2"
      >
        Forgot your password?
      </a>
    </p>
  );
}

/** The error a form shows, saying what failed in plain words. */
export function SignInError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="mt-5 text-[15px] leading-[1.5] font-semibold text-[var(--ink)]">
      {message}
    </p>
  ) : null;
}
