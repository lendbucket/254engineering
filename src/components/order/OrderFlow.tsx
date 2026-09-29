"use client";

import { useMemo, useState } from "react";
import type { CatalogEntry } from "@data/catalog";
import {
  blockersOn,
  emptyState,
  stepsFor,
  customerFieldsFor,
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
          /*
           * The partner code rides here, in the object the UTM parameters
           * already ride in, rather than on a path of its own. One capture
           * shape means one place to look when an order arrives attributed to
           * nobody.
           *
           * Trimmed but not otherwise judged: whether it matches a partner is
           * the server's question, and a client that decided would be a client
           * telling a stranger which codes are real.
           */
          partner_code: state.partnerCode.trim() || undefined,
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
      <div>
        <h2 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          {entry?.orderType === "quote" ? "Your request is with the firm" : "Your order is placed"}
        </h2>
        <p className="mt-3 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
          Reference{" "}
          <span className="font-mono font-semibold text-[var(--color-ink)]">{done.reference}</span>.
          {entry?.orderType === "quote"
            ? " Somebody will scope it and come back with a written quote. Nothing is charged until you accept one."
            : " A link to follow it has been recorded against your email."}
        </p>
        {/*
          THIS ONE KEEPS ITS EMPHASIS BECAUSE OF WHAT IT SAYS.

          It is the sentence that tells somebody their card was NOT charged when
          they expected it to be. V10 removes tinted panels, and it gets a rule
          and weight instead of a tint, but it does not get to look like the
          paragraph above it.
        */}
        {done.unpaid ? (
          <p className="mt-6 border-l-2 border-[var(--color-brass)] pl-4 text-[15px] leading-[1.7] text-[var(--color-ink)]">
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
      <div>
        <h2 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
          This is not work the firm can take
        </h2>
        <p className="mt-3 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">{disqualified}</p>
        <button
          type="button"
          onClick={() => {
            setDisqualified(null);
            setState((s) => ({ ...s, answers: [] }));
          }}
          className="mt-7 min-h-[var(--tap-target)] rounded-[3px] border border-[var(--color-limestone-edge)] px-5 text-[15px] font-semibold text-[var(--color-ink)]"
        >
          Go back and change an answer
        </button>
      </div>
    );
  }

  if (!step) return null;

  // ---------------------------------------------------------------- steps

  return (
    <div>
      {/*
        THE PROGRESS RAIL, DERIVED FROM THE STEPS THIS FLOW ACTUALLY HAS.

        V10O-service draws four named steps, Property, Service, Visit, Review
        and pay. This platform has a different set, and one of the design's four
        does not exist at all: there is no scheduling anywhere in the customer
        surface, and the operator deferred V10O-visit whole on 2026-09-29.

        So the rail reads `steps`, which is `stepsFor(entry, ...)`, the same
        array the flow walks. It cannot name a step the flow does not have, and
        it cannot miss one it does, which is what typing four labels here would
        have risked the first time `stepsFor` changed. One fact, one home.

        The bar above each label is the design's: navy behind what is done,
        brass on the current one, a hairline ahead. On a phone the labels would
        not fit, so it degrades to the bars with the current step named beneath,
        which is the same information in the space available.
      */}
      <ol className="flex gap-2" aria-label="Order progress">
        {steps.map((s, i) => (
          <li key={s.id} className="flex-1">
            <div
              className={`h-[3px] w-full ${
                i < index
                  ? "bg-[var(--color-slate)]"
                  : i === index
                    ? "bg-[var(--color-brass)]"
                    : "bg-[var(--color-limestone-line)]"
              }`}
            />
            <p
              className={`mt-2.5 hidden truncate text-[13px] sm:block ${
                i === index
                  ? "font-semibold text-[var(--color-ink)]"
                  : "text-[var(--color-ink-quiet)]"
              }`}
            >
              <span className="tabular-nums">{i + 1}</span> {s.title}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-2.5 text-[13px] font-semibold text-[var(--color-ink)] sm:hidden">
        Step <span className="tabular-nums">{index + 1}</span> of{" "}
        <span className="tabular-nums">{steps.length}</span>. {step.title}
      </p>

      <div className="mt-8">
        <h2 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
          {step.title}
        </h2>
        <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">{step.blurb}</p>
      </div>

      <div className="mt-8">
        {/*
          V10 rule 1 applied to a choice list. These were bordered cards with a
          tinted fill on the selected one. The design draws the same choice as
          rows separated by hairlines, with the radio doing the work of saying
          which is chosen, so selection is carried by the control rather than by
          a second signal in the background colour.

          The comment sits ABOVE the ternary rather than inside its branch. A
          JSX comment in a branch is two expressions where one is allowed: tsc
          is clean and the build fails, which this repository has paid for once
          already.
        */}
        {step.id === "deliverable" ? (
          <fieldset className="border-t border-[var(--color-limestone-line)]">
            <legend className="sr-only">Choose a deliverable</legend>
            {deliverables.map((d) => (
              <label
                key={d.tier}
                className="flex cursor-pointer items-start gap-3.5 border-b border-[var(--color-limestone-line)] py-4"
              >
                <input
                  type="radio"
                  name="tier"
                  className="mt-1 size-4"
                  checked={state.tier === d.tier}
                  onChange={() => set({ tier: d.tier })}
                />
                <span>
                  <span className="block text-[15px] font-semibold text-[var(--color-ink)]">
                    {d.name}
                  </span>
                  <span className="mt-1 block text-[14px] leading-[1.55] text-[var(--color-ink-quiet)]">
                    {d.orderType === "quote"
                      ? "Quoted. Nothing is charged until you accept."
                      : d.turnaround}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {step.id === "qualify" && entry ? (
          <div className="flex flex-col gap-9">
            {entry.qualifiers.map((q) => (
              <fieldset key={q.id}>
                <legend className="text-[15px] font-semibold text-[var(--color-ink)]">
                  {q.prompt}
                </legend>
                {q.help ? (
                  <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--color-ink-quiet)]">
                    {q.help}
                  </p>
                ) : null}
                <div className="mt-4 border-t border-[var(--color-limestone-line)]">
                  {q.options.map((option, i) => (
                    <label
                      key={option}
                      className="flex min-h-[var(--tap-target)] cursor-pointer items-center gap-3.5 border-b border-[var(--color-limestone-line)] py-3"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        className="size-4"
                        checked={state.answers.some(
                          (a) => a.qualifierId === q.id && a.optionIndex === i,
                        )}
                        onChange={() => answer(q.id, i)}
                      />
                      <span className="text-[15px] text-[var(--color-ink)]">{option}</span>
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
            {/*
              The hand entered referral code.

              Last, small, and optional, because that is what it is. Most
              referrals arrive on a tracked link and never see this box; it
              exists for the ones that arrive as somebody saying a name out
              loud, which is how most real referrals actually happen.

              The label says "referral code" rather than "partner code",
              because the customer has no idea the firm has partners and does
              not need to learn it here.
            */}
            <Field
              label="Referral code"
              hint="Optional. If somebody gave you a code, enter it here."
              value={state.partnerCode}
              onChange={(v) => set({ partnerCode: v })}
            />
          </div>
        ) : null}

        {step.id === "requirements" && entry ? (
          <div className="flex flex-col gap-6">
            {/*
              THE SHARED DEFINITION, NOT entry.requiredInputs.

              Phase 10 Section 1.5 Section C. This flow and the operator intake
              used to ask overlapping but different sets, so the firm had two
              definitions of a complete job and the telephone path captured
              less. Both now render what customerFieldsFor returns.

              Everything up to the sealing stage is SHOWN, and only the order
              stage is enforced by blockersOn. A customer who has their loan
              number now should be able to give it now; one who does not should
              still be able to buy.
            */}
            {customerFieldsFor(entry, "seal").map((input) => (
              <div key={input.id}>
                <label
                  className="text-[13px] font-semibold text-[var(--color-ink)]"
                  htmlFor={input.id}
                >
                  {input.label}
                  {input.required ? "" : " (optional)"}
                </label>
                {input.help ? (
                  <p className="mt-1 text-[13px] leading-[1.55] text-[var(--color-ink-quiet)]">
                    {input.help}
                  </p>
                ) : null}
                {input.kind === "select" || input.kind === "boolean" ? (
                  <select
                    id={input.id}
                    value={state.inputs[input.id] ?? ""}
                    onChange={(e) => set({ inputs: { ...state.inputs, [input.id]: e.target.value } })}
                    className={FIELD}
                  >
                    <option value="">Choose one</option>
                    {(input.kind === "boolean" ? ["Yes", "No"] : (input.options ?? [])).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : input.kind === "date" || input.kind === "tel" ? (
                  <input
                    id={input.id}
                    type={input.kind === "date" ? "date" : "tel"}
                    value={state.inputs[input.id] ?? ""}
                    onChange={(e) => set({ inputs: { ...state.inputs, [input.id]: e.target.value } })}
                    className={FIELD}
                  />
                ) : input.kind === "file" ? (
                  <div className="mt-2.5">
                    <input
                      id={input.id}
                      type="file"
                      className="text-[13.5px]"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(input.id, f);
                      }}
                    />
                    <ul className="mt-2 flex flex-col gap-1">
                      {(state.files[input.id] ?? []).map((f) => (
                        <li key={f.storageKey} className="text-[14px] text-[var(--color-ink-quiet)]">
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
                    className={`${FIELD} py-2.5`}
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
        <div className="mt-8 border-t border-[var(--color-limestone-line)] pt-5">
          <p className="text-[14px] font-semibold text-[var(--color-ink)]">Still needed</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {blockers.map((b) => (
              <li key={b} className="text-[14px] leading-[1.55] text-[var(--color-ink-quiet)]">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        The error keeps its colour and loses its tinted box, as on the sign up
        form. V10 carries status in weight; a failure that reads as body copy is
        one people scroll past, so this is a red left rule with red text.
      */}
      {error ? (
        <p
          role="alert"
          className="mt-8 border-l-2 border-[var(--red)] pl-3 text-[15px] leading-[1.6] font-semibold text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--color-limestone-line)] pt-6">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="min-h-[var(--tap-target)] rounded-[3px] border border-[var(--color-limestone-edge)] px-5 text-[15px] font-semibold text-[var(--color-ink)] disabled:opacity-40"
        >
          Back
        </button>
        {step.id === "review" ? (
          <button
            type="button"
            disabled={blockers.length > 0 || submitting}
            onClick={() => void submit()}
            className="min-h-[var(--tap-target)] rounded-[3px] bg-[var(--color-slate)] px-6 text-[15px] font-semibold text-white disabled:opacity-40"
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
            className="min-h-[var(--tap-target)] rounded-[3px] bg-[var(--color-slate)] px-6 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            Continue
          </button>
        )}
      </div>
      <p className="mt-5 text-[13px] leading-[1.6] text-[var(--color-ink-quiet)]">
        {serviceName}. Card details are entered on Stripe&rsquo;s page and never reach this site.
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
      <label htmlFor={id} className="text-[13px] font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      {hint ? (
        <p className="mt-1 text-[13px] leading-[1.55] text-[var(--color-ink-quiet)]">{hint}</p>
      ) : null}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
      />
    </div>
  );
}

/*
 * One field style for this flow, written once.
 *
 * 16px is not a type choice: iOS zooms the viewport on focus for anything
 * smaller, and the root layout deliberately does not lock zoom because locking
 * it is an accessibility failure. `--tap-target` is the platform's WCAG 2.5.8
 * floor, and mobile-audit measures both.
 */
const FIELD =
  "mt-2 min-h-[var(--tap-target)] w-full rounded-[3px] border border-[var(--color-limestone-edge)] bg-white px-3 text-[16px] text-[var(--color-ink)]";

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
        <p className="text-[16px] leading-[1.7] text-[var(--color-ink)]">
          {entry.name} is quoted rather than priced. Nothing is charged now and nothing is owed
          until you accept a written scope.
        </p>
        <label className="mt-7 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={state.acceptedTerms}
            onChange={(e) => onAccept(e.target.checked)}
          />
          <span className="text-[15px] leading-[1.65] text-[var(--color-ink)]">
            I understand this is a request for a quote and not an order.
          </span>
        </label>
      </div>
    );
  }

  return (
    <div>
      {/*
        THE PRICE TABLE, WHICH IS THE ONE PLACE V10 KEEPS A RULED GRID.

        The design draws money as a two column list with a hairline under each
        row and the figure right aligned, and that survives the no boxes rule
        because it is a rule between rows rather than a border around a card.
        Tabular figures so the decimal points line up, which is inherited from
        the root and named here because a money column is where it shows.
      */}
      <dl className="border-t border-[var(--color-limestone-line)]">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-limestone-line)] py-3">
          <dt className="text-[15px] text-[var(--color-ink-quiet)]">{entry.name}</dt>
          <dd className="text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
            {dollars(entry.priceCents)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[14px] leading-[1.65] text-[var(--color-ink-quiet)]">
        A property in a first tier coastal county carries a named surcharge of{" "}
        {dollars(entry.coastalSurchargeCents)}, shown as its own line on the payment page. The firm
        works out which county the address is in rather than asking you to.
      </p>

      <h3 className="mt-9 text-[12px] font-semibold tracking-[0.08em] text-[var(--color-ink-quiet)] uppercase">
        If the engineer declines
      </h3>
      <ul className="mt-4 flex flex-col gap-3">
        {refundLines(entry).map((line) => (
          <li key={line} className="text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
            {line}
          </li>
        ))}
      </ul>

      <label className="mt-9 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={state.acceptedTerms}
          onChange={(e) => onAccept(e.target.checked)}
        />
        <span className="text-[15px] leading-[1.65] text-[var(--color-ink)]">
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
