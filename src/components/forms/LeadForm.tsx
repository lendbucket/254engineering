"use client";

import { useRef, type FormEvent } from "react";
import { FormError, Honeypot, Select, TextArea, TextInput } from "./fields";
import { readForm, useFormPost } from "./useFormPost";
import { buttonClass } from "@/components/ui/primitives";
import { contactSchema, fieldErrors, waitlistSchema } from "@/lib/forms";

/**
 * The contact and waitlist form.
 *
 * One component for both because the fields are the same and only the framing
 * and the required-ness of the message differ. Two components would be two
 * places to fix an accessibility bug, and the waitlist is the form that matters
 * most right now, so it is the one that would go stale.
 *
 * The success state replaces the form rather than sitting above it. Leaving a
 * filled-in form on screen next to a confirmation invites a second submission,
 * and the confirmation has to be the loudest thing on the page for the person to
 * believe the send worked.
 */
export function LeadForm({
  variant,
  serviceOptions,
  defaultService,
}: {
  variant: "contact" | "waitlist";
  serviceOptions: string[];
  /** Pre-selected when the visitor arrived from a specific service page. */
  defaultService?: string;
}) {
  const { state, submit, fail } = useFormPost("/api/lead");
  const successRef = useRef<HTMLDivElement>(null);

  const isWaitlist = variant === "waitlist";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = readForm(event.currentTarget);

    // The same schema the route validates against, so a field cannot be required
    // in one place and optional in the other.
    const parsed = (isWaitlist ? waitlistSchema : contactSchema).safeParse(values);
    if (!parsed.success) {
      fail(fieldErrors(parsed.error));
      return;
    }

    const ok = await submit({ ...values, form: variant });
    // Move focus to the confirmation. Without this a keyboard or screen reader
    // user submits, the form disappears, and focus falls back to the body with
    // no announcement that anything happened.
    if (ok) requestAnimationFrame(() => successRef.current?.focus());
  }

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="rounded-[3px] border border-brass/45 bg-limestone-raised p-7"
      >
        <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
          {isWaitlist ? "You are on the list" : "Received"}
        </p>
        <h2 className="mt-3 text-[1.4rem] leading-[1.3] font-semibold text-slate">
          {isWaitlist ? "Thank you. We have your details." : "Thank you. Your message is with us."}
        </h2>
        <p className="mt-4 text-[0.98rem] leading-[1.7] text-slate-muted">
          {isWaitlist
            ? "You will hear from us directly when firm registration is active and the service you asked about is open, before any general announcement. Nothing else will be sent to you in the meantime."
            : "Someone will read it and reply to the address you gave. If it is about work the firm cannot take yet, we will say so plainly rather than leave you waiting."}
        </p>
      </div>
    );
  }

  const busy = state.status === "submitting";

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-6">
      <Honeypot />
      {state.message ? <FormError message={state.message} /> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput
          name="name"
          label="Name"
          autoComplete="name"
          error={state.errors.name}
        />
        <TextInput
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={state.errors.email}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput
          name="phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          optional
          error={state.errors.phone}
        />
        <TextInput
          name="city"
          label="City"
          autoComplete="address-level2"
          optional
          hint="Which part of Texas the property or project is in."
          error={state.errors.city}
        />
      </div>

      <Select
        name="service"
        label="Service of interest"
        optional
        defaultValue={defaultService}
        options={serviceOptions.map((s) => ({ value: s, label: s }))}
        error={state.errors.service}
      />

      <TextArea
        name="message"
        label={isWaitlist ? "Anything we should know" : "What do you need"}
        optional={isWaitlist}
        rows={5}
        hint={
          isWaitlist
            ? "Volume, the counties you work in, or the deadline you are working toward. It helps us contact the right people first."
            : "The property or project, what has to be produced, and the date it has to be in hand."
        }
        error={state.errors.message}
      />

      <button type="submit" disabled={busy} className={buttonClass("primary")}>
        {busy ? "Sending" : isWaitlist ? "Join the waitlist" : "Send message"}
      </button>
    </form>
  );
}
