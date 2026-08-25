"use client";

import { useMemo, useState } from "react";
import { regions } from "@/content/regions";

/**
 * The field types the application flows need that the simple forms did not.
 *
 * Everything here is built for a thumb on a 390px screen first, because most
 * technician applicants apply from a phone standing next to a truck. That
 * constraint decides the shapes: checkboxes are full width rows with a 48px
 * target rather than a tight list, the county picker collapses by region instead
 * of rendering 254 rows, and the file field states its own progress because an
 * upload on one bar of signal is a thing you have to be told is still happening.
 */

const label = "block font-sans text-[0.88rem] font-semibold text-slate";
const hint = "mt-1 text-[0.84rem] leading-[1.5] text-slate-muted";
const errorText = "mt-2 text-[0.85rem] font-medium text-brass-ink";

/** A tappable row with a checkbox. Used for backgrounds and for counties. */
function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[3px] border border-limestone-line bg-limestone-raised px-4 transition-colors has-[:checked]:border-slate has-[:checked]:bg-limestone-sunk">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-slate"
      />
      <span className="py-2 text-[0.95rem] leading-[1.4] text-slate-ink">{children}</span>
    </label>
  );
}

export function CheckboxGroup({
  legend,
  options,
  value,
  onChange,
  error,
  help,
}: {
  legend: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  help?: string;
}) {
  const toggle = (option: string, on: boolean) =>
    onChange(on ? [...value, option] : value.filter((v) => v !== option));

  return (
    <fieldset>
      <legend className={label}>{legend}</legend>
      {help ? <p className={hint}>{help}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <CheckRow key={option} checked={value.includes(option)} onChange={(on) => toggle(option, on)}>
            {option}
          </CheckRow>
        ))}
      </div>
      {error ? <p className={errorText}>{error}</p> : null}
    </fieldset>
  );
}

/**
 * The county picker.
 *
 * 254 checkboxes is not a control, it is a wall. The counties are grouped by the
 * same eight regions the coverage pages use, each region collapses, and each
 * carries a select-all so somebody covering the Panhandle taps twice rather than
 * forty one times. The count is always visible because the honest answer to
 * "which counties" is usually "these six", and a picker that hides the total
 * encourages people to claim the whole state.
 */
export function CountyPicker({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const selected = useMemo(() => new Set(value), [value]);

  const toggleCounty = (county: string, on: boolean) =>
    onChange(on ? [...value, county] : value.filter((c) => c !== county));

  const toggleRegion = (counties: string[], on: boolean) => {
    if (on) {
      const merged = new Set([...value, ...counties]);
      onChange([...merged]);
    } else {
      const drop = new Set(counties);
      onChange(value.filter((c) => !drop.has(c)));
    }
  };

  return (
    <fieldset>
      <legend className={label}>Counties you are willing to serve</legend>
      <p className={hint}>
        Pick the counties you would genuinely drive to. An overstated radius produces declined
        dispatches, which helps nobody.
      </p>

      <p className="mt-3 font-sans text-[0.86rem] font-semibold text-slate">
        {value.length === 0
          ? "None selected yet"
          : `${value.length} ${value.length === 1 ? "county" : "counties"} selected`}
      </p>

      <div className="mt-3 divide-y divide-limestone-line overflow-hidden rounded-[3px] border border-limestone-line">
        {regions.map((region) => {
          const chosen = region.counties.filter((c) => selected.has(c)).length;
          const all = chosen === region.counties.length;
          const isOpen = openRegion === region.slug;
          return (
            <div key={region.slug} className="bg-limestone-raised">
              <div className="flex items-center justify-between gap-3 px-4">
                <button
                  type="button"
                  onClick={() => setOpenRegion(isOpen ? null : region.slug)}
                  aria-expanded={isOpen}
                  className="flex min-h-[52px] flex-1 items-center gap-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`font-sans text-[0.8rem] text-slate-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    &gt;
                  </span>
                  <span className="font-sans text-[0.95rem] font-medium text-slate">
                    {region.name}
                  </span>
                  <span className="font-sans text-[0.82rem] text-slate-muted">
                    {chosen > 0 ? `${chosen} of ${region.counties.length}` : region.counties.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleRegion(region.counties, !all)}
                  className="min-h-[44px] shrink-0 font-sans text-[0.82rem] font-semibold text-brass-ink underline decoration-brass/50 underline-offset-4"
                >
                  {all ? "Clear" : "All"}
                </button>
              </div>

              {isOpen ? (
                <div className="grid gap-2 border-t border-limestone-line bg-limestone px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
                  {region.counties.map((county) => (
                    <CheckRow
                      key={county}
                      checked={selected.has(county)}
                      onChange={(on) => toggleCounty(county, on)}
                    >
                      {county}
                    </CheckRow>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className={errorText}>{error}</p> : null}
    </fieldset>
  );
}

export type UploadState =
  | { status: "empty" }
  | { status: "uploading"; filename: string }
  | { status: "done"; filename: string; path: string; size: number; contentType: string }
  | { status: "error"; message: string };

/**
 * A file field that uploads immediately and says what it is doing.
 *
 * The upload happens on selection rather than on submit, so a slow connection
 * costs the applicant time while they are still filling the form instead of at
 * the moment they press send, which is when an upload failure is most likely to
 * lose them.
 *
 * The failure state is a real message with a retry, never a silent revert to
 * empty. An applicant who watches a file disappear assumes it worked.
 */
export function FileField({
  id,
  label: fieldLabel,
  help,
  required,
  state,
  onSelect,
  onClear,
  error,
}: {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  state: UploadState;
  onSelect: (file: File) => void;
  onClear: () => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {fieldLabel}
        {required ? null : <span className="ml-2 font-normal text-slate-muted">optional</span>}
      </label>
      {help ? <p className={hint}>{help}</p> : null}

      {state.status === "done" ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[3px] border border-limestone-line bg-limestone-raised px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[0.92rem] text-slate">{state.filename}</span>
          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] shrink-0 font-sans text-[0.84rem] font-semibold text-brass-ink underline decoration-brass/50 underline-offset-4"
          >
            Replace
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <input
            id={id}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
            disabled={state.status === "uploading"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSelect(file);
              // Reset so re-selecting the same file after an error still fires.
              e.target.value = "";
            }}
            className="block w-full cursor-pointer rounded-[3px] border border-limestone-line bg-limestone-raised px-4 py-3 font-sans text-[0.92rem] text-slate-ink file:mr-4 file:min-h-[40px] file:cursor-pointer file:rounded-[3px] file:border-0 file:bg-slate file:px-4 file:font-sans file:text-[0.88rem] file:font-semibold file:text-slate-fg disabled:opacity-60"
          />
        </div>
      )}

      {state.status === "uploading" ? (
        <p className="mt-2 text-[0.85rem] text-slate-muted">Uploading {state.filename}...</p>
      ) : null}
      {state.status === "error" ? <p className={errorText}>{state.message}</p> : null}
      {error ? <p className={errorText}>{error}</p> : null}
    </div>
  );
}

/** The step progress indicator. */
export function StepProgress({
  steps,
  current,
}: {
  steps: { id: string; title: string }[];
  current: number;
}) {
  return (
    <div>
      <p className="font-sans text-[0.8rem] font-semibold tracking-[0.12em] text-brass-ink uppercase">
        Step {current + 1} of {steps.length}
      </p>
      <ol className="mt-3 flex gap-1.5" aria-label="Application progress">
        {steps.map((step, i) => (
          <li
            key={step.id}
            aria-current={i === current ? "step" : undefined}
            className={`h-1 flex-1 rounded-full ${i <= current ? "bg-brass" : "bg-limestone-line"}`}
          >
            <span className="sr-only">
              {step.title}
              {i === current ? " (current)" : i < current ? " (complete)" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
