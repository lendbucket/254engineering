"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/primitives";
import {
  CERTIFICATE_MAX_BYTES,
  CERTIFICATE_TYPES,
  ROOFER_DRAFT_KEY,
  ROOFER_MONTHLY_VOLUME,
  ROOFER_MONTHLY_VOLUME_LABEL,
  ROOFER_SERVICES,
  ROOFER_SERVICE_LABEL,
  ROOFER_STEPS,
  ROOFER_WORK_MIX,
  ROOFER_WORK_MIX_LABEL,
  rooferApplicationSchema,
} from "@/lib/roofer-application";

/**
 * ===========================================================================
 * THE ROOFER PARTNER APPLICATION FORM. Robert's request of 2026-11-05.
 * ===========================================================================
 *
 * Short, phone first, three steps. It keeps the roofer's progress on this
 * device (localStorage, under one key, holding nothing but the answers), so
 * leaving and coming back loses nothing; it validates each answer as it is
 * typed, with the same schema the server parses with; it uploads the
 * certificate straight to private storage the moment it is chosen; and on
 * success it clears the saved answers and goes to the confirmation page.
 *
 * Validation is quiet until a field has been left once, then live, so nobody
 * is told an email is incomplete while still typing its first letter.
 */

type Region = { name: string; counties: string[] };
type Values = Record<string, string | string[]>;
type Certificate =
  | { status: "none" }
  | { status: "uploading"; filename: string }
  | { status: "done"; filename: string; path: string }
  | { status: "error"; message: string };

type Draft = { id: string; step: number; values: Values; certificate: { filename: string; path: string } | null };

const EMPTY: Values = { counties: [], services: [] };
const INPUT =
  "block w-full min-h-[48px] rounded-[3px] border bg-white px-4 py-3 font-sans text-[16px] text-slate-ink placeholder:text-[#5F6877] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-1";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

/** The schema's own rule for one field, so the form and the server agree on what is required. */
function checkField(name: string, value: unknown): string | null {
  const shape = rooferApplicationSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }>;
  const rule = shape[name];
  if (!rule) return null;
  /* A blank is checked as a blank: required text says "Enter ...", a blank number says it needs a number, optional text passes. */
  const r = rule.safeParse(value);
  return r.success ? null : (r.error?.issues[0]?.message ?? "Check this answer.");
}

export function RooferApplicationForm({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [certificate, setCertificate] = useState<Certificate>({ status: "none" });
  const [restored, setRestored] = useState(false);
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const loaded = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);
  const allCounties = useMemo(() => regions.flatMap((r) => r.counties).sort((a, b) => a.localeCompare(b)), [regions]);

  /* Restore what was left on this device, once. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ROOFER_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d && typeof d.id === "string" && d.values) {
          setId(d.id);
          setStep(Math.min(Math.max(0, d.step | 0), ROOFER_STEPS.length - 1));
          setValues({ ...EMPTY, ...d.values });
          if (d.certificate) setCertificate({ status: "done", ...d.certificate });
          setRestored(Object.values(d.values).some((v) => (Array.isArray(v) ? v.length > 0 : v !== "")));
          loaded.current = true;
          return;
        }
      }
    } catch {
      /* A draft that cannot be read is a fresh start, not an error. */
    }
    setId(newId());
    loaded.current = true;
  }, []);

  /* Keep the progress on this device after every change. */
  useEffect(() => {
    if (!loaded.current || !id) return;
    const draft: Draft = {
      id,
      step,
      values,
      certificate: certificate.status === "done" ? { filename: certificate.filename, path: certificate.path } : null,
    };
    try {
      window.localStorage.setItem(ROOFER_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* Private browsing or a full disk: the form still works, it just cannot keep the draft. */
    }
  }, [id, step, values, certificate]);

  const set = useCallback(
    (name: string, value: string | string[]) => {
      setValues((v) => ({ ...v, [name]: value }));
      if (touched[name] || errors[name]) {
        const message = checkField(name, value);
        setErrors((e) => ({ ...e, [name]: message ?? "" }));
      }
    },
    [touched, errors],
  );

  const leave = useCallback(
    (name: string) => {
      setTouched((t) => ({ ...t, [name]: true }));
      const message = checkField(name, values[name] ?? "");
      setErrors((e) => ({ ...e, [name]: message ?? "" }));
    },
    [values],
  );

  function stepErrors(index: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of ROOFER_STEPS[index].fields) {
      if (name === "certificatePath") continue;
      const message = checkField(name, values[name] ?? (name === "counties" || name === "services" ? [] : ""));
      if (message) out[name] = message;
    }
    return out;
  }

  function focusFirst(found: Record<string, string>) {
    const first = Object.keys(found)[0];
    if (!first) return;
    window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function next() {
    const found = stepErrors(step);
    if (Object.keys(found).length) {
      setErrors((e) => ({ ...e, ...found }));
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(found).map((k) => [k, true])) }));
      focusFirst(found);
      return;
    }
    setStep((s) => Math.min(s + 1, ROOFER_STEPS.length - 1));
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function startOver() {
    try {
      window.localStorage.removeItem(ROOFER_DRAFT_KEY);
    } catch {
      /* nothing kept to remove */
    }
    setId(newId());
    setStep(0);
    setValues(EMPTY);
    setErrors({});
    setTouched({});
    setCertificate({ status: "none" });
    setRestored(false);
  }

  async function chooseCertificate(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!(CERTIFICATE_TYPES as readonly string[]).includes(file.type)) {
      setCertificate({ status: "error", message: "That file type is not accepted. Choose a PDF, or a photo of the certificate." });
      return;
    }
    if (file.size > CERTIFICATE_MAX_BYTES) {
      setCertificate({ status: "error", message: "That file is over 10MB. Choose a smaller copy, or take a photo of the certificate." });
      return;
    }
    setCertificate({ status: "uploading", filename: file.name });
    try {
      const res = await fetch("/api/roofer-application/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id, filename: file.name, contentType: file.type, size: file.size }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; path?: string; error?: string };
      if (!res.ok || !body.ok || !body.url || !body.path) throw new Error(body.error || "The upload could not be prepared.");
      const put = await fetch(body.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("The file did not finish uploading.");
      setCertificate({ status: "done", filename: file.name, path: body.path });
    } catch (err) {
      setCertificate({
        status: "error",
        message: `${err instanceof Error ? err.message : "The upload failed."} Try again, or send the application without it and email the certificate.`,
      });
    }
  }

  async function send() {
    const found: Record<string, string> = {};
    ROOFER_STEPS.forEach((_, i) => Object.assign(found, stepErrors(i)));
    if (Object.keys(found).length) {
      setErrors((e) => ({ ...e, ...found }));
      const firstStep = ROOFER_STEPS.findIndex((s) => s.fields.some((f) => f in found));
      setStep(firstStep < 0 ? 0 : firstStep);
      focusFirst(found);
      return;
    }
    if (certificate.status === "uploading") {
      setBanner("The certificate is still uploading. Send again once it shows as attached.");
      return;
    }
    setSending(true);
    setBanner(null);
    const honeypot = (document.querySelector<HTMLInputElement>('input[name="website"]')?.value ?? "").trim();
    try {
      const res = await fetch("/api/roofer-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          applicationId: id,
          certificatePath: certificate.status === "done" ? certificate.path : undefined,
          website: honeypot || undefined,
          landingPath: window.location.pathname,
          referrer: document.referrer || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; errors?: Record<string, string>; message?: string };
      if (res.ok && body.ok) {
        try {
          window.localStorage.removeItem(ROOFER_DRAFT_KEY);
        } catch {
          /* nothing kept */
        }
        router.push("/roofing-partners/apply/received");
        return;
      }
      if (body.errors) {
        setErrors((e) => ({ ...e, ...body.errors }));
        const firstStep = ROOFER_STEPS.findIndex((s) => s.fields.some((f) => f in body.errors!));
        if (firstStep >= 0) setStep(firstStep);
        focusFirst(body.errors);
        setBanner("A few answers need another look. They are marked below.");
      } else {
        setBanner(body.message ?? "That did not go through, and nothing was saved. Your answers are still here; try again.");
      }
    } catch {
      setBanner("That did not go through, and it looks like the connection rather than anything you entered. Your answers are still here; try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  const current = ROOFER_STEPS[step];
  const v = (name: string) => (typeof values[name] === "string" ? (values[name] as string) : "");
  const list = (name: string) => (Array.isArray(values[name]) ? (values[name] as string[]) : []);

  return (
    <div ref={topRef} className="scroll-mt-24">
      {restored ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[4px] border-l-4 border-brass bg-limestone px-5 py-4">
          <p className="text-[15px] leading-[1.6] text-slate-ink">Your answers from last time are back, where you left them.</p>
          <button type="button" onClick={startOver} className="min-h-[44px] text-[14px] font-semibold text-slate underline">
            Start over
          </button>
        </div>
      ) : null}

      {/* Progress: which step, of how many, and the names of all three. */}
      <div aria-label={`Step ${step + 1} of ${ROOFER_STEPS.length}: ${current.title}`} role="group">
        <p className="text-[12px] font-bold tracking-[0.14em] text-brass-ink uppercase">
          Step {step + 1} of {ROOFER_STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-[clamp(24px,3vw,30px)] leading-[1.2] font-bold text-slate">{current.title}</h2>
        <ol className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
          {ROOFER_STEPS.map((s, i) => (
            <li key={s.key}>
              <span className={`block h-[5px] rounded-full ${i <= step ? "bg-brass" : "bg-limestone-line"}`} />
              <span className={`mt-2 block text-[12.5px] leading-[1.35] ${i === step ? "font-bold text-slate" : "text-slate-muted"}`}>{s.title}</span>
            </li>
          ))}
        </ol>
      </div>

      {banner ? (
        <div role="alert" className="mt-6 rounded-[4px] border border-brass-ink/40 bg-[#FDF6E7] px-5 py-4 text-[15px] font-medium text-slate-ink">
          {banner}
        </div>
      ) : null}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < ROOFER_STEPS.length - 1) next();
          else void send();
        }}
        className="mt-8"
      >
        {/* The honeypot: hidden from people and from assistive technology. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        {step === 0 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Text name="legalName" label="Company legal name" value={v("legalName")} error={errors.legalName} onChange={set} onBlur={leave} autoComplete="organization" wide />
            <Text name="dba" label="Doing business as" optional hint="If the company trades under another name." value={v("dba")} error={errors.dba} onChange={set} onBlur={leave} wide />
            <Text name="ownerName" label="Owner's name" value={v("ownerName")} error={errors.ownerName} onChange={set} onBlur={leave} autoComplete="name" />
            <Text name="ownerTitle" label="Title" value={v("ownerTitle")} error={errors.ownerTitle} onChange={set} onBlur={leave} autoComplete="organization-title" placeholder="Owner, President" />
            <Text name="email" label="Email" type="email" value={v("email")} error={errors.email} onChange={set} onBlur={leave} autoComplete="email" />
            <Text name="phone" label="Phone" type="tel" value={v("phone")} error={errors.phone} onChange={set} onBlur={leave} autoComplete="tel" />
            <Text name="officeCity" label="City of your office" hint="The firm works with roofing companies that have an office in Texas." value={v("officeCity")} error={errors.officeCity} onChange={set} onBlur={leave} autoComplete="address-level2" wide />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-7">
            <Counties
              all={allCounties}
              regions={regions}
              chosen={list("counties")}
              error={errors.counties}
              onChange={(next) => {
                set("counties", next);
                setTouched((t) => ({ ...t, counties: true }));
              }}
            />
            <div className="grid gap-6 sm:grid-cols-3">
              <Text name="yearsInBusiness" label="Years in business" type="number" value={v("yearsInBusiness")} error={errors.yearsInBusiness} onChange={set} onBlur={leave} />
              <Text name="crewCount" label="Crews" type="number" value={v("crewCount")} error={errors.crewCount} onChange={set} onBlur={leave} />
              <Text name="roofsPerYear" label="Roofs a year" type="number" value={v("roofsPerYear")} error={errors.roofsPerYear} onChange={set} onBlur={leave} />
            </div>
            <Choice
              name="workMix"
              legend="Residential, commercial or both"
              options={ROOFER_WORK_MIX.map((k) => ({ value: k, label: ROOFER_WORK_MIX_LABEL[k] }))}
              value={v("workMix")}
              error={errors.workMix}
              onChange={(value) => {
                set("workMix", value);
                setTouched((t) => ({ ...t, workMix: true }));
              }}
              columns={3}
            />
            <Many
              name="services"
              legend="Which services do you expect to order?"
              options={ROOFER_SERVICES.map((k) => ({ value: k, label: ROOFER_SERVICE_LABEL[k] }))}
              value={list("services")}
              error={errors.services}
              onChange={(next) => {
                set("services", next);
                setTouched((t) => ({ ...t, services: true }));
              }}
            />
            <Choice
              name="monthlyVolume"
              legend="Roughly how many a month?"
              options={ROOFER_MONTHLY_VOLUME.map((k) => ({ value: k, label: ROOFER_MONTHLY_VOLUME_LABEL[k] }))}
              value={v("monthlyVolume")}
              error={errors.monthlyVolume}
              onChange={(value) => {
                set("monthlyVolume", value);
                setTouched((t) => ({ ...t, monthlyVolume: true }));
              }}
              columns={2}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-8">
            <fieldset className="grid gap-6 sm:grid-cols-3">
              <legend className="mb-1 font-display text-[19px] font-bold text-slate sm:col-span-3">General liability</legend>
              <Text name="insuranceCarrier" label="Carrier" value={v("insuranceCarrier")} error={errors.insuranceCarrier} onChange={set} onBlur={leave} />
              <Text name="glPerOccurrence" label="Per occurrence" placeholder="$1,000,000" value={v("glPerOccurrence")} error={errors.glPerOccurrence} onChange={set} onBlur={leave} />
              <Text name="glAggregate" label="Aggregate" placeholder="$2,000,000" value={v("glAggregate")} error={errors.glAggregate} onChange={set} onBlur={leave} />
            </fieldset>

            <div>
              <p className="font-sans text-[14px] font-bold text-slate">
                Insurance certificate <span className="ml-2 font-normal text-slate-muted">optional</span>
              </p>
              <p className="mt-1 text-[0.84rem] leading-[1.5] text-slate-muted">A PDF or a clear photo, up to 10MB. It is stored privately and read only by the firm.</p>
              <div className="mt-3">
                {certificate.status === "done" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-limestone-line bg-white px-4 py-3">
                    <p className="min-w-0 text-[15px] text-slate-ink">
                      <span className="font-semibold">Attached:</span> <span className="break-all">{certificate.filename}</span>
                    </p>
                    <button type="button" onClick={() => setCertificate({ status: "none" })} className="min-h-[44px] text-[14px] font-semibold text-slate underline">
                      Remove
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[4px] border-2 border-dashed px-4 py-5 text-center transition-colors ${
                      certificate.status === "uploading" ? "border-slate/40 bg-limestone" : "border-line-strong bg-white hover:border-slate hover:bg-limestone"
                    }`}
                  >
                    <span className="text-[15px] font-semibold text-slate">
                      {certificate.status === "uploading" ? `Uploading ${certificate.filename}` : "Choose the certificate"}
                    </span>
                    <span className="text-[13px] text-slate-muted">or take a photo of it</span>
                    <input
                      type="file"
                      accept={CERTIFICATE_TYPES.join(",")}
                      onChange={chooseCertificate}
                      disabled={certificate.status === "uploading" || !id}
                      className="sr-only"
                    />
                  </label>
                )}
                {certificate.status === "error" ? (
                  <p role="alert" className="mt-2 text-[0.85rem] font-medium text-brass-ink">
                    {certificate.message}
                  </p>
                ) : null}
                {errors.certificatePath ? (
                  <p role="alert" className="mt-2 text-[0.85rem] font-medium text-brass-ink">
                    {errors.certificatePath}
                  </p>
                ) : null}
              </div>
            </div>

            {[1, 2].map((n) => (
              <fieldset key={n} className="grid gap-6 sm:grid-cols-3">
                <legend className="mb-1 font-display text-[19px] font-bold text-slate sm:col-span-3">
                  {n === 1 ? "First reference" : "Second reference"}
                </legend>
                <Text name={`reference${n}Name`} label="Name" value={v(`reference${n}Name`)} error={errors[`reference${n}Name`]} onChange={set} onBlur={leave} />
                <Text name={`reference${n}Company`} label="Company" optional value={v(`reference${n}Company`)} error={errors[`reference${n}Company`]} onChange={set} onBlur={leave} />
                <Text name={`reference${n}Phone`} label="Phone" type="tel" value={v(`reference${n}Phone`)} error={errors[`reference${n}Phone`]} onChange={set} onBlur={leave} />
              </fieldset>
            ))}
          </div>
        ) : null}

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-limestone-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={back} className={`${buttonClass("secondary")} w-full sm:w-auto`}>
              Back
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <button type="submit" disabled={sending || !id} className={`${buttonClass("primary")} w-full sm:w-auto`}>
            {step < ROOFER_STEPS.length - 1 ? `Continue to ${ROOFER_STEPS[step + 1].title.toLowerCase()}` : sending ? "Sending the application" : "Send the application"}
          </button>
        </div>
        <p className="mt-4 text-[13.5px] leading-[1.6] text-slate-muted">
          Your answers are kept on this device until you send them, so you can stop and come back.
        </p>
      </form>
    </div>
  );
}

function FieldShell({ name, label, hint, optional, error, wide, children }: { name: string; label: string; hint?: string; optional?: boolean; error?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={`rf-${name}`} className="block font-sans text-[14px] font-bold text-slate">
        {label}
        {optional ? <span className="ml-2 font-normal text-slate-muted">optional</span> : null}
      </label>
      {hint ? (
        <p id={`rf-${name}-hint`} className="mt-1 text-[0.84rem] leading-[1.5] text-slate-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`rf-${name}-error`} className="mt-2 text-[0.85rem] font-medium text-brass-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Text({
  name,
  label,
  type = "text",
  value,
  error,
  hint,
  optional,
  placeholder,
  autoComplete,
  wide,
  onChange,
  onBlur,
}: {
  name: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  autoComplete?: string;
  wide?: boolean;
  onChange: (name: string, value: string) => void;
  onBlur: (name: string) => void;
}) {
  const described = [hint ? `rf-${name}-hint` : "", error ? `rf-${name}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell name={name} label={label} hint={hint} optional={optional} error={error} wide={wide}>
      <input
        id={`rf-${name}`}
        data-field={name}
        name={name}
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "numeric" : type === "tel" ? "tel" : type === "email" ? "email" : undefined}
        pattern={type === "number" ? "[0-9]*" : undefined}
        enterKeyHint="next"
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(e) => onChange(name, e.target.value)}
        onBlur={() => onBlur(name)}
        className={`${INPUT} ${error ? "border-brass-ink" : "border-line-strong focus:border-slate"}`}
      />
    </FieldShell>
  );
}

function Choice({
  name,
  legend,
  options,
  value,
  error,
  onChange,
  columns,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
  columns: 2 | 3;
}) {
  return (
    <fieldset aria-describedby={error ? `rf-${name}-error` : undefined}>
      <legend className="font-sans text-[14px] font-bold text-slate">{legend}</legend>
      <div className={`mt-3 grid gap-3 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((o, i) => (
          <label
            key={o.value}
            className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[4px] border px-4 py-3 text-[15.5px] transition-colors ${
              value === o.value ? "border-slate bg-limestone font-semibold text-slate" : "border-line-strong bg-white text-slate-ink hover:border-slate"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              data-field={i === 0 ? name : undefined}
              onChange={() => onChange(o.value)}
              className="h-5 w-5 accent-[#14315D]"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`rf-${name}-error`} className="mt-2 text-[0.85rem] font-medium text-brass-ink">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Many({
  name,
  legend,
  options,
  value,
  error,
  onChange,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  value: string[];
  error?: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset aria-describedby={error ? `rf-${name}-error` : undefined}>
      <legend className="font-sans text-[14px] font-bold text-slate">{legend}</legend>
      <p className="mt-1 text-[0.84rem] leading-[1.5] text-slate-muted">Choose every one that applies.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((o, i) => {
          const on = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[4px] border px-4 py-3 text-[15.5px] transition-colors ${
                on ? "border-slate bg-limestone font-semibold text-slate" : "border-line-strong bg-white text-slate-ink hover:border-slate"
              }`}
            >
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={on}
                data-field={i === 0 ? name : undefined}
                onChange={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
                className="h-5 w-5 accent-[#14315D]"
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`rf-${name}-error`} className="mt-2 text-[0.85rem] font-medium text-brass-ink">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Counties({
  all,
  regions,
  chosen,
  error,
  onChange,
}: {
  all: string[];
  regions: Region[];
  chosen: string[];
  error?: string;
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all.filter((c) => c.toLowerCase().startsWith(q) && !chosen.includes(c)).slice(0, 8);
  }, [query, all, chosen]);

  const add = (names: string[]) => onChange([...chosen, ...names.filter((n) => !chosen.includes(n))]);

  return (
    <div>
      <label htmlFor="rf-counties" className="block font-sans text-[14px] font-bold text-slate">
        Counties you work in
      </label>
      <p id="rf-counties-hint" className="mt-1 text-[0.84rem] leading-[1.5] text-slate-muted">
        Type a county, or add a whole region at once.
      </p>
      <div className="relative mt-2">
        <input
          id="rf-counties"
          data-field="counties"
          type="text"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="rf-counties-list"
          aria-describedby={["rf-counties-hint", error ? "rf-counties-error" : ""].filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={query}
          placeholder="Start typing, such as Nueces"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              add([matches[0]]);
              setQuery("");
            }
          }}
          className={`${INPUT} ${error ? "border-brass-ink" : "border-line-strong focus:border-slate"}`}
        />
        {matches.length ? (
          <ul id="rf-counties-list" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[4px] border border-limestone-line bg-white shadow-[0_10px_24px_rgba(20,49,93,0.14)]">
            {matches.map((c) => (
              <li key={c} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => {
                    add([c]);
                    setQuery("");
                  }}
                  className="flex min-h-[44px] w-full items-center px-4 text-left text-[15.5px] text-slate-ink hover:bg-limestone"
                >
                  {c} County
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {regions.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => add(r.counties)}
            className="min-h-[44px] rounded-[3px] border border-line-strong bg-white px-3 text-[13.5px] font-semibold text-slate hover:border-slate hover:bg-limestone"
          >
            Add {r.name}
          </button>
        ))}
      </div>

      {chosen.length ? (
        <div className="mt-4">
          <p className="text-[13.5px] text-slate-muted">
            {chosen.length} {chosen.length === 1 ? "county" : "counties"} chosen.{" "}
            <button type="button" onClick={() => onChange([])} className="min-h-[44px] font-semibold text-slate underline">
              Clear
            </button>
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {chosen.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => onChange(chosen.filter((x) => x !== c))}
                  aria-label={`Remove ${c} County`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[3px] bg-limestone-sunk px-3 text-[14px] font-semibold text-slate"
                >
                  {c}
                  <span aria-hidden="true">&#215;</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p id="rf-counties-error" className="mt-2 text-[0.85rem] font-medium text-brass-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
