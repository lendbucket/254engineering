"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GA_EVENTS } from "@/lib/analytics";
import { trackEvent } from "@/components/site/Analytics";

/**
 * THE /start PRICE FINDER. Robert's add-on of 2026-11-15, items 4, 5, 6 and 10,
 * drawn from the approved design "254 Engineering Ads Landing Page".
 *
 * Who is asking, then the county, then the price, then Order, Call me first, or
 * Email me the price. "Something else, or not sure" opens the inquiry form with
 * a photo or PDF upload. Every form posts to /api/start and becomes a lead the
 * office sees.
 *
 * A LINE THAT IS NOT SELLABLE SHOWS /order's OWN CLOSED STATE. The page passes
 * each letter's offer exactly as sellableLineOffers() gives /order: when the
 * line is not orderable, the button is /order's quote or waitlist action, never
 * an Order button (item 4).
 *
 * The prices arrive already derived from the price book on the server. The
 * browser never sends a price: /api/start recomputes it.
 */

export type FinderPrice =
  | { kind: "fixed"; inland: string; coastal: string | null }
  | { kind: "hourly"; rate: string; minimum: string }
  | { kind: "none" };

export type FinderLetter = {
  key: string;
  name: string;
  cta: string;
  orderable: boolean;
  href: string;
  /** /order's own label for this line: the order words when it is open, its quote or waitlist action when it is not. */
  offerLabel: string;
  price: FinderPrice;
};

type Reason = { id: string; label: string; hint: string; to: string };
type Step = 1 | 2 | 3 | "ask";

const input =
  "mt-1.5 block w-full border border-[var(--color-limestone-line)] bg-white px-3.5 py-3 text-[16px] text-[var(--color-ink)] focus:border-slate focus:outline-none";
const label = "text-[13px] font-semibold text-slate";

export function Finder({
  letters,
  reasons,
  initialLetter,
  host,
  phone,
  tel,
  coastalCounties,
}: {
  letters: FinderLetter[];
  reasons: Reason[];
  initialLetter: string | null;
  host: string;
  phone: string | null;
  tel: string | null;
  coastalCounties: string;
}) {
  const byKey = useMemo(() => new Map(letters.map((l) => [l.key, l])), [letters]);
  const start = initialLetter && byKey.has(initialLetter) ? initialLetter : null;
  const [step, setStep] = useState<Step>(start ? (start === "design" ? 3 : 2) : 1);
  const [letterKey, setLetterKey] = useState<string | null>(start);
  const [reasonLabel, setReasonLabel] = useState<string | null>(null);
  const [coastal, setCoastal] = useState<"yes" | "no" | "unsure" | null>(null);
  const [lead, setLead] = useState<"call" | "email" | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  /* Focus moves to each step's heading, so a screen reader hears where it is. One element at a time holds it. */
  const headingEl = useRef<HTMLElement | null>(null);
  const headingRef = (el: HTMLElement | null) => {
    headingEl.current = el;
  };

  const letter = letterKey ? byKey.get(letterKey) ?? null : null;

  /* The office clock is read in the browser, so a page served earlier still says the right thing now. */
  useEffect(() => {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    setOpenNow(hour >= 8 && hour < 20);
  }, []);

  useEffect(() => {
    trackEvent(GA_EVENTS.finderStep, host, { step: String(step), letter: letterKey ?? "none" });
    if (step === 3 && letter) {
      const shown = letter.price.kind === "fixed" ? (coastal === "yes" && letter.price.coastal ? letter.price.coastal : letter.price.inland) : letter.price.kind === "hourly" ? letter.price.rate : "none";
      trackEvent(GA_EVENTS.priceShown, host, { letter: letter.key, price: shown });
    }
    if (step !== 1) headingEl.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const pickReason = (r: Reason) => {
    setReasonLabel(r.label);
    setLetterKey(r.to);
    setCoastal(null);
    setLead(null);
    setSent(null);
    setStep(r.to === "design" ? 3 : 2);
  };
  const pickCounty = (c: "yes" | "no" | "unsure") => {
    setCoastal(c);
    setStep(3);
  };
  const back = () => {
    setLead(null);
    setSent(null);
    setErrors({});
    setStep(step === "ask" || step === 2 || (step === 3 && letterKey === "design") ? 1 : 2);
  };

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; errors?: Record<string, string>; message?: string };
      if (res.ok && json.ok) return true;
      setErrors(json.errors ?? { form: json.message ?? "That did not send. Please try again, or call the office." });
      return false;
    } catch {
      setErrors({ form: "That did not send. Please check your connection and try again, or call the office." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const draftId = useMemo(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `d${Date.now()}`), []);
  const [attachment, setAttachment] = useState<{ key: string; name: string } | null>(null);
  async function upload(file: File) {
    setErrors({});
    const res = await fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign", draftId, filename: file.name, contentType: file.type, size: file.size }),
    });
    const signed = (await res.json().catch(() => ({}))) as { ok?: boolean; uploadUrl?: string; storageKey?: string; message?: string };
    if (!signed.ok || !signed.uploadUrl || !signed.storageKey) {
      setErrors({ attachment: signed.message ?? "That file could not be prepared. Use a PDF or a photograph." });
      return;
    }
    const put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!put.ok) {
      setErrors({ attachment: "That file did not upload. Try again, or a smaller one." });
      return;
    }
    setAttachment({ key: signed.storageKey, name: file.name });
  }

  const thanks =
    openNow === false
      ? "The office opens at 8 AM Central and will call you back then."
      : "The office calls you back during opening hours, 8 AM to 8 PM Central.";

  const stepper = step === "ask" ? ["What you need", "How to reach you"] : ["Who is asking", "Location", "Your price"];
  const current = step === "ask" ? 2 : step;

  const priceBig = !letter ? "" : letter.price.kind === "fixed" ? (coastal === "yes" && letter.price.coastal ? letter.price.coastal : letter.price.inland) : letter.price.kind === "hourly" ? `${letter.price.rate}/hr` : "";
  const priceNote = !letter
    ? ""
    : letter.price.kind === "hourly"
      ? `Fixed fee quoted before work starts. ${letter.price.minimum} minimum.`
      : letter.price.kind === "fixed"
        ? coastal === "yes"
          ? "Includes the coastal county charge."
          : coastal === "unsure" && letter.price.coastal
            ? `${letter.price.coastal} if the property is in one of the 14 coastal counties.`
            : "Outside San Antonio and the Coastal Bend, call first about travel."
        : "";
  const summary = [reasonLabel, letterKey === "design" ? null : coastal === "yes" ? "coastal county" : coastal === "no" ? "inland county" : coastal === "unsure" ? "county not sure" : null].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="finder-title" className="border border-[var(--color-limestone-line)] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-limestone-line)] px-5 py-4">
        <h2 id="finder-title" className="text-[17px] font-semibold text-slate">
          Price your letter
        </h2>
        {step !== 1 ? (
          <button type="button" onClick={back} className="min-h-[44px] px-2 text-[14px] font-semibold text-[var(--color-link)]">
            Back
          </button>
        ) : (
          <span className="text-[13px] text-[var(--color-ink-quiet)]">About 30 seconds</span>
        )}
      </div>

      <ol className="flex items-center gap-2 px-5 pt-4" aria-label="Steps">
        {stepper.map((s, i) => {
          const n = i + 1;
          const done = typeof current === "number" && n < current;
          const on = n === current;
          return (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-2" aria-current={on ? "step" : undefined}>
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center text-[12px] font-bold ${done ? "bg-slate text-white" : on ? "bg-brass text-[var(--color-slate-ink)]" : "bg-[var(--color-limestone-sunk)] text-[var(--color-ink-quiet)]"}`}
              >
                {/* A drawn tick rather than the check mark character, which the content rules count as an emoji (placeholder-audit). */}
                {done ? (
                  <>
                    <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6.5 5 9.5 10 3" />
                    </svg>
                    <span className="sr-only">{`Step ${n} done`}</span>
                  </>
                ) : (
                  n
                )}
              </span>
              <span className={`truncate text-[12px] ${on ? "font-bold text-slate" : "font-semibold text-[var(--color-ink-quiet)]"}`}>{s}</span>
            </li>
          );
        })}
      </ol>

      <div className="px-5 py-5">
        {step === 1 ? (
          <fieldset>
            <legend ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold text-slate">
              Who is asking for the letter?
            </legend>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {reasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickReason(r)}
                  className="flex min-h-[64px] flex-col items-start justify-center border border-[var(--color-limestone-line)] bg-white px-4 py-3 text-left hover:border-slate"
                >
                  <span className="text-[15px] font-semibold text-slate">{r.label}</span>
                  <span className="text-[13px] text-[var(--color-ink-quiet)]">{r.hint}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setLetterKey(null);
                setStep("ask");
              }}
              className="mt-2 flex min-h-[56px] w-full items-center justify-between border border-dashed border-[var(--color-limestone-edge)] px-4 py-3 text-left hover:border-slate"
            >
              <span>
                <span className="block text-[15px] font-semibold text-slate">Something else, or not sure</span>
                <span className="block text-[13px] text-[var(--color-ink-quiet)]">Describe it and the office will tell you which letter.</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </fieldset>
        ) : null}

        {step === 2 && letter ? (
          <fieldset>
            <legend ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold text-slate">
              Which county is the property in?
            </legend>
            <p className="mt-1 text-[14px] text-[var(--color-ink-quiet)]">For the {letter.name.charAt(0).toLowerCase() + letter.name.slice(1)}.</p>
            <div className="mt-4 grid gap-2">
              {(
                [
                  ["no", "San Antonio or another inland county"],
                  ["yes", "One of the 14 coastal counties"],
                  ["unsure", "I am not sure"],
                ] as const
              ).map(([v, text]) => (
                <button key={v} type="button" onClick={() => pickCounty(v)} className="flex min-h-[56px] w-full items-center border border-[var(--color-limestone-line)] px-4 py-3 text-left text-[15px] font-semibold text-slate hover:border-slate">
                  {text}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-[1.6] text-[var(--color-ink-quiet)]">The 14 coastal counties: {coastalCounties}.</p>
          </fieldset>
        ) : null}

        {step === 3 && letter ? (
          <div>
            <p className="text-[12px] font-semibold text-[var(--color-ink-quiet)]">Your letter</p>
            <h3 ref={headingRef} tabIndex={-1} className="mt-1 text-[20px] font-semibold text-slate">
              {letter.name}
            </h3>
            {priceBig ? <p className="mt-2 text-[32px] leading-none font-semibold text-slate">{priceBig}</p> : null}
            {priceNote ? <p className="mt-2 text-[14px] text-[var(--color-ink-quiet)]">{priceNote}</p> : null}
            {summary ? (
              <p className="mt-2 text-[13px] text-[var(--color-ink-quiet)]">
                Based on: {summary}.{" "}
                <button type="button" onClick={() => setStep(1)} className="font-semibold text-[var(--color-link)] underline underline-offset-2">
                  Change
                </button>
              </p>
            ) : null}

            <a
              href={letter.href}
              onClick={() => letter.orderable && trackEvent(GA_EVENTS.orderStarted, host, { letter: letter.key })}
              className={
                letter.orderable
                  ? "mt-5 flex min-h-[52px] w-full items-center justify-center bg-slate px-5 text-[16px] font-semibold text-white hover:bg-slate-deep"
                  : "mt-5 flex min-h-[52px] w-full items-center justify-center border border-[var(--color-limestone-edge)] px-5 text-[16px] font-semibold text-slate hover:border-slate"
              }
            >
              {letter.orderable ? letter.cta : letter.offerLabel}
            </a>

            {sent ? (
              <div className="mt-5 border-t border-[var(--color-limestone-line)] pt-4" role="status">
                <p className="text-[15px] font-semibold text-slate">Thanks. {sent}</p>
                <button type="button" onClick={() => { setStep(1); setLead(null); setSent(null); }} className="mt-2 min-h-[44px] text-[14px] font-semibold text-[var(--color-link)]">
                  Start over
                </button>
              </div>
            ) : lead === null ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setLead("call")} className="min-h-[48px] border border-[var(--color-limestone-line)] px-3 text-[15px] font-semibold text-slate hover:border-slate">
                  Call me first
                </button>
                <button type="button" onClick={() => setLead("email")} className="min-h-[48px] border border-[var(--color-limestone-line)] px-3 text-[15px] font-semibold text-slate hover:border-slate">
                  Email me the price
                </button>
              </div>
            ) : (
              <form
                className="mt-4 grid gap-3 border-t border-[var(--color-limestone-line)] pt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const body =
                    lead === "call"
                      ? { form: "callback", name: f.get("name"), phone: f.get("phone"), letter: letter.key, coastal: coastal ?? undefined, company: f.get("company") }
                      : { form: "email_price", email: f.get("email"), phone: f.get("phone") || undefined, letter: letter.key, coastal: coastal ?? undefined, company: f.get("company") };
                  if (await post(body)) {
                    trackEvent(lead === "call" ? GA_EVENTS.callbackRequest : GA_EVENTS.emailPriceRequest, host, { letter: letter.key });
                    setSent(lead === "call" ? thanks : "The price and the order link are in your inbox.");
                  }
                }}
              >
                <p className="text-[15px] font-semibold text-slate">
                  {lead === "call" ? (openNow === false ? "We will call you after we open at 8 AM Central." : "We will call you back during opening hours.") : "We will email you this price and the order link."}
                </p>
                {lead === "call" ? (
                  <>
                    <label className="block">
                      <span className={label}>Name</span>
                      <input name="name" autoComplete="name" required className={input} aria-invalid={Boolean(errors.name)} />
                      {errors.name ? <span className="mt-1 block text-[13px] font-semibold text-[var(--color-ink)]">{errors.name}</span> : null}
                    </label>
                    <label className="block">
                      <span className={label}>Phone</span>
                      <input name="phone" type="tel" autoComplete="tel" required className={input} aria-invalid={Boolean(errors.phone)} />
                      {errors.phone ? <span className="mt-1 block text-[13px] font-semibold text-[var(--color-ink)]">{errors.phone}</span> : null}
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className={label}>Email</span>
                      <input name="email" type="email" autoComplete="email" required className={input} aria-invalid={Boolean(errors.email)} />
                      {errors.email ? <span className="mt-1 block text-[13px] font-semibold text-[var(--color-ink)]">{errors.email}</span> : null}
                    </label>
                    <label className="block">
                      <span className={label}>Phone (optional)</span>
                      <input name="phone" type="tel" autoComplete="tel" className={input} />
                    </label>
                  </>
                )}
                <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
                {errors.form ? <p className="text-[14px] font-semibold text-[var(--color-ink)]" role="alert">{errors.form}</p> : null}
                <button type="submit" disabled={busy} className="min-h-[52px] bg-slate px-5 text-[16px] font-semibold text-white hover:bg-slate-deep disabled:opacity-60">
                  {busy ? "Sending" : lead === "call" ? "Call me back" : "Email me the price"}
                </button>
                <p className="text-[13px] leading-[1.6] text-[var(--color-ink-quiet)]">
                  {lead === "call"
                    ? "We will only use this number to call you about this request."
                    : "We will email the price and the order link now, and twice more over five days unless you order. Unsubscribe at any time."}
                </p>
              </form>
            )}
          </div>
        ) : null}

        {step === "ask" ? (
          sent ? (
            <div role="status">
              <p className="text-[15px] font-semibold text-slate">Thanks. {sent}</p>
              <button type="button" onClick={() => { setStep(1); setSent(null); setAttachment(null); }} className="mt-2 min-h-[44px] text-[14px] font-semibold text-[var(--color-link)]">
                Start over
              </button>
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const ok = await post({
                  form: "start_ask",
                  name: f.get("name"),
                  phone: f.get("phone"),
                  email: f.get("email") || undefined,
                  city: f.get("city"),
                  message: f.get("message"),
                  draftId,
                  attachmentKey: attachment?.key,
                  company: f.get("company"),
                });
                if (ok) {
                  trackEvent(GA_EVENTS.inquirySent, host, { attachment: attachment ? "yes" : "no" });
                  setSent(thanks);
                }
              }}
            >
              <h3 ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold text-slate">
                Tell us what they asked for
              </h3>
              <p className="text-[14px] text-[var(--color-ink-quiet)]">Someone in the office reads it and calls you with the right letter and the price.</p>
              {(
                [
                  ["name", "Name", "text", "name", true],
                  ["phone", "Phone", "tel", "tel", true],
                  ["email", "Email (optional)", "email", "email", false],
                  ["city", "City or address", "text", "street-address", true],
                ] as const
              ).map(([n, l, t, ac, req]) => (
                <label key={n} className="block">
                  <span className={label}>{l}</span>
                  <input name={n} type={t} autoComplete={ac} required={req} className={input} aria-invalid={Boolean(errors[n])} />
                  {errors[n] ? <span className="mt-1 block text-[13px] font-semibold text-[var(--color-ink)]">{errors[n]}</span> : null}
                </label>
              ))}
              <label className="block">
                <span className={label}>What did they ask for?</span>
                <textarea name="message" required rows={4} className={input} aria-invalid={Boolean(errors.message)} />
                {errors.message ? <span className="mt-1 block text-[13px] font-semibold text-[var(--color-ink)]">{errors.message}</span> : null}
              </label>
              <label className="block">
                <span className={label}>Add a photo of the report page</span>
                <span className="block text-[13px] text-[var(--color-ink-quiet)]">Photo or PDF, optional</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
                  className="mt-1.5 block w-full text-[14px]"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) void upload(file);
                  }}
                />
                {attachment ? <span className="mt-1 block text-[13px] text-slate">Attached: {attachment.name}</span> : null}
                {errors.attachment ? <span className="mt-1 block text-[13px] font-semibold text-[var(--color-ink)]">{errors.attachment}</span> : null}
              </label>
              <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
              {errors.form ? <p className="text-[14px] font-semibold text-[var(--color-ink)]" role="alert">{errors.form}</p> : null}
              <button type="submit" disabled={busy} className="min-h-[52px] bg-slate px-5 text-[16px] font-semibold text-white hover:bg-slate-deep disabled:opacity-60">
                {busy ? "Sending" : "Send to the office"}
              </button>
              <p className="text-[13px] text-[var(--color-ink-quiet)]">
                We will only contact you about this request. See our <a href="/privacy" className="text-[var(--color-link)] underline">privacy policy</a>.
              </p>
            </form>
          )
        ) : null}

        {tel && phone && step !== 1 ? (
          <p className="mt-5 border-t border-[var(--color-limestone-line)] pt-4 text-[14px] text-[var(--color-ink-quiet)]">
            Rather talk it through?{" "}
            <a href={tel} className="font-semibold text-slate underline underline-offset-2">
              {phone}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
