"use client";

import { useState } from "react";

/**
 * Enrolment, in the order that cannot lock somebody out.
 *
 * THE ORDER IS THE SAFETY PROPERTY AND THE OBVIOUS ORDER IS WRONG
 * ---------------------------------------------------------------
 * Ask for the code BEFORE the secret becomes active. The server holds it as a
 * pending secret until a code proves the app has it, so somebody who scans
 * nothing, or scans it into a phone they then lose, is not locked out of an
 * account that has begun demanding a factor they never had.
 *
 * THE RECOVERY CODES ARE SHOWN ON THE SAME SCREEN THAT CONFIRMS
 * -------------------------------------------------------------
 * Not a later step somebody can skip. An enrolment that completes without them
 * is the state that turns a lost phone into a lost account, so the two happen
 * in one call and the codes are shown once, here, with the continue button
 * behind an acknowledgement.
 *
 * THE QR IS THE PRIMARY PATH, AND THE TYPED SECRET IS THE FALLBACK
 * ----------------------------------------------------------------
 * This screen shipped without a QR, on the reasoning that an encoder is a
 * dependency in the authentication path for a convenience. Operator ruling,
 * 2026-09-07, overruled it and was right: the QR is what people expect, and it
 * removes a transcription error from the one step in this flow that has no
 * second chance. A mistyped secret produces codes that never verify, from a
 * phone that is working perfectly, which is the least debuggable position this
 * platform can put somebody in.
 *
 * The dependency concern was answered rather than dismissed. src/lib/qr.ts is
 * written here, so nothing is added to the runtime at all, and it is verified
 * by decoding its output with an independent decoder that ships with nothing.
 * The SVG is rendered SERVER SIDE and arrives as inert markup, so no third
 * party ever sees the secret and the browser is handed no encoder.
 */
export function EnrolForm({ required }: { required: boolean }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  /* The SVG, rendered by the server. This component never sees the encoder. */
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string>("/portal");

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !data?.ok) {
        setError((data?.error as string) ?? "That did not work. Try again.");
        return null;
      }
      return data;
    } catch {
      setError("The network did not answer. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------- step three: the codes */

  if (codes) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <p className="text-[13.5px] leading-[1.6] text-[var(--navy)]">
          Your second factor is on. Save these recovery codes somewhere that is not the phone
          holding your authenticator app. Each one works once, and this is the only time they are
          shown.
        </p>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted,#f7f8f9)] p-3 font-mono text-[14px] text-[var(--navy)]">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <label className="flex items-start gap-2.5 text-[13.5px] leading-[1.55] text-[var(--navy)]">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px]"
          />
          <span>I have saved these codes somewhere I can reach without my phone.</span>
        </label>

        <button
          type="button"
          disabled={!saved}
          onClick={() => window.location.assign(redirectTo)}
          className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          Continue to the portal
        </button>
      </div>
    );
  }

  /* --------------------------------------------- step two: prove it works */

  if (secret) {
    return (
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const data = await post({ action: "confirm", code });
          if (data) {
            setCodes(data.recoveryCodes as string[]);
            if (typeof data.redirect === "string") setRedirectTo(data.redirect);
          }
        }}
      >
        <p className="text-[13.5px] leading-[1.6] text-[var(--navy)]">
          Scan this with your authenticator app, then enter the six digit code it shows.
        </p>

        {/*
          THE QR IS THE PRIMARY PATH AND THE TYPED SECRET IS THE FALLBACK.
          Operator instruction, 2026-09-07: scanning removes a transcription
          error from the one step with no second chance. A mistyped secret
          produces codes that never verify, from a phone that is working
          perfectly, which is the least debuggable position this flow has.

          Rendered server side from the otpauth uri, by src/lib/qr.ts, so
          nothing about the secret reaches a third party. The markup arrives as
          a string of SVG and is inert: no script, nothing fetched.
        */}
        {qr ? (
          <div
            className="mx-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-white p-3"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        ) : null}

        <details className="rounded-[var(--radius-control)] border border-[var(--border)]">
          <summary className="min-h-[var(--tap-target)] flex cursor-pointer items-center px-3 text-[13px] font-semibold text-[var(--navy)]">
            Cannot scan it? Type it instead
          </summary>
          <div className="border-t border-[var(--border)] p-3">
            <p className="font-mono text-[15px] leading-[1.6] break-all text-[var(--navy)]">
              {secret}
            </p>
            {uri ? (
              <a
                href={uri}
                className="min-h-[var(--tap-target)] mt-2 inline-flex items-center text-[13px] font-semibold text-[var(--navy)] underline"
              >
                Or open an authenticator app on this device
              </a>
            ) : null}
          </div>
        </details>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--navy)]">
            The six digit code from your app
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            aria-describedby={error ? "enrol-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
          />
        </label>

        {error ? (
          <p
            id="enrol-error"
            role="alert"
            className="rounded-[var(--radius-control)] border border-[var(--red-border)] bg-[var(--red-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--red)]"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Checking" : "Turn it on"}
        </button>

        <p className="text-[13px] leading-[1.55] text-[var(--secondary)]">
          Nothing has changed on your account yet. It turns on when this code is accepted, so
          starting this cannot lock you out.
        </p>
      </form>
    );
  }

  /* -------------------------------------------------- step one: begin */

  return (
    <div className="mt-4 flex flex-col gap-3">
      {required ? (
        <p className="text-[13.5px] leading-[1.6] text-[var(--navy)]">
          Your role requires a second factor, so this has to be set up before you can go further.
          It takes about a minute and you will need an authenticator app on your phone.
        </p>
      ) : (
        <p className="text-[13.5px] leading-[1.6] text-[var(--navy)]">
          A second factor means a stolen password is not enough to reach this account.
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--red-border)] bg-[var(--red-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--red)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          const data = await post({ action: "begin" });
          if (data) {
            setSecret(data.secret as string);
            setUri((data.uri as string) ?? null);
          }
        }}
        className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Starting" : "Set up a second factor"}
      </button>
    </div>
  );
}
