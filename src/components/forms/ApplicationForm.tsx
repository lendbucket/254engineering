"use client";

import { useRef, type FormEvent } from "react";
import { FormError, Honeypot, TextArea, TextInput, YesNo } from "./fields";
import { readForm, useFormPost } from "./useFormPost";
import { buttonClass } from "@/components/ui/primitives";
import { engineerApplicationSchema, fieldErrors, technicianApplicationSchema } from "@/lib/forms";

/**
 * The two careers applications.
 *
 * They share a component because they share the accessibility work, the honeypot,
 * the submit guard, and the success handling, and only differ in five fields. The
 * `track` prop selects which five, and the server validates against a schema
 * chosen by the same value, so the two halves cannot disagree about which
 * application this is.
 */
export function ApplicationForm({ track }: { track: "engineer" | "technician" }) {
  const { state, submit, fail } = useFormPost("/api/apply");
  const successRef = useRef<HTMLDivElement>(null);

  const role = track === "engineer" ? "professional_engineer" : "field_technician";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { ...readForm(event.currentTarget), role };

    const schema = track === "engineer" ? engineerApplicationSchema : technicianApplicationSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      fail(fieldErrors(parsed.error));
      return;
    }

    const ok = await submit(values);
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
          Application received
        </p>
        <h2 className="mt-3 text-[1.4rem] leading-[1.3] font-semibold text-slate">
          Thank you. We have your application.
        </h2>
        <p className="mt-4 text-[0.98rem] leading-[1.7] text-slate-muted">
          {track === "engineer"
            ? "A person will read it, not a filter. If the firm is not in a position to bring on review engineers when your application arrives, you will be told that rather than left in a queue."
            : "A person will read it, not a filter. Assignments begin after protocol certification, and we will explain what that involves before asking you to commit any time to it."}
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
        <TextInput name="name" label="Name" autoComplete="name" error={state.errors.name} />
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
          hint="Where you are based. It determines which counties you can reach."
          error={state.errors.city}
        />
      </div>

      {track === "engineer" ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextInput
              name="licenseNumber"
              label="Texas PE license number"
              error={state.errors.licenseNumber}
            />
            <TextInput
              name="disciplines"
              label="Disciplines"
              hint="Structural, civil, and any others you practice."
              error={state.errors.disciplines}
            />
          </div>

          <YesNo
            name="tdiAppointed"
            legend="Do you hold a TDI windstorm inspection appointment?"
            hint="An appointment from the Texas Department of Insurance is not required. It is a considerable plus for coastal work."
            error={state.errors.tdiAppointed}
          />

          <TextInput
            name="availability"
            label="Availability"
            hint="Hours per week, and whether you are looking at this alongside existing practice."
            error={state.errors.availability}
          />
        </>
      ) : (
        <>
          <TextArea
            name="counties"
            label="Counties you are willing to serve"
            rows={3}
            hint="List them, or describe the radius you will drive. Be honest about the far edge of it."
            error={state.errors.counties}
          />

          <TextArea
            name="experience"
            label="Your background"
            rows={5}
            hint="Roofing, construction, inspection, insurance adjusting, trades, or military. Say what you have actually done rather than what you could learn."
            error={state.errors.experience}
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <YesNo
              name="droneLicense"
              legend="Do you hold an FAA Part 107 drone license?"
              error={state.errors.droneLicense}
            />
            <YesNo
              name="reliableVehicle"
              legend="Do you have a reliable vehicle?"
              error={state.errors.reliableVehicle}
            />
          </div>
        </>
      )}

      <TextArea
        name="message"
        label="Anything else"
        optional
        rows={4}
        error={state.errors.message}
      />

      <button type="submit" disabled={busy} className={buttonClass("primary")}>
        {busy ? "Sending" : "Submit application"}
      </button>
    </form>
  );
}
