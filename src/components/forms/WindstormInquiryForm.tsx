"use client";

import { useRef, type FormEvent } from "react";
import { FormError, Honeypot, Select, TextArea, TextInput } from "./fields";
import { readForm, useFormPost } from "./useFormPost";
import { buttonClass } from "@/components/ui/primitives";

/**
 * THE WINDSTORM BRIEF, FOR AN EXISTING BUILDING.
 *
 * EVERY QUESTION ON IT IS THE ENGINEER OF RECORD'S, from his reply of
 * 2026-09-20, and they are not the design brief's questions with the words
 * changed. A design brief asks what is being built and whether drawings exist.
 * This asks when the building went up, what is already covered, whether the
 * openings are rated, and whether the owner will open things up to verify.
 *
 * NO PRICE ANYWHERE ON IT, AND THAT IS THE SPECIFICATION. New and ongoing
 * construction carries published prices. An existing building does not, because
 * three things decide whether it can be certified at all and none of them is
 * knowable from a form: only buildings after 1988 can be certified, the work is
 * already covered so parts of it must be opened to verify, and the doors and
 * windows may need replacing first.
 *
 * ===========================================================================
 * IT DOES NOT PERSIST YET, DELIBERATELY, AND THE PERSON IS TOLD SO.
 * ===========================================================================
 *
 * `eng_windstorm_inquiries` does not exist. A migration on `main` is never
 * pending, so the table waits for a sitting with the operator at a keyboard.
 * The route validates the brief completely and then answers 503 saying nothing
 * was saved, which surfaces here as a form level banner.
 *
 * **That is why this page is not in the sitemap or the navigation.** Publishing
 * a form the firm cannot answer is worse than not publishing one, even with an
 * honest message. The page exists, it is complete, and it is advertised to
 * nobody until the table lands.
 *
 * The schema is loaded on submit rather than with the page, for the reason
 * recorded on LeadForm: `@/lib/forms` is the whole of zod on every page that
 * imports it at the top.
 */
export function WindstormInquiryForm() {
  const { state, submit, fail } = useFormPost("/api/windstorm-inquiry");
  const bannerRef = useRef<HTMLDivElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = readForm(event.currentTarget);

    /*
     * THE FLAGS ARE CONVERTED HERE AND NOWHERE ELSE, and an unanswered one
     * becomes UNDEFINED rather than false, exactly as the design brief does.
     *
     * A select reads as "" when nobody touched it. Mapping that to false would
     * record "there is no open insurance claim" when what happened is that
     * nobody answered, on questions that decide whether the firm takes the work
     * at all. So "" falls through to undefined, the schema refuses it, and the
     * person is told which question they missed.
     */
    const flag = (v: string | undefined) => (v === "yes" ? true : v === "no" ? false : undefined);

    /*
     * AND AN EMPTY YEAR IS UNDEFINED RATHER THAN ZERO. `readForm` yields a
     * trimmed string, and Number("") is 0, which would record a building
     * constructed in the year zero and fail the age rule for the wrong reason.
     */
    const payload = {
      ...values,
      yearBuilt: values.yearBuilt ? Number(values.yearBuilt) : undefined,
      yearBuiltUnknown: flag(values.yearBuiltUnknown),
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
    const parsed = forms.windstormInquirySchema.safeParse(payload);
    if (!parsed.success) {
      fail(forms.fieldErrors(parsed.error));
      return;
    }

    const ok = await submit(payload);
    if (!ok) requestAnimationFrame(() => bannerRef.current?.focus());
  }

  const busy = state.status === "submitting";
  const YES_NO = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-6">
      <Honeypot />
      {/*
        The banner is focusable and focused on failure, because on this form the
        failure is the outcome a person will usually meet and it is the thing
        that tells them what to do instead. A message nobody is sent to is a
        message that reads as the button not working.
      */}
      <div ref={bannerRef} tabIndex={-1}>
        {state.message ? <FormError message={state.message} /> : null}
      </div>

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
            { value: "buyer", label: "Buying the property" },
            { value: "agent", label: "The insurance or estate agent" },
            { value: "builder", label: "The builder" },
            { value: "contractor", label: "The roofing or window contractor" },
          ]}
          error={state.errors.askingAs}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput
          name="propertyAddress"
          label="Property address"
          autoComplete="street-address"
          error={state.errors.propertyAddress}
        />
        <TextInput name="county" label="County" optional error={state.errors.county} />
      </div>

      {/*
        THE YEAR IS ASKED AS A YEAR, NOT AS "IS IT AFTER 1988".
        Asking the rule invites a guess and records the guess. Asking the year
        records what the person actually knows, and the comparison against 1988
        is the platform's to make rather than theirs.
      */}
      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput
          name="yearBuilt"
          label="Year the building was constructed"
          optional
          hint="From the permit, the appraisal record, or the closing documents if you have them."
          error={state.errors.yearBuilt}
        />
        <Select
          name="yearBuiltUnknown"
          label="Or tell us you do not know the year"
          options={[
            { value: "no", label: "No, I have given the year above" },
            { value: "yes", label: "Yes, I do not know" },
          ]}
          error={state.errors.yearBuiltUnknown}
        />
      </div>

      <TextArea
        name="workDone"
        label="What work has been done"
        hint="A reroof, new windows, an addition, a repair after a storm. Roughly when, and by whom if you know."
        error={state.errors.workDone}
      />

      <TextArea
        name="whatIsCovered"
        label="What is already covered up"
        hint="Sheathing, framing connections, and roof deck attachment are the ones that matter. If you do not know, say so and it will be worked out on the visit."
        error={state.errors.whatIsCovered}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Select
          name="openingsRated"
          label="Are the doors and windows rated for wind"
          options={[
            { value: "yes_documented", label: "Yes, and I have the paperwork" },
            { value: "yes_undocumented", label: "Yes, but I have no paperwork" },
            { value: "no", label: "No" },
            { value: "unknown", label: "I do not know" },
          ]}
          error={state.errors.openingsRated}
        />
        <Select
          name="willOpenUp"
          label="Is the owner willing to open up covered work so it can be verified"
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "need_to_discuss", label: "It needs discussing" },
          ]}
          error={state.errors.willOpenUp}
        />
      </div>

      <TextInput
        name="deadline"
        label="Is anything driving a date"
        optional
        hint="A closing, a renewal, or a carrier asking for it by a particular day."
        error={state.errors.deadline}
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Select
          name="openInsuranceClaim"
          label="Open insurance claim on the property"
          options={YES_NO}
          error={state.errors.openInsuranceClaim}
        />
        <Select
          name="activeLitigation"
          label="Active or threatened litigation"
          options={YES_NO}
          error={state.errors.activeLitigation}
        />
        <Select
          name="priorAdverseReport"
          label="A prior adverse report on the property"
          options={YES_NO}
          error={state.errors.priorAdverseReport}
        />
      </div>

      <button type="submit" className={buttonClass("primary")} disabled={busy}>
        {busy ? "Sending" : "Send the brief"}
      </button>
    </form>
  );
}
