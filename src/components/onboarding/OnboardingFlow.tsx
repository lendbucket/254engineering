"use client";

import { useMemo, useState } from "react";
import { Container } from "@/components/ui/Container";
import { FileField, StepProgress, type UploadState } from "@/components/careers/fields";
import { buttonClass } from "@/components/ui/primitives";
import {
  CATCH_ALL_STEP,
  ONBOARDING_STEPS,
  type OnboardingRole,
  type StepDef,
} from "@/content/onboarding-checklists";

/**
 * The onboarding stepper.
 *
 * EVERY ITEM SAVES ON ITS OWN
 * ---------------------------
 * There is no draft, no local buffer, and no submit that flushes accumulated
 * work. An upload completes, the server records it, and the item is done. Close
 * the tab mid step and nothing is lost; the same link reopens with that item
 * already ticked.
 *
 * The careers application does the opposite and keeps a sessionStorage draft,
 * which is right for that surface: it is one long form somebody fills in once.
 * This is a checklist a person works through over days, on a phone, between
 * other things, and a draft would be the thing that loses their passport scan
 * when the browser evicts it.
 *
 * WHY THE UPLOAD IS TWO REQUESTS
 * ------------------------------
 * Ask the server for a signed URL, PUT the bytes straight to storage, then tell
 * the server the path. The file never passes through a serverless function, so a
 * fifteen megabyte photograph does not risk a body limit or a timeout, and a
 * phone on poor signal is talking to storage rather than to a function with a
 * request budget.
 *
 * The cost is that a failed second request leaves an object in the bucket with
 * no row pointing at it. That is the right way round: an orphaned object is
 * invisible and cheap, whereas a row pointing at a file that was never uploaded
 * would show the person a completed item they never completed.
 *
 * THE TOKEN IS THE ONLY THING SENT
 * --------------------------------
 * No onboarding id is held in this component or posted anywhere. The server
 * resolves the record from the token on every request. See the note in
 * src/app/api/onboarding/route.ts for why that is not a convenience.
 */

type ItemState = {
  key: string;
  label: string;
  status: "pending" | "uploaded" | "accepted" | "rejected";
  rejectedReason: string | null;
};

type Definition = {
  key: string;
  label: string;
  help: string;
  step: string;
  reference?: { label: string; url: string };
  fields?: { name: string; label: string; placeholder?: string }[];
  acknowledgeOnly?: boolean;
};

export function OnboardingFlow({
  token,
  role,
  status,
  items,
  definitions,
}: {
  token: string;
  role: OnboardingRole;
  status: string;
  items: ItemState[];
  definitions: Definition[];
}) {
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(items.map((i) => [i.key, i])),
  );
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(status === "submitted" || status === "verified");
  const [formError, setFormError] = useState<string | null>(null);

  const defByKey = useMemo(
    () => Object.fromEntries(definitions.map((d) => [d.key, d])),
    [definitions],
  );

  /**
   * The steps that actually have items in them.
   *
   * Derived rather than declared, so an operator adding a bespoke item to one
   * person's checklist gets a step for it, and a role whose checklist loses an
   * item does not render an empty step with a Continue button under it.
   */
  const steps: (StepDef & { keys: string[] })[] = useMemo(() => {
    const defs = [...ONBOARDING_STEPS[role], CATCH_ALL_STEP];
    const known = new Set(ONBOARDING_STEPS[role].map((s) => s.id));
    return defs
      .map((s) => ({
        ...s,
        keys: items
          .filter((i) => {
            const stepId = defByKey[i.key]?.step;
            return s.id === CATCH_ALL_STEP.id ? !stepId || !known.has(stepId) : stepId === s.id;
          })
          .map((i) => i.key),
      }))
      .filter((s) => s.keys.length > 0);
  }, [role, items, defByKey]);

  // StepProgress wants { id, title }. The review step is appended here rather
  // than defined in the checklist config, because it is a property of the flow
  // and not of what the person is being asked for.
  const allSteps = [
    ...steps.map((s) => ({ id: s.id, title: s.title })),
    { id: "review", title: "Review" },
  ];
  const onReview = step >= steps.length;

  const outstanding = Object.values(state).filter((i) => i.status === "pending");

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...body }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; url?: string; path?: string };
    if (!res.ok || !json.ok) {
      throw new Error(json.error || "That did not save. Try it again in a moment.");
    }
    return json;
  }

  async function upload(itemKey: string, file: File) {
    setFormError(null);
    setUploads((u) => ({ ...u, [itemKey]: { status: "uploading", filename: file.name } }));
    try {
      const signed = await post({
        action: "upload",
        itemKey,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      // Narrowed into locals: the guard above proves both are present, but the
      // response type is deliberately loose and does not carry that through.
      const { url: signedUrl, path: storageKey } = signed;
      if (!signedUrl || !storageKey) throw new Error("The upload could not be prepared.");

      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("The file did not reach storage. Try it again.");

      await post({ action: "item", itemKey, storageKey });

      setUploads((u) => ({
        ...u,
        [itemKey]: {
          status: "done",
          filename: file.name,
          path: storageKey,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        },
      }));
      setState((s) => ({
        ...s,
        [itemKey]: { ...s[itemKey], status: "uploaded", rejectedReason: null },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "That upload did not finish.";
      setUploads((u) => ({ ...u, [itemKey]: { status: "error", message } }));
    }
  }

  async function acknowledge(itemKey: string) {
    setFormError(null);
    try {
      await post({ action: "item", itemKey });
      setState((s) => ({
        ...s,
        [itemKey]: { ...s[itemKey], status: "uploaded", rejectedReason: null },
      }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That did not save.");
    }
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    try {
      await post({ action: "submit" });
      setSubmitted(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That did not send.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="border-b border-limestone-line">
        <Container>
          <div className="max-w-2xl py-16 sm:py-24">
            <p className="font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
              Received
            </p>
            <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
            <h2 className="mt-8 font-display text-[1.9rem] leading-[1.15] font-bold text-slate sm:text-[2.4rem]">
              That is everything we needed from you
            </h2>
            <p className="mt-7 text-[1.04rem] leading-[1.75] text-slate-muted">
              Your documents are in. Two steps still need the firm rather than you: confirming your
              identity on the scheduled video call, and examining your I-9 documents live, which
              federal procedure requires be done in person or on camera.
            </p>
            <p className="mt-5 text-[1.04rem] leading-[1.75] text-slate-muted">
              If anything needs correcting you will hear directly, and this link will reopen for the
              item in question rather than for the whole checklist.
            </p>
          </div>
        </Container>
      </section>
    );
  }

  const current = onReview ? null : steps[step];

  return (
    <section className="border-b border-limestone-line">
      <Container>
        <div className="max-w-3xl py-12 sm:py-16">
          <StepProgress steps={allSteps} current={step} />

          {current ? (
            <div className="mt-12">
              <h2 className="font-display text-[1.6rem] leading-[1.2] font-semibold text-slate sm:text-[2rem]">
                {current.title}
              </h2>
              <p className="mt-4 text-[1rem] leading-[1.7] text-slate-muted">{current.blurb}</p>

              <div className="mt-10 space-y-10">
                {current.keys.map((key) => {
                  const def = defByKey[key];
                  const item = state[key];
                  if (!def || !item) return null;
                  return (
                    <div key={key}>
                      {item.status === "rejected" && item.rejectedReason ? (
                        <p className="mb-4 rounded-[3px] border border-brass bg-limestone-raised px-4 py-3 text-[0.94rem] leading-[1.65] text-slate">
                          <span className="font-semibold">This one needs redoing.</span>{" "}
                          {item.rejectedReason}
                        </p>
                      ) : null}

                      {def.acknowledgeOnly ? (
                        <div>
                          <p className="font-sans text-[0.95rem] font-semibold text-slate">
                            {def.label}
                          </p>
                          <p className="mt-2 text-[0.94rem] leading-[1.7] text-slate-muted">
                            {def.help}
                          </p>
                          {item.status === "pending" ? (
                            <button
                              type="button"
                              onClick={() => acknowledge(key)}
                              className={`${buttonClass("secondary")} mt-4`}
                            >
                              I have read this
                            </button>
                          ) : (
                            <p className="mt-4 font-sans text-[0.88rem] font-semibold text-brass-ink">
                              Acknowledged
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <FileField
                            id={`item-${key}`}
                            label={def.label}
                            help={def.help}
                            required
                            state={
                              uploads[key] ??
                              (item.status === "pending"
                                ? { status: "empty" }
                                : {
                                    // Already uploaded in an earlier visit. The
                                    // filename is not kept in the row, and the
                                    // person does not need it: what they need to
                                    // know is that this one is finished.
                                    status: "done",
                                    filename: "Uploaded",
                                    path: "",
                                    size: 0,
                                    contentType: "",
                                  })
                            }
                            onSelect={(file) => upload(key, file)}
                            onClear={() =>
                              setUploads((u) => ({ ...u, [key]: { status: "empty" } }))
                            }
                          />
                          {def.reference ? (
                            <p className="mt-3 text-[0.9rem] leading-[1.6] text-slate-muted">
                              Need the form?{" "}
                              <a
                                href={def.reference.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate underline decoration-brass underline-offset-4"
                              >
                                {def.reference.label}
                              </a>
                            </p>
                          ) : null}
                          {def.fields ? (
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                              {def.fields.map((f) => (
                                <div key={f.name}>
                                  <label
                                    htmlFor={`f-${key}-${f.name}`}
                                    className="block font-sans text-[0.88rem] font-medium text-slate"
                                  >
                                    {f.label}
                                  </label>
                                  <input
                                    id={`f-${key}-${f.name}`}
                                    name={f.name}
                                    type="text"
                                    placeholder={f.placeholder}
                                    className="mt-2 min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-limestone-raised px-3.5 text-[1rem] text-slate"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-12">
              <h2 className="font-display text-[1.6rem] leading-[1.2] font-semibold text-slate sm:text-[2rem]">
                Review and send
              </h2>

              <ul className="mt-8 divide-y divide-limestone-line border-t border-b border-limestone-line">
                {items.map((i) => {
                  const live = state[i.key];
                  const done = live && live.status !== "pending";
                  return (
                    <li key={i.key} className="flex items-baseline justify-between gap-4 py-3.5">
                      <span className="text-[0.98rem] text-slate">{i.label}</span>
                      <span
                        className={`font-sans text-[0.85rem] font-semibold ${done ? "text-brass-ink" : "text-slate-muted"}`}
                      >
                        {done ? "Done" : "Still needed"}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-8 text-[0.95rem] leading-[1.7] text-slate-muted">
                Sending these confirms the documents are yours and are accurate. They are kept as
                employment records for as long as the law requires and are readable only by the
                firm. Nothing here is shared with anyone else, and you can ask what is held about
                you at any time.
              </p>

              {outstanding.length > 0 ? (
                <p className="mt-6 text-[0.95rem] leading-[1.7] text-slate">
                  {outstanding.length === 1
                    ? "One item is still outstanding."
                    : `${outstanding.length} items are still outstanding.`}{" "}
                  Go back and finish those first.
                </p>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={submitting || outstanding.length > 0}
                className={`${buttonClass("primary")} mt-8`}
              >
                {submitting ? "Sending" : "Send my documents"}
              </button>
            </div>
          )}

          {formError ? (
            <p
              role="alert"
              className="mt-8 rounded-[3px] border border-brass bg-limestone-raised px-4 py-3 text-[0.95rem] leading-[1.65] text-slate"
            >
              {formError}
            </p>
          ) : null}

          <div className="mt-12 flex items-center justify-between gap-4 border-t border-limestone-line pt-8">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className={buttonClass("secondary")}
            >
              Back
            </button>
            {!onReview ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className={buttonClass("primary")}
              >
                Continue
              </button>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
