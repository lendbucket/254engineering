"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogEntry } from "@data/catalog";
import {
  blockersOn,
  blockersOnPart,
  emptyState,
  intakePartsFor,
  stepsFor,
  type FlowState,
  type StepId,
} from "@/lib/order-flow";
import { refundDisclosure, refundIfDeclinedEarly } from "@/lib/ops-orders";

/**
 * WHO THE CUSTOMER IS PAYING, read by the server page from the derivers and
 * passed in, because this is a client component and cannot read the register
 * or the gate. The signals are the four the operator approved on 2026-10-05,
 * each from its one home: the registration line, the engineer in responsible
 * charge (only when the gate says the firm is trading, so the sentence is never
 * a premature claim), and the firm's address and telephone. Absent is absent:
 * a null is not rendered as an empty line.
 */
export type TrustFacts = {
  registration: string;
  engineerInCharge: boolean;
  address: string | null;
  phone: string | null;
};

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
  signedIn = false,
  trust,
}: {
  serviceSlug: string;
  serviceName: string;
  deliverables: CatalogEntry[];
  trust: TrustFacts;
  /**
   * Whether a customer session is open, read by the server page.
   *
   * It decides one thing, on the done screen: whether to offer a link to the
   * orders list. Defaulted to false so a caller that does not pass it offers
   * nothing, which is the safe direction.
   */
  signedIn?: boolean;
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

  /*
   * WHICH SUB PAGE OF STEP 3, and it is state rather than a derived value
   * because moving between parts must not move the rail.
   */
  const [part, setPart] = useState(0);
  const parts = useMemo(() => (entry ? intakePartsFor(entry) : []), [entry]);
  const onRequirements = step?.id === "requirements" && parts.length > 0;
  const lastPart = parts.length === 0 ? 0 : parts.length - 1;
  const partIndex = Math.min(part, lastPart);

  /*
   * THE BLOCKERS SHOWN ARE THIS SUB PAGE'S, which is the operator's ruling that
   * required fields are checked on their own sub page. The rule is identical,
   * narrowed to the fields in front of the person, so "Still needed" never lists
   * something they cannot see.
   *
   * The union of the parts is exactly the step, proved by
   * scripts/proofs/step-three-parts-cover-the-step.mjs, so advancing through
   * every part is the same test as passing the whole step and nothing can hide
   * between two sub pages.
   */
  const blockers = onRequirements
    ? blockersOnPart(entry, state, parts[partIndex] ?? null)
    : step
      ? blockersOn(step.id, entry, state)
      : [];

  const set = (patch: Partial<FlowState>) => setState((s) => ({ ...s, ...patch }));

  /*
   * ORDER FLOW V2, 2026-10-07: CONTINUE IS NEVER DISABLED FOR A MISSING ANSWER.
   * A disabled button gave no reason, and a list of what was missing sat under
   * every step before the person had tried anything. Now Continue always
   * answers: with something missing, the list appears under "Before you
   * continue" and takes focus, so the reason is stated where the person is
   * looking and read out by a screen reader. Moving on, or back, clears it.
   */
  const [attempted, setAttempted] = useState(false);
  const stillNeeded = useRef<HTMLDivElement>(null);
  const blockedOrGo = (go: () => void) => {
    if (blockers.length > 0) {
      setAttempted(true);
      requestAnimationFrame(() => stillNeeded.current?.focus());
      return;
    }
    setAttempted(false);
    go();
  };

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
        <h2 className="text-[32px] leading-[1.12] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          {entry?.orderType === "quote" ? "Your request is with the firm" : "Your order is placed"}
        </h2>
        <p className="mt-3 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
          Reference{" "}
          <span className="font-semibold text-[var(--color-ink)]">{done.reference}</span>.
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
        {/*
          A SIGNED IN BUYER GETS A ROUTE TO THEIR OWN LIST, added 2026-10-01 with
          the orders list itself, because without it that list had no entrance
          from the moment a person most wants it.

          IT CANNOT LINK TO THE TRACKER, and that is worth writing down so nobody
          adds it later. The tracker at /order/[reference] opens on a signed
          token in the query, and the page's own header records that a token
          cannot exist yet: it is minted when the firm releases the file. A link
          built from the reference alone would land on the sentence saying the
          link does not open an order, seconds after somebody paid.

          Nothing is offered to an anonymous buyer. They have no account, and
          sending them to a sign in form seconds after paying would read as
          something having gone wrong.
        */}
        {signedIn ? (
          <p className="mt-6 text-[15px] leading-[1.7] text-[var(--color-ink-quiet)]">
            <Link
              href="/account/orders"
              prefetch={false}
              className="font-semibold text-[var(--color-link)]"
            >
              See this with your other orders
            </Link>
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

              AND IT IS ONE GROUP AT A TIME SINCE 2026-10-01. The sweep measured
              this step at 10,748px at 390, roughly thirteen phone heights. The
              fields, their wording and their validation are unchanged; what
              changed is how many of them are on screen at once.
            */}
            {parts.length > 1 ? (
              <div>
                {/*
                  Written in the case it is read in, rather than CSS
                  transformed. A text-transform makes the DOM disagree with the
                  screen, so a screen reader announces one thing, a copy and
                  paste yields another, and voice-audit reads a sentence nobody
                  sees. The letter spacing went with the capitals: it existed
                  only to keep them legible.
                */}
                <p className="text-[13px] font-semibold text-[var(--color-ink-quiet)]">
                  Part {partIndex + 1} of {parts.length}
                </p>
                <h3 className="mt-1 text-[20px] leading-[1.25] font-semibold text-[var(--color-ink)]">
                  {parts[partIndex]?.label}
                </h3>
              </div>
            ) : null}
            {(parts[partIndex]?.fields ?? []).map((input) => (
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
                    {/*
                      STYLED, STILL THE NATIVE CONTROL. Seven of these rendered
                      as the browser's bare file picker. The `file:` variant
                      styles the button the browser draws, so keyboard focus,
                      the label and the screen reader's announcement are the
                      platform's own rather than a re-implementation. A
                      photograph accepts images, which on a phone offers the
                      camera beside the library; `capture` is not set, because
                      it would take the library away.
                    */}
                    <input
                      id={input.id}
                      type="file"
                      accept={input.photo ? "image/*" : undefined}
                      className="block w-full text-[14px] text-[var(--color-ink-quiet)] file:mr-3 file:min-h-[var(--tap-target)] file:cursor-pointer file:rounded-[3px] file:border file:border-[var(--color-limestone-edge)] file:bg-white file:px-4 file:text-[15px] file:font-semibold file:text-[var(--color-ink)]"
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
          <ReviewStep entry={entry} state={state} trust={trust} onAccept={(v) => set({ acceptedTerms: v })} />
        ) : null}
      </div>

      {attempted && blockers.length > 0 ? (
        <div
          ref={stillNeeded}
          tabIndex={-1}
          aria-live="polite"
          className="mt-8 border-l-2 border-[var(--color-ink)] pl-3 outline-none"
        >
          <p className="text-[14px] font-semibold text-[var(--color-ink)]">Before you continue</p>
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
        Ink, not red, and no tint. DESIGN_V10.md line 29 allows no red, green or
        amber anywhere in the UI; the 2px rule is structure and does the work the
        colour was credited with. The note on the sign up form carries why this
        sentence used to say the opposite.
      */}
      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-8 border-l-2 border-[var(--color-ink)] pl-3 text-[15px] leading-[1.6] font-semibold text-[var(--color-ink)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--color-limestone-line)] pt-6">
        {/*
          BACK WALKS THE SUB PAGES BEFORE IT LEAVES THE STEP, and forward does
          the same, so a person moving through step 3 never loses the answers on
          a part by stepping over it. Leaving the step forward resets to the
          first part and leaving it backward lands on the last, which is what
          "back" means to somebody who has just arrived from the review screen.
        */}
        <button
          type="button"
          disabled={index === 0 && (!onRequirements || partIndex === 0)}
          onClick={() => {
            setAttempted(false);
            if (onRequirements && partIndex > 0) {
              setPart(partIndex - 1);
              return;
            }
            setPart(0);
            setIndex((i) => Math.max(0, i - 1));
          }}
          className="min-h-[var(--tap-target)] rounded-[3px] border border-[var(--color-limestone-edge)] px-5 text-[15px] font-semibold text-[var(--color-ink)] disabled:opacity-40"
        >
          Back
        </button>
        {step.id === "review" ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => blockedOrGo(() => void submit())}
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
            onClick={() =>
              blockedOrGo(() => {
                if (onRequirements && partIndex < lastPart) {
                  setPart(partIndex + 1);
                  /*
                   * Back to the top, because a sub page that opens halfway down
                   * is a sub page whose first question nobody sees. The split
                   * exists to make the screen short; landing mid screen would
                   * give that back.
                   */
                  window.scrollTo({ top: 0, behavior: "auto" });
                  return;
                }
                setPart(0);
                setIndex((i) => Math.min(steps.length - 1, i + 1));
              })
            }
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
  trust,
  onAccept,
}: {
  entry: CatalogEntry;
  state: FlowState;
  trust: TrustFacts;
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

      <h3 className="v10-label mt-9">
        If the engineer declines
      </h3>
      <ul className="mt-4 flex flex-col gap-3">
        {refundDisclosure(entry).map((line) => (
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

      {/*
        WHO YOU ARE PAYING, AND HOW. The operator's approved signals of
        2026-10-05, each from its one home (see TrustFacts). The card sentence
        is true because checkout is Stripe's hosted page (payments-stripe.ts,
        checkout.sessions.create with no embedded mode), so the card number is
        typed on Stripe's page and never reaches this firm. The reassurance is
        refundIfDeclinedEarly, by name, never the sentence the operator
        rejected as false on 2026-10-05, because the customer pays at checkout.
        The "Powered by Stripe" mark, approved 2026-10-07, is Stripe's own
        asset, downloaded unmodified from Stripe's brand page (the black badge
        in Powered_by_Stripe-badge.zip) to public/brand, and linked to
        stripe.com as that page suggests. Its use is governed by Stripe's Marks
        Usage Agreement, stripe.com/marks/legal.
      */}
      <h3 className="v10-label mt-9">Who you are paying</h3>
      <ul className="mt-4 flex flex-col gap-2 text-[14px] leading-[1.65] text-[var(--color-ink-quiet)]">
        <li>{trust.registration}</li>
        {trust.engineerInCharge ? (
          <li>A licensed Texas Professional Engineer is in responsible charge of the firm&apos;s engineering work.</li>
        ) : null}
        {trust.address ? <li>{trust.address}</li> : null}
        {trust.phone ? <li>{trust.phone}</li> : null}
        <li>
          You pay on Stripe&apos;s secure checkout page. Your card number goes to Stripe and is never
          seen or stored by the firm.
        </li>
        <li>{refundIfDeclinedEarly(entry)}</li>
      </ul>
      <a
        href="https://stripe.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- an unmodified vendor SVG, served as the file it is */}
        <img src="/brand/powered-by-stripe-black.svg" alt="Powered by Stripe" width={150} height={34} />
      </a>
    </div>
  );
}

/*
 * THE DISCLOSURE IS THE SERVER'S OWN, SINCE 2026-10-07. A copy of
 * refundDisclosure lived here, "written here so the customer reads them before
 * paying", and it had already drifted: an unpublished fee read one way on this
 * screen and another on the stored order. refundDisclosure imports nothing but
 * types and the money formatter, so the form calls it directly and the words a
 * customer reads before paying are the words the order stores.
 */
