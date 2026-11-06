"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CERTIFICATE_MAX_BYTES,
  CERTIFICATE_TYPES,
  ROOFER_MONTHLY_VOLUME,
  ROOFER_MONTHLY_VOLUME_LABEL,
  ROOFER_SECTIONS,
  ROOFER_SECTION_LABEL,
  ROOFER_SECTION_SCHEMA,
  ROOFER_SERVICES,
  ROOFER_SERVICE_LABEL,
  ROOFER_WORK_MIX,
  ROOFER_WORK_MIX_LABEL,
  rooferFieldErrors,
  type RooferSection,
} from "@/lib/roofer-application";

/**
 * "FINISH YOUR PROFILE", THE ROOFING PARTNER'S CHECKLIST. Robert's rework of
 * 2026-11-06 (0117).
 *
 * Three sections, each saved on its own with its own button, each saying in
 * words whether it is done. None blocks anything: the account is open and
 * signed in whatever is filled in. Each section is checked with the schema the
 * server parses with, so the two cannot disagree about what is required.
 */

type Values = Record<string, string | string[]>;
type Region = { name: string; counties: string[] };

const FIELD =
  "min-h-[var(--tap-target)] w-full rounded-[2px] border border-[var(--color-limestone-edge)] bg-white px-3 text-[16px] text-[var(--color-ink)]";
const BUTTON =
  "inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[2px] bg-[var(--color-slate)] px-5 text-[15px] font-semibold text-white disabled:opacity-60";

export function PartnerProfile({
  initial,
  done,
  regions,
}: {
  initial: Record<RooferSection, Values>;
  done: Record<RooferSection, boolean>;
  regions: Region[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<RooferSection | null>(null);
  const [said, setSaid] = useState<{ section: RooferSection; text: string; ok: boolean } | null>(null);
  const [certificate, setCertificate] = useState<string | null>(null);

  const set = (section: RooferSection, name: string, value: string | string[]) =>
    setValues((all) => ({ ...all, [section]: { ...all[section], [name]: value } }));
  const v = (section: RooferSection, name: string) => (typeof values[section][name] === "string" ? (values[section][name] as string) : "");
  const list = (section: RooferSection, name: string) => (Array.isArray(values[section][name]) ? (values[section][name] as string[]) : []);
  const toggle = (section: RooferSection, name: string, item: string) => {
    const now = list(section, name);
    set(section, name, now.includes(item) ? now.filter((x) => x !== item) : [...now, item]);
  };

  async function save(section: RooferSection) {
    const parsed = ROOFER_SECTION_SCHEMA[section].safeParse(values[section]);
    if (!parsed.success) {
      setErrors(rooferFieldErrors(parsed.error));
      setSaid({ section, text: "A few answers need another look. They are marked below.", ok: false });
      return;
    }
    setBusy(section);
    setSaid(null);
    try {
      const res = await fetch("/api/account/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", section, values: values[section] }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: Record<string, string> };
      if (res.ok && body.ok) {
        setErrors({});
        setSaid({ section, text: `${ROOFER_SECTION_LABEL[section]} is saved.`, ok: true });
        router.refresh();
        return;
      }
      if (body.errors) setErrors(body.errors);
      setSaid({ section, text: body.error ?? "That did not save. Your answers are still here; try again.", ok: false });
    } catch {
      setSaid({ section, text: "That did not save, and it looks like the connection. Your answers are still here; try again in a moment.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function chooseCertificate(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!(CERTIFICATE_TYPES as readonly string[]).includes(file.type)) {
      setCertificate("That file type is not accepted. Choose a PDF, or a photo of the certificate.");
      return;
    }
    if (file.size > CERTIFICATE_MAX_BYTES) {
      setCertificate("That file is over 10MB. Choose a smaller copy, or take a photo of the certificate.");
      return;
    }
    setCertificate(`Uploading ${file.name}...`);
    try {
      const res = await fetch("/api/account/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "certificate", filename: file.name, contentType: file.type, size: file.size }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; path?: string; error?: string };
      if (!res.ok || !body.ok || !body.url || !body.path) throw new Error(body.error || "The upload could not be prepared.");
      const put = await fetch(body.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("The file did not finish uploading.");
      set("insurance", "certificatePath", body.path);
      setCertificate(`${file.name} is attached. Save this section to keep it.`);
    } catch (err) {
      setCertificate(`${err instanceof Error ? err.message : "The upload failed."} Try again, or email the certificate to the firm.`);
    }
  }

  /* The next unfinished section going forward, wrapping only after the last, so "Next" never points backwards first. */
  const nextAfter = (section: RooferSection) => {
    const i = ROOFER_SECTIONS.indexOf(section);
    const order = [...ROOFER_SECTIONS.slice(i + 1), ...ROOFER_SECTIONS.slice(0, i)];
    return order.find((s) => !done[s]) ?? null;
  };

  const sectionShell = (section: RooferSection, intro: string, body: ReactNode) => {
    const next = nextAfter(section);
    return (
      <section key={section} id={`profile-${section}`} aria-labelledby={`profile-${section}-title`} className="mt-10 border-t border-[var(--color-limestone-line)] pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 id={`profile-${section}-title`} className="text-[17px] font-semibold text-[var(--color-ink)]">
            {ROOFER_SECTION_LABEL[section]}
          </h3>
          <p className="text-[14px] font-semibold text-[var(--color-ink-quiet)]">{done[section] ? "Done" : "Not done yet"}</p>
        </div>
        <p className="mt-2 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">{intro}</p>
        <div className="mt-5 flex flex-col gap-5">{body}</div>
        {said?.section === section ? (
          <p role={said.ok ? "status" : "alert"} className="mt-4 text-[15px] font-semibold text-[var(--color-ink)]">
            {said.text}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => void save(section)}>
            {busy === section ? "Saving..." : `Save ${ROOFER_SECTION_LABEL[section].toLowerCase()}`}
          </button>
          {next ? (
            <a href={`#profile-${next}`} className="inline-flex min-h-[var(--tap-target)] items-center text-[15px] font-semibold text-[var(--color-ink)] underline">
              Next: {ROOFER_SECTION_LABEL[next]}
            </a>
          ) : null}
        </div>
      </section>
    );
  };

  const text = (section: RooferSection, name: string, label: string, opts: { type?: string; inputMode?: "numeric" | "tel"; optional?: boolean } = {}) => (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-[var(--color-ink)]">
        {label}
        {opts.optional ? <span className="font-normal text-[var(--color-ink-quiet)]"> (optional)</span> : null}
      </span>
      <input
        name={name}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        value={v(section, name)}
        onChange={(e) => set(section, name, e.target.value)}
        aria-invalid={errors[name] ? true : undefined}
        className={FIELD}
      />
      {errors[name] ? <span className="text-[14px] font-semibold text-[var(--color-ink)]">{errors[name]}</span> : null}
    </label>
  );

  const radios = (section: RooferSection, name: string, label: string, options: readonly string[], labels: Record<string, string>) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[13px] font-semibold text-[var(--color-ink)]">{label}</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {options.map((o) => (
          <label key={o} className="inline-flex min-h-[var(--tap-target)] items-center gap-2 text-[15px] text-[var(--color-ink)]">
            <input type="radio" name={name} checked={v(section, name) === o} onChange={() => set(section, name, o)} />
            {labels[o]}
          </label>
        ))}
      </div>
      {errors[name] ? <span className="text-[14px] font-semibold text-[var(--color-ink)]">{errors[name]}</span> : null}
    </fieldset>
  );

  return (
    <div>
      {sectionShell(
        "work",
        "Where you work, how big the company is, and what you expect to order.",
        <>
          {text("work", "officeCity", "City of your Texas office")}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold text-[var(--color-ink)]">Counties you work in ({list("work", "counties").length} chosen)</legend>
            {regions.map((r) => (
              <details key={r.name} className="border-t border-[var(--color-limestone-line)]">
                <summary className="flex min-h-[var(--tap-target)] cursor-pointer items-center text-[15px] font-semibold text-[var(--color-ink)]">
                  {r.name} ({r.counties.filter((c) => list("work", "counties").includes(c)).length} of {r.counties.length})
                </summary>
                <div className="grid grid-cols-2 gap-x-4 pb-3 sm:grid-cols-3">
                  {r.counties.map((c) => (
                    <label key={c} className="inline-flex min-h-[var(--tap-target)] items-center gap-2 text-[15px] text-[var(--color-ink)]">
                      <input type="checkbox" checked={list("work", "counties").includes(c)} onChange={() => toggle("work", "counties", c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </details>
            ))}
            {errors.counties ? <span className="text-[14px] font-semibold text-[var(--color-ink)]">{errors.counties}</span> : null}
          </fieldset>
          {text("work", "yearsInBusiness", "Years in business", { inputMode: "numeric" })}
          {text("work", "crewCount", "Crews", { inputMode: "numeric" })}
          {radios("work", "workMix", "The work you do", ROOFER_WORK_MIX, ROOFER_WORK_MIX_LABEL)}
          {text("work", "roofsPerYear", "Roofs a year", { inputMode: "numeric" })}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold text-[var(--color-ink)]">Services you expect to order</legend>
            {ROOFER_SERVICES.map((s) => (
              <label key={s} className="inline-flex min-h-[var(--tap-target)] items-center gap-2 text-[15px] text-[var(--color-ink)]">
                <input type="checkbox" checked={list("work", "services").includes(s)} onChange={() => toggle("work", "services", s)} />
                {ROOFER_SERVICE_LABEL[s]}
              </label>
            ))}
            {errors.services ? <span className="text-[14px] font-semibold text-[var(--color-ink)]">{errors.services}</span> : null}
          </fieldset>
          {radios("work", "monthlyVolume", "Roughly how many a month", ROOFER_MONTHLY_VOLUME, ROOFER_MONTHLY_VOLUME_LABEL)}
        </>,
      )}
      {sectionShell(
        "insurance",
        "Your general liability cover, and its certificate. A PDF or a photo of it is fine.",
        <>
          {text("insurance", "insuranceCarrier", "Insurance carrier")}
          {text("insurance", "glPerOccurrence", "Per occurrence limit")}
          {text("insurance", "glAggregate", "Aggregate limit")}
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-ink)]">Certificate of insurance</span>
            <input type="file" accept={CERTIFICATE_TYPES.join(",")} onChange={(e) => void chooseCertificate(e)} className="min-h-[var(--tap-target)] text-[15px] text-[var(--color-ink)]" />
            {certificate ? <span role="status" className="text-[14px] text-[var(--color-ink-quiet)]">{certificate}</span> : v("insurance", "certificatePath") ? <span className="text-[14px] text-[var(--color-ink-quiet)]">A certificate is on file.</span> : null}
            {errors.certificatePath ? <span className="text-[14px] font-semibold text-[var(--color-ink)]">{errors.certificatePath}</span> : null}
          </label>
        </>,
      )}
      {sectionShell(
        "references",
        "Two people the firm can call about your work, such as a supplier, a general contractor or a past customer.",
        <>
          {text("references", "reference1Name", "First reference, name")}
          {text("references", "reference1Company", "First reference, company", { optional: true })}
          {text("references", "reference1Phone", "First reference, phone", { type: "tel", inputMode: "tel" })}
          {text("references", "reference2Name", "Second reference, name")}
          {text("references", "reference2Company", "Second reference, company", { optional: true })}
          {text("references", "reference2Phone", "Second reference, phone", { type: "tel", inputMode: "tel" })}
        </>,
      )}
    </div>
  );
}
