"use client";

import { useId, type ReactNode } from "react";

/**
 * Form field primitives.
 *
 * THE ERROR IS ALWAYS ATTACHED TO ITS FIELD
 * -----------------------------------------
 * Every field renders its message through `aria-describedby` and marks itself
 * `aria-invalid`, so a screen reader hears which field is wrong at the moment it
 * reaches it rather than hearing a summary at the top and having to go looking.
 * That is the whole reason these are components: a form written with bare inputs
 * gets the visual half right and drops the announcement, and nothing in a
 * screenshot review shows it.
 *
 * Inputs are 48px tall minimum. Below about 44 a thumb misses, and a form that
 * is hard to complete on a phone is a form that does not get completed.
 */

const inputBase =
  "block w-full min-h-[48px] rounded-[3px] border bg-limestone-raised px-4 py-3 font-sans text-[1rem] text-slate-ink placeholder:text-slate-muted/60 transition-colors";

const inputTone = (invalid: boolean) =>
  invalid
    ? "border-brass-ink focus:border-brass-ink"
    : "border-limestone-line focus:border-slate-soft";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block font-sans text-[0.88rem] font-semibold text-slate"
      >
        {label}
        {optional ? (
          <span className="ml-2 font-normal text-slate-muted">optional</span>
        ) : null}
      </label>
      {hint ? <p className="mt-1 text-[0.84rem] leading-[1.5] text-slate-muted">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-2 text-[0.85rem] font-medium text-brass-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  name,
  label,
  type = "text",
  error,
  hint,
  optional,
  autoComplete,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  const id = `field-${name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputBase} ${inputTone(Boolean(error))}`}
      />
    </Field>
  );
}

export function TextArea({
  name,
  label,
  error,
  hint,
  optional,
  rows = 5,
  placeholder,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const id = `field-${name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputBase} ${inputTone(Boolean(error))} leading-[1.6]`}
      />
    </Field>
  );
}

export function Select({
  name,
  label,
  options,
  error,
  hint,
  optional,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  hint?: string;
  optional?: boolean;
  defaultValue?: string;
}) {
  const id = `field-${name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputBase} ${inputTone(Boolean(error))}`}
      >
        <option value="">Select one</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * A yes or no question as a real radio group.
 *
 * A fieldset with a legend rather than a label and two loose inputs, so the
 * question is announced once and the answers are announced as belonging to it.
 * This is the shape assistive technology expects for a choice, and it is also
 * what makes arrow key navigation work between the options.
 */
export function YesNo({
  name,
  legend,
  error,
  hint,
}: {
  name: string;
  legend: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <fieldset aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="font-sans text-[0.88rem] font-semibold text-slate">{legend}</legend>
      {hint ? <p className="mt-1 text-[0.84rem] leading-[1.5] text-slate-muted">{hint}</p> : null}
      <div className="mt-3 flex gap-3">
        {[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ].map((o) => (
          <label
            key={o.value}
            className="inline-flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-[3px] border border-limestone-line bg-limestone-raised px-5 font-sans text-[0.95rem] text-slate-ink transition-colors has-[:checked]:border-slate has-[:checked]:bg-limestone-sunk"
          >
            <input type="radio" name={name} value={o.value} className="accent-slate" />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-[0.85rem] font-medium text-brass-ink">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The honeypot.
 *
 * Positioned off screen with `left: -9999px` rather than hidden with
 * `display: none` or `hidden`, because a bot that parses styles skips anything
 * genuinely hidden and fills in what it can see in the DOM. `tabIndex={-1}` and
 * `aria-hidden` keep it away from keyboard users and screen readers, and
 * `autoComplete="off"` keeps a browser from helpfully filling it in, which is
 * the one way a real person could trip it.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="field-company">Company</label>
      <input id="field-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/** The message shown when the whole submission failed rather than one field. */
export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-[3px] border border-brass-ink/40 bg-limestone-sunk px-4 py-3 text-[0.9rem] text-slate">
      {message}
    </p>
  );
}
