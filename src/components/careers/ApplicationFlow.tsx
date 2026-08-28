"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ENGINEER_DISCIPLINES,
  TECHNICIAN_BACKGROUNDS,
  YEARS_OPTIONS,
  engineerApplicationSchema,
  engineerSteps,
  fieldErrors,
  technicianApplicationSchema,
  technicianSteps,
  type StepDef,
} from "@/lib/application-schemas";
import { CheckboxGroup, CountyPicker, FileField, StepProgress, type UploadState } from "./fields";
import { Honeypot, Select, TextArea, TextInput, YesNo } from "@/components/forms/fields";
import { buttonClass } from "@/components/ui/primitives";
import { business } from "@/config/business";

/**
 * The application flow, both roles.
 *
 * ONE COMPONENT, TWO SCHEMAS
 * --------------------------
 * The two applications ask different questions and share every hard part: step
 * validation, state that survives a back button, uploads that report their own
 * progress, a review screen, and a submit that must never lie about whether it
 * worked. Building them twice would mean fixing the upload failure state twice
 * and, realistically, fixing it once.
 *
 * STATE SURVIVES, AND THAT IS NOT A NICETY
 * ----------------------------------------
 * The answers persist to sessionStorage on every change. A technician filling
 * this in on a phone gets a call, switches app, comes back, and the browser has
 * discarded the page: without persistence that is an application lost at step
 * three, and they do not start again. Uploads persist too, because the file is
 * already in storage and re-uploading it over a rural connection is the worst
 * thing to ask twice.
 *
 * WHY THE UPLOAD HAPPENS ON SELECTION
 * -----------------------------------
 * Not on submit. A slow upload should cost time while somebody is still typing,
 * not at the moment they press send, which is when a failure is most likely to
 * lose them and least likely to be retried.
 */

type Track = "engineer" | "technician";
type Values = Record<string, unknown>;

const STORAGE_PREFIX = "254-application-";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Older mobile browsers. Shape matters because the server validates it.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function ApplicationFlow({ track }: { track: Track }) {
  const isEngineer = track === "engineer";
  const schema = isEngineer ? engineerApplicationSchema : technicianApplicationSchema;
  const steps: StepDef[] = isEngineer ? engineerSteps : technicianSteps;
  const roleKey = isEngineer ? "professional_engineer" : "field_technician";

  const [ready, setReady] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [values, setValues] = useState<Values>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const headingRef = useRef<HTMLDivElement>(null);

  // ---- restore, then persist ----

  useEffect(() => {
    const key = STORAGE_PREFIX + track;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          applicationId?: string;
          values?: Values;
          step?: number;
          uploads?: Record<string, UploadState>;
        };
        setApplicationId(parsed.applicationId || newId());
        setValues(parsed.values ?? {});
        setStep(Math.min(parsed.step ?? 0, steps.length - 1));
        // An upload left mid flight cannot be resumed, so it comes back empty
        // rather than pretending to still be in progress.
        const restored = parsed.uploads ?? {};
        for (const k of Object.keys(restored)) {
          if (restored[k]?.status === "uploading") restored[k] = { status: "empty" };
        }
        setUploads(restored);
      } else {
        setApplicationId(newId());
      }
    } catch {
      setApplicationId(newId());
    }
    setReady(true);
  }, [track, steps.length]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(
        STORAGE_PREFIX + track,
        JSON.stringify({ applicationId, values, step, uploads }),
      );
    } catch {
      // A full or disabled sessionStorage must not break the form.
    }
  }, [ready, track, applicationId, values, step, uploads]);

  // ---- attribution, captured once ----

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const get = (k: string) => params.get(k) || undefined;
    setValues((v) => ({
      ...v,
      landingPath: v.landingPath ?? window.location.pathname,
      referrer: v.referrer ?? (document.referrer || undefined),
      utmSource: v.utmSource ?? get("utm_source"),
      utmMedium: v.utmMedium ?? get("utm_medium"),
      utmCampaign: v.utmCampaign ?? get("utm_campaign"),
      utmContent: v.utmContent ?? get("utm_content"),
      utmTerm: v.utmTerm ?? get("utm_term"),
    }));
  }, []);

  const set = useCallback((key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }, []);

  // ---- uploads ----

  const upload = useCallback(
    async (field: string, kind: string, file: File) => {
      setUploads((u) => ({ ...u, [field]: { status: "uploading", filename: file.name } }));
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId,
            kind,
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });
        const body = (await res.json()) as { ok: boolean; url?: string; path?: string; error?: string };
        if (!res.ok || !body.ok || !body.url || !body.path) {
          throw new Error(body.error || "The upload could not be prepared.");
        }

        const put = await fetch(body.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error("The file did not finish uploading.");

        setUploads((u) => ({
          ...u,
          [field]: {
            status: "done",
            filename: file.name,
            path: body.path!,
            size: file.size,
            contentType: file.type,
          },
        }));
        set(field, {
          path: body.path,
          filename: file.name,
          size: file.size,
          contentType: file.type,
        });
      } catch (err) {
        setUploads((u) => ({
          ...u,
          [field]: {
            status: "error",
            message:
              (err instanceof Error ? err.message : "The upload failed.") +
              ` You can try again, or email the file to ${business.email}.`,
          },
        }));
        set(field, undefined);
      }
    },
    [applicationId, set],
  );

  const clearUpload = (field: string) => {
    setUploads((u) => ({ ...u, [field]: { status: "empty" } }));
    set(field, undefined);
  };

  // ---- step validation ----

  const validateStep = (index: number): boolean => {
    const fields = steps[index].fields;
    const mask = Object.fromEntries(fields.map((f) => [f, true as const]));
    // Pick the step's fields out of the same schema the server uses, so a rule
    // cannot be stricter in one place than the other.
    const stepSchema = (schema as unknown as z.ZodObject<z.ZodRawShape>).pick(mask);
    const parsed = stepSchema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    setErrors(fieldErrors(parsed.error));
    return false;
  };

  const goTo = (index: number) => {
    setStep(index);
    setFormError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    if (!validateStep(step)) return;
    goTo(Math.min(step + 1, steps.length - 1));
  };
  const back = () => goTo(Math.max(step - 1, 0));

  // ---- submit ----

  async function submit() {
    if (!validateStep(step)) return;
    const payload = { ...values, role: roleKey, applicationId };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      // Send them to the first step that owns a failing field, rather than
      // showing an error on a screen that does not contain the problem.
      const bad = Object.keys(errs)[0];
      const owner = steps.findIndex((s) => s.fields.includes(bad));
      setFormError("Something earlier needs attention. We have taken you back to it.");
      if (owner >= 0 && owner !== step) goTo(owner);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: Record<string, string>;
        message?: string;
      };
      if (res.ok && body.ok) {
        try {
          sessionStorage.removeItem(STORAGE_PREFIX + track);
        } catch {
          // Nothing to do; the application is already recorded.
        }
        setDone(true);
        requestAnimationFrame(() => headingRef.current?.focus());
        return;
      }
      if (body.errors) {
        setErrors(body.errors);
        const bad = Object.keys(body.errors)[0];
        const owner = steps.findIndex((s) => s.fields.includes(bad));
        setFormError("Something needs attention before this can be sent.");
        if (owner >= 0) goTo(owner);
        return;
      }
      // The honest failure. No false success, and a route out that does not
      // depend on this form working.
      setFormError(
        body.message ||
          `Your application did not send. Nothing was saved, so please try again. If it keeps failing, email ${business.email} and we will take it from there.`,
      );
    } catch {
      setFormError(
        `Your application did not send, and it looks like a connection problem rather than anything you entered. Your answers are still here. Try again, or email ${business.email}.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="min-h-[420px]" aria-hidden="true" />;
  }

  if (done) {
    return (
      <div
        ref={headingRef}
        tabIndex={-1}
        className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white p-7 sm:p-9"
      >
        <p className="text-[12px] font-bold tracking-[0.14em] text-brass-ink uppercase">
          Application received
        </p>
        <h2 className="mt-3 font-display text-[26px] leading-[1.25] font-bold text-slate">
          Thank you. Your application is with us.
        </h2>
        <div className="mt-5 space-y-4 text-[0.98rem] leading-[1.7] text-slate-muted">
          <p>
            A confirmation is on its way to the address you gave. A person reads every application,
            not a filter, and you will get a reply either way.
          </p>
          <p>
            {isEngineer
              ? "If the firm is not in a position to bring on a review engineer when your application arrives, you will be told that plainly rather than left in a queue."
              : "Assignments begin after protocol certification, and we will explain what that involves before asking you to commit any time to it."}
          </p>
          <p className="text-[0.9rem]">
            Your reference is <span className="font-mono text-slate">{applicationId.slice(0, 8)}</span>.
            Quote it if you need to get in touch about this application.
          </p>
        </div>
      </div>
    );
  }

  const current = steps[step];
  const isReview = current.id === "review";

  return (
    <div
      data-testid="application-flow"
      className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6 sm:p-8"
    >
      <StepProgress steps={steps} current={step} />

      <div ref={headingRef} tabIndex={-1} className="mt-6 outline-none">
        <h2 className="font-display text-[23px] leading-[1.25] font-bold text-slate">{current.title}</h2>
        <p className="mt-2 text-[0.94rem] leading-[1.6] text-slate-muted">{current.blurb}</p>
      </div>

      {formError ? (
        <p
          role="alert"
          className="mt-5 border-l-4 border-brass bg-limestone px-4 py-3 text-[14.5px] leading-[1.6] text-slate"
        >
          {formError}
        </p>
      ) : null}

      <div className="relative mt-7 space-y-6">
        <Honeypot />

        {current.id === "contact" ? (
          <>
            <TextInput name="fullName" label="Full name" autoComplete="name" error={errors.fullName} value={(values.fullName as string) ?? ""} onChange={(v) => set("fullName", v)} />
            <div className="grid gap-6 sm:grid-cols-2">
              <TextInput
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email} value={(values.email as string) ?? ""} onChange={(v) => set("email", v)}
              />
              <TextInput
                name="phone"
                label="Phone"
                type="tel"
                autoComplete="tel"
                error={errors.phone} value={(values.phone as string) ?? ""} onChange={(v) => set("phone", v)}
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextInput name="city" label="City" autoComplete="address-level2" error={errors.city} value={(values.city as string) ?? ""} onChange={(v) => set("city", v)} />
              {isEngineer ? (
                <TextInput name="state" label="State" autoComplete="address-level1" error={errors.state} value={(values.state as string) ?? ""} onChange={(v) => set("state", v)} />
              ) : (
                <TextInput
                  name="countyOfResidence"
                  value={(values.countyOfResidence as string) ?? ""}
                  onChange={(v) => set("countyOfResidence", v)}
                  label="County you live in"
                  error={errors.countyOfResidence}
                />
              )}
            </div>
          </>
        ) : null}

        {current.id === "coverage" ? (
          <>
            <CountyPicker
              value={(values.countiesServed as string[]) ?? []}
              onChange={(next) => set("countiesServed", next)}
              error={errors.countiesServed}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <YesNo
                name="reliableVehicle"
                value={(values.reliableVehicle as string) ?? ""}
                onChange={(v) => set("reliableVehicle", v)}
                legend="Do you have a reliable vehicle?"
                error={errors.reliableVehicle}
              />
              <YesNo
                name="willingToClimb"
                value={(values.willingToClimb as string) ?? ""}
                onChange={(v) => set("willingToClimb", v)}
                legend="Are you willing to climb roofs?"
                hint="Worked safely, and never past what conditions allow."
                error={errors.willingToClimb}
              />
            </div>
          </>
        ) : null}

        {current.id === "licensure" ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextInput
                name="peLicenseNumber"
                value={(values.peLicenseNumber as string) ?? ""}
                onChange={(v) => set("peLicenseNumber", v)}
                label="Texas PE license number"
                error={errors.peLicenseNumber}
              />
              <TextInput
                name="yearFirstLicensedTexas"
                value={(values.yearFirstLicensedTexas as string) ?? ""}
                onChange={(v) => set("yearFirstLicensedTexas", v)}
                label="Year first licensed in Texas"
                error={errors.yearFirstLicensedTexas}
              />
            </div>
            <Select
              name="discipline"
              value={(values.discipline as string) ?? ""}
              onChange={(v) => set("discipline", v)}
              label="Discipline"
              options={ENGINEER_DISCIPLINES.map((d) => ({ value: d, label: d }))}
              error={errors.discipline}
            />
            <TextArea
              name="otherStateLicenses"
              value={(values.otherStateLicenses as string) ?? ""}
              onChange={(v) => set("otherStateLicenses", v)}
              label="Other state licenses"
              optional
              rows={3}
              hint="States and numbers, if you hold any."
              error={errors.otherStateLicenses}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <YesNo
                name="tdiAppointed"
                value={(values.tdiAppointed as string) ?? ""}
                onChange={(v) => set("tdiAppointed", v)}
                legend="Do you hold a TDI windstorm appointment?"
                error={errors.tdiAppointed}
              />
              <YesNo
                name="tdiWilling"
                value={(values.tdiWilling as string) ?? ""}
                onChange={(v) => set("tdiWilling", v)}
                legend="Would you be willing to obtain one?"
                hint="The firm supports the application and covers the cost."
                error={errors.tdiWilling}
              />
            </div>
          </>
        ) : null}

        {current.id === "experience" && !isEngineer ? (
          <>
            <CheckboxGroup
              legend="Your background"
              options={TECHNICIAN_BACKGROUNDS}
              value={(values.backgrounds as string[]) ?? []}
              onChange={(next) => set("backgrounds", next)}
              error={errors.backgrounds}
            />
            {((values.backgrounds as string[]) ?? []).includes("Other") ? (
              <TextInput
                name="backgroundOther"
                label="Tell us what"
                error={errors.backgroundOther} value={(values.backgroundOther as string) ?? ""} onChange={(v) => set("backgroundOther", v)}
              />
            ) : null}
            <Select
              name="yearsExperience"
              value={(values.yearsExperience as string) ?? ""}
              onChange={(v) => set("yearsExperience", v)}
              label="Years of relevant experience"
              options={YEARS_OPTIONS.map((y) => ({ value: y, label: y }))}
              error={errors.yearsExperience}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <YesNo
                name="part107"
                value={(values.part107 as string) ?? ""}
                onChange={(v) => set("part107", v)}
                legend="Do you hold an FAA Part 107 drone license?"
                error={errors.part107}
              />
              <YesNo
                name="liabilityInsurance"
                value={(values.liabilityInsurance as string) ?? ""}
                onChange={(v) => set("liabilityInsurance", v)}
                legend="Do you carry general liability insurance?"
                error={errors.liabilityInsurance}
              />
            </div>
          </>
        ) : null}

        {current.id === "experience" && isEngineer ? (
          <>
            <Select
              name="yearsStructural"
              value={(values.yearsStructural as string) ?? ""}
              onChange={(v) => set("yearsStructural", v)}
              label="Years of structural practice"
              options={YEARS_OPTIONS.map((y) => ({ value: y, label: y }))}
              error={errors.yearsStructural}
            />
            <TextArea
              name="sealedWork"
              value={(values.sealedWork as string) ?? ""}
              onChange={(v) => set("sealedWork", v)}
              label="Residential and light commercial work you have personally sealed"
              rows={6}
              hint="Recent years. What the work was, and what you took responsible charge of. This is the part that decides the answer."
              error={errors.sealedWork}
            />
            <TextInput
              name="employmentStatus"
              value={(values.employmentStatus as string) ?? ""}
              onChange={(v) => set("employmentStatus", v)}
              label="Current employment status"
              error={errors.employmentStatus}
            />
            <TextArea
              name="currentEorRoles"
              value={(values.currentEorRoles as string) ?? ""}
              onChange={(v) => set("currentEorRoles", v)}
              label="Current engineer of record roles"
              optional
              rows={3}
              hint="Any firm registrations where you are currently named."
              error={errors.currentEorRoles}
            />
          </>
        ) : null}

        {current.id === "documents" ? (
          <>
            <FileField
              id="upload-resume"
              label="Resume"
              required={isEngineer}
              help={
                isEngineer
                  ? "PDF or image, up to 10MB. Required for this seat, because a licence number alone does not describe practice."
                  : "PDF or image, up to 10MB. Optional. Plenty of good technicians do not keep one."
              }
              state={uploads.resume ?? { status: "empty" }}
              onSelect={(file) => upload("resume", "resume", file)}
              onClear={() => clearUpload("resume")}
              error={errors.resume}
            />
            {isEngineer ? (
              <FileField
                id="upload-license"
                label="License verification or wallet card"
                help="PDF or a photo. Optional."
                state={uploads.licenseDocument ?? { status: "empty" }}
                onSelect={(file) => upload("licenseDocument", "license", file)}
                onClear={() => clearUpload("licenseDocument")}
                error={errors.licenseDocument}
              />
            ) : (
              <FileField
                id="upload-certifications"
                label="Certifications"
                help="Any inspection, trade, or Part 107 certificates. PDF or images. Optional."
                state={uploads.certifications ?? { status: "empty" }}
                onSelect={(file) => upload("certifications", "certifications", file)}
                onClear={() => clearUpload("certifications")}
                error={errors.certifications}
              />
            )}
          </>
        ) : null}

        {current.id === "experience" ? (
          <>
            {/*
              Optional, and labelled optional on every field.

              These add evaluative substance without asking for anything
              sensitive. Nothing here is a credential, an identifier, or a
              number: a link somebody chose to publish, a date, and a paragraph.
            */}
            <TextInput
              name="profileUrl"
              label="LinkedIn or portfolio"
              type="url"
              optional
              hint="A full web address, if you have one worth reading."
              error={errors.profileUrl}
              value={(values.profileUrl as string) ?? ""}
              onChange={(v) => set("profileUrl", v)}
            />
            <TextInput
              name="availability"
              label="Earliest availability"
              type="date"
              optional
              hint="Roughly when you could start. An estimate is fine."
              error={errors.availability}
              value={(values.availability as string) ?? ""}
              onChange={(v) => set("availability", v)}
            />
            <TextArea
              name="coverNote"
              label="Anything you want to add"
              optional
              rows={5}
              hint="Up to 1000 characters. Read by a person, not scored."
              error={errors.coverNote}
              value={(values.coverNote as string) ?? ""}
              onChange={(v) => set("coverNote", v)}
            />
          </>
        ) : null}

        {current.id === "experience" && isEngineer ? (
          <>
            {/*
              References, on the engineering seat only, and entirely optional.

              A reference is evaluative for a licensed role in a way it is not
              for dispatched field work. The permission line is not decoration:
              nobody named here is contacted without asking the applicant first,
              and the schema comment records that so a copy change cannot detach
              the promise from the field.
            */}
            <fieldset className="rounded-[4px] border border-limestone-line p-5">
              <legend className="px-2 font-sans text-[14px] font-bold text-slate">
                References, optional
              </legend>
              <p className="mt-1 text-[14px] leading-[1.6] text-slate-muted">
                Two people who have seen your work. They are contacted only after we ask you, and
                never as part of reading your application.
              </p>
              {(["referenceOne", "referenceTwo"] as const).map((key, i) => {
                const ref = (values[key] as Record<string, string> | undefined) ?? {};
                const setRef = (part: string, v: string) =>
                  set(key, { ...ref, [part]: v });
                return (
                  <div key={key} className="mt-5 space-y-4">
                    <p className="text-[12px] font-bold tracking-[0.12em] text-brass-ink uppercase">
                      Reference {i + 1}
                    </p>
                    <TextInput
                      name={`${key}Name`}
                      label="Name"
                      optional
                      value={ref.name ?? ""}
                      onChange={(v) => setRef("name", v)}
                    />
                    <TextInput
                      name={`${key}Relationship`}
                      label="How they know your work"
                      optional
                      value={ref.relationship ?? ""}
                      onChange={(v) => setRef("relationship", v)}
                    />
                    <TextInput
                      name={`${key}Contact`}
                      label="Phone or email"
                      optional
                      value={ref.contact ?? ""}
                      onChange={(v) => setRef("contact", v)}
                    />
                  </div>
                );
              })}
            </fieldset>
          </>
        ) : null}

        {isReview ? (
          <ReviewSummary
            steps={steps.slice(0, -1)}
            values={values}
            onEdit={(index) => goTo(index)}
          />
        ) : null}

        {isReview ? (
          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-limestone-line bg-limestone px-4 py-4">
              <input
                type="checkbox"
                checked={values.consent === true}
                onChange={(e) => set("consent", e.target.checked ? true : undefined)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-slate"
              />
              <span className="text-[0.93rem] leading-[1.6] text-slate-ink">
                I agree that {business.name} may contact me about this application. I understand a
                background check may be requested later in the process, and that nothing of that
                kind is being collected by this form.
              </span>
            </label>
            {errors.consent ? (
              <p className="mt-2 text-[0.85rem] font-medium text-brass-ink">{errors.consent}</p>
            ) : null}

            {/*
              The attestation, separate from the consent above it.

              They used to be one sentence and one tick. They are different
              undertakings: consent is permission to be contacted, this is the
              applicant certifying what they wrote is true. Somebody can happily
              agree to the first without having read back the second, and a
              single checkbox collected both without ever asking for the second.
            */}
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[3px] border border-limestone-line bg-limestone px-4 py-4">
              <input
                type="checkbox"
                checked={values.attestation === true}
                onChange={(e) => set("attestation", e.target.checked ? true : undefined)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-slate"
              />
              <span className="text-[0.93rem] leading-[1.6] text-slate-ink">
                I certify that the information I have provided is accurate to the best of my
                knowledge.
              </span>
            </label>
            {errors.attestation ? (
              <p className="mt-2 text-[0.85rem] font-medium text-brass-ink">{errors.attestation}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        {isReview ? (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={buttonClass("primary")}
          >
            {submitting ? "Sending" : "Submit application"}
          </button>
        ) : (
          <button type="button" onClick={next} className={buttonClass("primary")}>
            Continue
          </button>
        )}
        {step > 0 ? (
          <button type="button" onClick={back} className={buttonClass("secondary")}>
            Back
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The read back on the review step. */
function ReviewSummary({
  steps,
  values,
  onEdit,
}: {
  steps: StepDef[];
  values: Values;
  onEdit: (index: number) => void;
}) {
  const render = (key: string, value: unknown): string | null => {
    if (value == null || value === "") return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return value.join(", ");
    }
    if (typeof value === "object" && value !== null && "filename" in value) {
      return String((value as { filename: string }).filename);
    }
    if (value === true) return "Yes";
    return String(value);
  };

  const labelFor = (key: string) =>
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .replace(/\bTdi\b/, "TDI")
      .replace(/\bPe\b/, "PE")
      .replace(/\bEor\b/, "engineer of record")
      .replace(/\bPart107\b/i, "Part 107");

  return (
    <div className="space-y-6">
      {steps.map((s, i) => {
        const rows = s.fields
          .map((f) => [f, render(f, values[f])] as const)
          .filter(([, v]) => v !== null);
        if (rows.length === 0) return null;
        return (
          <div key={s.id} className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[12px] font-bold tracking-[0.14em] text-brass-ink uppercase">
                {s.title}
              </h3>
              <button
                type="button"
                onClick={() => onEdit(i)}
                className="min-h-[44px] font-sans text-[0.84rem] font-semibold text-slate underline decoration-brass/50 underline-offset-4"
              >
                Edit
              </button>
            </div>
            <dl className="mt-3 space-y-2.5">
              {rows.map(([field, value]) => (
                <div key={field} className="grid gap-1 sm:grid-cols-12 sm:gap-4">
                  <dt className="font-sans text-[0.84rem] text-slate-muted sm:col-span-4">
                    {labelFor(field)}
                  </dt>
                  <dd className="text-[0.93rem] leading-[1.6] break-words text-slate-ink sm:col-span-8">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
