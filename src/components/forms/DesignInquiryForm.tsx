"use client";

import { useRef, type FormEvent } from "react";
import { FormError, Honeypot, Select, TextArea, TextInput } from "./fields";
import { readForm, useFormPost } from "./useFormPost";
import { buttonClass } from "@/components/ui/primitives";

/**
 * THE DESIGN INQUIRY FORM.
 *
 * A BRIEF RATHER THAN A CONTACT, which is why it is not the lead form with
 * extra fields. 0050 argues the distinction: eleven defined answers, three of
 * which decide whether the firm takes the work at all, and those three cannot
 * live in a free text message column where nothing can constrain them.
 *
 * THE SCHEMA IS LOADED ON SUBMIT, not with the page, for the reason recorded on
 * LeadForm: `@/lib/forms` is the whole of zod, about 68KB on every page that
 * imports it at the top. Validation only ever happened inside onSubmit anyway.
 *
 * NO PRICE ANYWHERE ON IT, AND THAT IS THE SPECIFICATION RATHER THAN AN
 * OMISSION. Design is hourly with a fixed fee quoted from the engineer's own
 * estimate and a minimum engagement. Nothing this form collects can be turned
 * into a number, so it does not imply one, and the confirmation promises a
 * conversation rather than a figure.
 */
export function DesignInquiryForm() {
  const { state, submit, fail } = useFormPost("/api/design-inquiry");
  const successRef = useRef<HTMLDivElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = readForm(event.currentTarget);

    /*
     * THE THREE FLAGS ARE CONVERTED HERE AND NOWHERE ELSE, and an unanswered
     * one becomes UNDEFINED rather than false.
     *
     * A select reads as "" when nobody touched it. Mapping that to false would
     * record "there is no open insurance claim" when what happened is that
     * nobody was asked, on the three questions that decide whether the firm
     * declines the work. So "" falls through to undefined, the schema refuses
     * it, and the person is told which question they missed.
     */
    const flag = (v: string | undefined) => (v === "yes" ? true : v === "no" ? false : undefined);
    const payload = {
      ...values,
      soilReport: flag(values.soilReport),
      openInsuranceClaim: flag(values.openInsuranceClaim),
      activeLitigation: flag(values.activeLitigation),
      priorAdverseReport: flag(values.priorAdverseReport),
    };

    let forms: typeof import("@/lib/forms");
    try {
      forms = await import("@/lib/forms");
    } catch {
      fail({}, "The form could not be checked, which usually means the connection dropped. Try again in a moment.");
      return;
    }
    const parsed = forms.designInquirySchema.safeParse(payload);
    if (!parsed.success) {
      fail(forms.fieldErrors(parsed.error));
      return;
    }

    const ok = await submit(payload);
    if (ok) requestAnimationFrame(() => successRef.current?.focus());
  }

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white p-7"
      >
        <p className="text-[12px] font-bold tracking-[0.14em] text-brass-ink uppercase">Received</p>
        <h2 className="mt-3 font-display text-[24px] leading-[1.3] font-bold text-slate">
          Thank you. Your brief is with us.
        </h2>
        <p className="mt-4 text-[0.98rem] leading-[1.7] text-slate-muted">
          Somebody will read it and come back to you within one business day. Design work is quoted
          from the engineer&rsquo;s own estimate of the hours, so the reply will be a conversation
          about scope rather than a figure from a calculator. If anything you have described puts
          the work outside what the firm will take on, we will say so plainly and tell you who to
          ask instead.
        </p>
      </div>
    );
  }

  const busy = state.status === "submitting";
  const YES_NO = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-6">
      <Honeypot />
      {state.message ? <FormError message={state.message} /> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput name="name" label="Name" autoComplete="name" error={state.errors.name} />
        <TextInput name="email" label="Email" type="email" autoComplete="email" error={state.errors.email} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput name="phone" label="Phone" type="tel" autoComplete="tel" optional error={state.errors.phone} />
        <Select
          name="askingAs"
          label="You are"
          options={[
            { value: "owner", label: "The property owner" },
            { value: "builder", label: "The builder or contractor" },
            { value: "architect", label: "The architect" },
            { value: "engineer", label: "Another engineer" },
          ]}
          error={state.errors.askingAs}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Select
          name="workKind"
          label="The work"
          options={[
            { value: "new_construction", label: "New construction" },
            { value: "addition", label: "An addition" },
            { value: "repair", label: "A repair" },
            { value: "remediation", label: "Remediation of existing damage" },
          ]}
          error={state.errors.workKind}
        />
        <Select
          name="deliverable"
          label="What you need produced"
          options={[
            { value: "sealed_plans", label: "Sealed plans" },
            { value: "sealed_letter", label: "A sealed letter" },
            { value: "repair_specification", label: "A repair specification" },
            { value: "design_review", label: "A review of somebody else's design" },
          ]}
          error={state.errors.deliverable}
        />
      </div>

      <TextInput
        name="propertyAddress"
        label="Property address"
        autoComplete="street-address"
        error={state.errors.propertyAddress}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput
          name="jurisdiction"
          label="City or county that will review it"
          optional
          hint="Who issues the permit, where you know."
          error={state.errors.jurisdiction}
        />
        <TextInput
          name="permitStatus"
          label="Where the permit stands"
          optional
          hint="Not applied, submitted, or returned with comments."
          error={state.errors.permitStatus}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput name="squareFeet" label="Square feet" type="number" optional error={state.errors.squareFeet} />
        <TextInput name="storeys" label="Storeys" type="number" optional error={state.errors.storeys} />
      </div>

      <TextArea
        name="drawings"
        label="What drawings or reports already exist"
        optional
        rows={3}
        hint="Architectural drawings, a survey, a prior engineer's report. Say what you have rather than attaching it here."
        error={state.errors.drawings}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Select
          name="soilReport"
          label="Is there a geotechnical or soil report"
          optional
          options={YES_NO}
          error={state.errors.soilReport}
        />
        <TextInput
          name="deadline"
          label="The date you are working to"
          optional
          hint="As you understand it, even if it is approximate."
          error={state.errors.deadline}
        />
      </div>

      {/*
        * THE THREE THAT DECIDE WHETHER THE FIRM TAKES THE WORK.
        *
        * Grouped and introduced rather than mixed in above, because a person
        * answering them should understand they are not administrative. The
        * specification is that the customer is told in the first conversation
        * rather than after paying, and these are the three that produce that
        * conversation.
        *
        * None is optional. An unanswered one is refused by name rather than
        * recorded as "no".
        */}
      <div className="rounded-[4px] border border-limestone-line bg-white/60 p-5">
        <p className="font-display text-[18px] leading-[1.3] font-bold text-slate">
          Three questions that change what the work is
        </p>
        <p className="mt-2 text-[0.95rem] leading-[1.65] text-slate-muted">
          Each of these changes what an engineer can properly produce, and sometimes whether the
          firm will take the job at all. Answering yes does not rule anything out on its own. It
          means somebody will talk it through with you before any work is agreed, rather than
          afterwards.
        </p>

        <div className="mt-5 space-y-6">
          <Select
            name="openInsuranceClaim"
            label="Is there an open insurance claim on this property"
            options={YES_NO}
            error={state.errors.openInsuranceClaim}
          />
          <Select
            name="activeLitigation"
            label="Is there active or threatened litigation"
            options={YES_NO}
            error={state.errors.activeLitigation}
          />
          <Select
            name="priorAdverseReport"
            label="Has another engineer already reported adversely on this property"
            options={YES_NO}
            error={state.errors.priorAdverseReport}
          />
        </div>
      </div>

      <button type="submit" disabled={busy} className={buttonClass("primary")}>
        {busy ? "Sending" : "Send this brief"}
      </button>
    </form>
  );
}
