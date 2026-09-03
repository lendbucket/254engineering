"use client";

import { useMemo, useState } from "react";
import type { CatalogEntry } from "@data/catalog";
import {
  blockersOn,
  emptyState,
  stepsFor,
  type FlowState,
  type StepId,
} from "@/lib/order-flow";

/**
 * The customer's order flow.
 *
 * ONE COMPONENT, RENDERED BY EACH BRAND
 * -------------------------------------
 * The program calls for one flow on three sites, native to each rather than a
 * third party widget. This is that component. It takes its copy from the
 * catalog, which is the synchronized file, and its colours from the site's own
 * tokens, so a sibling brand renders the same questions in its own voice
 * without a second implementation of the rules.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It never computes a price. The total shown on the review step comes from the
 * server, from the same function that will charge the card, because a price
 * computed in a browser is a price a browser can change.
 *
 * It never lets a disqualifying answer continue. That is the point of asking.
 */
export function OrderFlow({
  serviceSlug,
  serviceName,
  deliverables,
}: {
  serviceSlug: string;
  serviceName: string;
  deliverables: CatalogEntry[];
}) {
  const [draftId] = useState(
    () => `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [state, setState] = useState<FlowState>(() =>
    emptyState(deliverables.length === 1 ? deliverables[0].tier : null),
  );
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disqualified, setDisqualified] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; unpaid?: string } | null>(null);

  const entry = useMemo(
    () => deliverables.find((d) => d.tier === state.tier) ?? null,
    [deliverables, state.tier],
  );
  const steps = useMemo(() => stepsFor(entry, deliverables.length), [entry, deliverables.length]);
  const step = steps[Math.min(index, steps.length - 1)];
  const blockers = step ? blockersOn(step.id, entry, state) : [];

  const set = (patch: Partial<FlowState>) => setState((s) => ({ ...s, ...patch }));

  function answer(qualifierId: string, optionIndex: number) {
    const q = entry?.qualifiers.find((x) => x.id === qualifierId);
    setState((s) => ({
      ...s,
      answers: [...s.answers.filter((a) => a.qualifierId !== qualifierId), { qualifierId, optionIndex }],
    }));
    /*
     * Ended here rather than at submit. A customer who cannot be served should
     * find out on the question that decides it, not after typing an address and
     * uploading a survey.
     */
    if (q?.disqualifyOn.includes(optionIndex)) setDisqualified(q.disqualifiedMessage);
    else setDisqualified(null);
  }

  async function upload(inputKey: string, file: File) {
    const res = await fetch("/api/order-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sign-upload",
        draftId,
        inputKey,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
    const signed = await res.json();
    if (!signed.ok) {
      setError(signed.error);
      return;
    }
    const put = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) {
      setError("That file did not upload. Try again, or a smaller one.");
      return;
    }
    setError(null);
    setState((s) => ({
      ...s,
      files: {
        ...s.files,
        [inputKey]: [
          ...(s.files[inputKey] ?? []),
          { name: file.name, storageKey: signed.storageKey, bucket: signed.bucket },
        ],
      },
    }));
  }

  async function submit() {
    if (!entry) return;
    setSubmitting(true);
    setError(null);

    const params = new URLSearchParams(window.location.search);
    const res = await fetch("/api/order-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        draftId,
        intent: entry.orderType === "quote" ? "quote" : "order",
        serviceSlug,
        tier: entry.tier,
        customer: state.customer,
        property: state.property,
        answers: state.answers,
        inputs: state.inputs,
        files: Object.entries(state.files).flatMap(([key, list]) =>
          list.map((f) => ({ key, bucket: f.bucket, storageKey: f.storageKey })),
        ),
        attribution: {
          utm_source: params.get("utm_source") ?? undefined,
          utm_medium: params.get("utm_medium") ?? undefined,
          utm_campaign: params.get("utm_campaign") ?? undefined,
          landing_path: window.location.pathname,
          referrer: document.referrer || undefined,
        },
      }),
    });

    const result = await res.json();
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "That could not be sent.");
      return;
    }
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
      return;
    }
    setDone({ reference: result.reference, unpaid: result.paymentUnavailable });
  }

  // ------------------------------------------------------------------ done

  if (done) {
    return (
      <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white px-6 py-7">
        <h2 className="font-display text-[1.4rem] leading-[1.2] font-semibold text-slate">
          {entry?.orderType === "quote" ? "Your request is with the firm" : "Your order is placed"}
        </h2>
        <p className="mt-3 text-[1rem] leading-[1.7] text-slate-muted">
          Reference <span className="font-mono font-semibold text-slate">{done.reference}</span>.
          {entry?.orderType === "quote"
            ? " Somebody will scope it and come back with a written quote. Nothing is charged until you accept one."
            : " A link to follow it has been recorded against your email."}
        </p>
        {done.unpaid ? (
          <p className="mt-4 rounded-[4px] border border-[#f0d9a8] bg-[#fdf3e0] px-4 py-3 text-[14.5px] leading-[1.65] text-[#7a4c05]">
            Nothing has been charged. The payment page could not be opened, so the firm will send
            you a payment link for this reference. {done.unpaid}
          </p>
        ) : null}
      </div>
    );
  }

  // --------------------------------------------------------- disqualified

  if (disqualified) {
    return (
      <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white px-6 py-7">
        <h2 className="font-display text-[1.3rem] leading-[1.25] font-semibold text-slate">
          This is not work the firm can take
        </h2>
        <p className="mt-3 text-[1rem] leading-[1.7] text-slate-muted">{disqualified}</p>
        <button
          type="button"
          onClick={() => {
            setDisqualified(null);
            setState((s) => ({ ...s, answers: [] }));
          }}
          className="mt-6 min-h-[44px] rounded-[3px] border border-limestone-line px-4 text-[14px] font-bold text-slate hover:bg-limestone"
        >
          Go back and change an answer
        </button>
      </div>
    );
  }

  if (!step) return null;

  // ---------------------------------------------------------------- steps

  return (
    <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white">
      <div className="border-b border-limestone-line px-6 py-4">
        <p className="text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">
          Step {index + 1} of {steps.length}
        </p>
        <h2 className="mt-1 font-display text-[1.3rem] leading-[1.25] font-semibold text-slate">
          {step.title}
        </h2>
        <p className="mt-1.5 text-[14.5px] leading-[1.6] text-slate-muted">{step.blurb}</p>
      </div>

      <div className="px-6 py-6">
        {step.id === "deliverable" ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Choose a deliverable</legend>
            {deliverables.map((d) => (
              <label
                key={d.tier}
                className={`flex cursor-pointer items-start gap-3 rounded-[4px] border px-4 py-3.5 ${
                  state.tier === d.tier ? "border-slate bg-limestone/60" : "border-limestone-line"
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  className="mt-1.5"
                  checked={state.tier === d.tier}
                  onChange={() => set({ tier: d.tier })}
                />
                <span>
                  <span className="block text-[15px] font-semibold text-slate">{d.name}</span>
                  <span className="mt-0.5 block text-[13.5px] leading-[1.55] text-slate-muted">
                    {d.orderType === "quote" ? "Quoted. Nothing is charged until you accept." : d.turnaround}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {step.id === "qualify" && entry ? (
          <div className="flex flex-col gap-7">
            {entry.qualifiers.map((q) => (
              <fieldset key={q.id}>
                <legend className="text-[15px] font-semibold text-slate">{q.prompt}</legend>
                {q.help ? (
                  <p className="mt-1.5 text-[13.5px] leading-[1.55] text-slate-muted">{q.help}</p>
                ) : null}
                <div className="mt-3 flex flex-col gap-2">
                  {q.options.map((option, i) => (
                    <label key={option} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name={q.id}
                        checked={state.answers.some((a) => a.qualifierId === q.id && a.optionIndex === i)}
                        onChange={() => answer(q.id, i)}
                      />
                      <span className="text-[15px] text-slate">{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        ) : null}

        {step.id === "property" ? (
          <div className="flex flex-col gap-5">
            <Field
              label="Property address"
              value={state.property.propertyAddress}
              onChange={(v) => set({ property: { ...state.property, propertyAddress: v } })}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="City"
                value={state.property.city}
                onChange={(v) => set({ property: { ...state.property, city: v } })}
              />
              <Field
                label="County"
                hint="If you know it. The firm works it out from the city otherwise."
                value={state.property.county}
                onChange={(v) => set({ property: { ...state.property, county: v } })}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Your name"
                value={state.customer.name}
                onChange={(v) => set({ customer: { ...state.customer, name: v } })}
              />
              <Field
                label="Email"
                type="email"
                hint="Where the firm sends the link to follow this order."
                value={state.customer.email}
                onChange={(v) => set({ customer: { ...state.customer, email: v } })}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Phone"
                hint="Optional. Used only if something about the property needs asking."
                value={state.customer.phone}
                onChange={(v) => set({ customer: { ...state.customer, phone: v } })}
              />
              <Field
                label="Company"
                hint="Optional."
                value={state.customer.company}
                onChange={(v) => set({ customer: { ...state.customer, company: v } })}
              />
            </div>
          </div>
        ) : null}

        {step.id === "requirements" && entry ? (
          <div className="flex flex-col gap-6">
            {entry.requiredInputs.map((input) => (
              <div key={input.id}>
                <label className="text-[15px] font-semibold text-slate" htmlFor={input.id}>
                  {input.label}
                  {input.required ? "" : " (optional)"}
                </label>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-slate-muted">{input.help}</p>
                {input.kind === "file" ? (
                  <div className="mt-2.5">
                    <input
                      id={input.id}
                      type="file"
                      className="text-[14px]"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(input.id, f);
                      }}
                    />
                    <ul className="mt-2 flex flex-col gap-1">
                      {(state.files[input.id] ?? []).map((f) => (
                        <li key={f.storageKey} className="text-[13.5px] text-slate-muted">
                          {f.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <textarea
                    id={input.id}
                    rows={input.kind === "text" ? 3 : 1}
                    value={state.inputs[input.id] ?? ""}
                    onChange={(e) => set({ inputs: { ...state.inputs, [input.id]: e.target.value } })}
                    className="mt-2.5 w-full rounded-[3px] border border-limestone-line px-3 py-2 text-[15px] text-slate"
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}

        {step.id === "review" && entry ? (
          <ReviewStep entry={entry} state={state} onAccept={(v) => set({ acceptedTerms: v })} />
        ) : null}
      </div>

      {blockers.length > 0 && index > 0 ? (
        <div className="border-t border-limestone-line bg-limestone/50 px-6 py-3">
          <p className="text-[13px] font-semibold text-slate">Still needed</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {blockers.map((b) => (
              <li key={b} className="text-[13px] leading-[1.5] text-slate-muted">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="border-t border-limestone-line bg-[#fdeceb] px-6 py-3">
          <p className="text-[14px] leading-[1.6] text-[#8c1d18]">{error}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-limestone-line px-6 py-4">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="min-h-[44px] rounded-[3px] px-3 text-[14px] font-bold text-slate-muted disabled:opacity-40"
        >
          Back
        </button>
        {step.id === "review" ? (
          <button
            type="button"
            disabled={blockers.length > 0 || submitting}
            onClick={() => void submit()}
            className="min-h-[44px] rounded-[3px] bg-brass px-5 text-[14px] font-bold text-slate-ink disabled:opacity-40"
          >
            {submitting
              ? "Sending"
              : entry?.orderType === "quote"
                ? "Send the request"
                : "Continue to payment"}
          </button>
        ) : (
          <button
            type="button"
            disabled={blockers.length > 0}
            onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
            className="min-h-[44px] rounded-[3px] bg-brass px-5 text-[14px] font-bold text-slate-ink disabled:opacity-40"
          >
            Continue
          </button>
        )}
      </div>
      <p className="border-t border-limestone-line px-6 py-3 text-[12.5px] leading-[1.55] text-slate-muted">
        {serviceName}. Card details are entered on Stripe's page and never reach this site.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="text-[15px] font-semibold text-slate">
        {label}
      </label>
      {hint ? <p className="mt-1 text-[13.5px] leading-[1.55] text-slate-muted">{hint}</p> : null}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[3px] border border-limestone-line px-3 py-2 text-[15px] text-slate"
      />
    </div>
  );
}

/**
 * The price and terms step.
 *
 * THE PRICE HERE IS THE CATALOG'S, AND IT IS NOT WHAT GETS CHARGED
 * ----------------------------------------------------------------
 * It is shown so the customer knows what they are agreeing to, and the server
 * recomputes it from the same catalog when the order is placed. The coastal
 * surcharge is deliberately not shown as a possibility here: the county is not
 * resolved until the server sees the address, so promising or denying it in the
 * browser would be guessing at the customer's own property.
 */
function ReviewStep({
  entry,
  state,
  onAccept,
}: {
  entry: CatalogEntry;
  state: FlowState;
  onAccept: (v: boolean) => void;
}) {
  const dollars = (c: number | null) =>
    c === null ? "quoted" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  if (entry.orderType === "quote") {
    return (
      <div>
        <p className="text-[1rem] leading-[1.7] text-slate">
          {entry.name} is quoted rather than priced. Nothing is charged now and nothing is owed
          until you accept a written scope.
        </p>
        <label className="mt-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.acceptedTerms}
            onChange={(e) => onAccept(e.target.checked)}
          />
          <span className="text-[14.5px] leading-[1.65] text-slate-muted">
            I understand this is a request for a quote and not an order.
          </span>
        </label>
      </div>
    );
  }

  return (
    <div>
      <dl className="border-t border-limestone-line">
        <div className="flex justify-between border-b border-limestone-line py-2.5">
          <dt className="text-[15px] text-slate-muted">{entry.name}</dt>
          <dd className="text-[15px] text-slate">{dollars(entry.priceCents)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[13.5px] leading-[1.6] text-slate-muted">
        A property in a first tier coastal county carries a named surcharge of{" "}
        {dollars(entry.coastalSurchargeCents)}, shown as its own line on the payment page. The firm
        works out which county the address is in rather than asking you to.
      </p>

      <h3 className="mt-7 text-[13px] font-bold tracking-[0.1em] text-brass-ink uppercase">
        If the engineer declines
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {refundLines(entry).map((line) => (
          <li key={line} className="text-[14.5px] leading-[1.65] text-slate-muted">
            {line}
          </li>
        ))}
      </ul>

      <label className="mt-7 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={state.acceptedTerms}
          onChange={(e) => onAccept(e.target.checked)}
        />
        <span className="text-[14.5px] leading-[1.65] text-slate-muted">
          I have read what happens if the engineer declines to seal.
        </span>
      </label>
    </div>
  );
}

/*
 * The same four sentences the server stores on the order, written here so the
 * customer reads them before paying rather than after. The server's copy is the
 * record; this is the disclosure.
 */
function refundLines(entry: CatalogEntry): string[] {
  const fee =
    entry.inspectionFeeCents === null
      ? null
      : `$${(entry.inspectionFeeCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const lines = [
    "The engineer reviews what is gathered and decides. They may seal it, ask for revisions, ask for another visit, or decline to seal.",
  ];
  if (entry.orderType === "field") {
    lines.push(
      "If they decline before anyone attends the property, you are refunded in full.",
      fee
        ? `If they decline after a technician has attended, you are refunded everything except the ${fee} inspection, and you receive what the engineer found and why they could not seal it.`
        : "If they decline after a technician has attended, an inspection fee is retained.",
      "You are never charged more than the price shown above, and a decline is never a reason for a further charge.",
    );
  } else {
    lines.push(
      "There is no site visit on this service, so if they decline you are refunded in full and you still receive what the engineer found.",
    );
  }
  lines.push(
    "Paying does not buy a seal. It buys the review by a licensed Professional Engineer, and their conclusion is theirs.",
  );
  return lines;
}
