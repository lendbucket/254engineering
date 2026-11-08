"use client";

import { useEffect, useState } from "react";
import { inNativeShell, registerNativePush } from "@/lib/native-shell";

/** Where the store app remembers this phone's own push token, to say On and to turn it off. */
const NATIVE_TOKEN_KEY = "eng-native-push-token";

/**
 * OFFER ALERTS ON THIS PHONE. Robert's T9 and his answers 6 and 7 of
 * 2026-11-07 (src/lib/ops-push.ts).
 *
 * One control on My jobs: turn alerts on, or off, for the phone in hand. It
 * asks the browser for permission only when pressed, never on load, because a
 * permission prompt nobody asked for is the one most people refuse for good.
 * It says plainly when the phone cannot take alerts, and that email still
 * carries every offer either way.
 *
 * On an iPhone, a browser tab cannot receive web push; the field app added to
 * the home screen can. The screen says so rather than offering a button that
 * would do nothing.
 */
type State = "checking" | "unsupported" | "ios-browser" | "not-configured" | "blocked" | "off" | "on" | "working";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/portal/field", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => null)) as { ok?: boolean; error?: string; publicKey?: string | null } | null;
}

export function OfferAlerts() {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);

  /*
   * INSIDE THE STORE APP (Robert's T8, 2026-11-08) the phone's own push service
   * is used, Firebase or Apple, through the same push_subscribe, the same
   * table and the same county-and-service wording. Only the token differs, and
   * it is remembered on this phone so the control can say On and turn it off.
   */
  const [native, setNative] = useState(false);

  useEffect(() => {
    void (async () => {
      if (inNativeShell()) {
        setNative(true);
        setState(window.localStorage.getItem(NATIVE_TOKEN_KEY) ? "on" : "off");
        return;
      }
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-browser" : "unsupported");
        return;
      }
      const answer = await post({ action: "push_key" }).catch(() => null);
      if (!answer?.ok || !answer.publicKey) {
        setState("not-configured");
        return;
      }
      setKey(answer.publicKey);
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })();
  }, []);

  async function turnOnNative() {
    setError(null);
    setState("working");
    const reg = await registerNativePush();
    if (!reg) {
      setError("This phone did not allow alerts. Email still tells you of every offer.");
      setState("off");
      return;
    }
    const answer = await post({ action: "push_subscribe", channel: reg.channel, endpoint: reg.token }).catch(() => null);
    if (!answer?.ok) {
      setError(answer?.error ?? "Offer alerts were not turned on.");
      setState("off");
      return;
    }
    window.localStorage.setItem(NATIVE_TOKEN_KEY, reg.token);
    setState("on");
  }

  async function turnOffNative() {
    setError(null);
    setState("working");
    const token = window.localStorage.getItem(NATIVE_TOKEN_KEY);
    if (token) {
      const answer = await post({ action: "push_unsubscribe", endpoint: token }).catch(() => null);
      if (!answer?.ok) {
        setError("Alerts could not be turned off just now. Try again with signal.");
        setState("on");
        return;
      }
      window.localStorage.removeItem(NATIVE_TOKEN_KEY);
    }
    setState("off");
  }

  async function turnOn() {
    if (native) return turnOnNative();
    if (!key) return;
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      /* The key as the base64url string the Push API takes directly. */
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const answer = await post({ action: "push_subscribe", endpoint: sub.endpoint });
      if (!answer?.ok) {
        await sub.unsubscribe().catch(() => null);
        setError(answer?.error ?? "Offer alerts were not turned on.");
        setState("off");
        return;
      }
      setState("on");
    } catch {
      setError("This phone would not turn alerts on. Email still tells you of every offer.");
      setState("off");
    }
  }

  async function turnOff() {
    if (native) return turnOffNative();
    setError(null);
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await post({ action: "push_unsubscribe", endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Alerts could not be turned off just now. Try again with signal.");
      setState("on");
    }
  }

  const line = (text: string) => <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">{text}</p>;

  return (
    <section aria-labelledby="offer-alerts-heading" className="mb-6 border-t-2 border-[var(--ink)] pt-3">
      <h2 id="offer-alerts-heading" className="portal-label">
        Offer alerts on this phone
      </h2>
      <div className="mt-1.5">
        {state === "checking" ? line("Checking this phone...") : null}
        {state === "unsupported" ? line("This browser cannot take alerts. Email still tells you of every offer.") : null}
        {state === "ios-browser"
          ? line("On an iPhone, alerts reach the field app on your home screen, not a browser tab. Add it with Share, then Add to Home Screen, and open it from there.")
          : null}
        {state === "not-configured" ? line("Offer alerts are not switched on for the firm yet. Email still tells you of every offer.") : null}
        {state === "blocked" ? line("Alerts are blocked for this site in the phone's settings. Allow notifications there to turn them on.") : null}
        {state === "off" || state === "on" || state === "working" ? (
          <>
            {line(
              state === "on"
                ? "On. A new offer shows on this phone's lock screen as its county and service, never the address or the rate. Email carries it too."
                : "Off. Turn on to hear of a new offer on this phone's lock screen. Email carries every offer either way.",
            )}
            <button
              type="button"
              onClick={() => void (state === "on" ? turnOff() : turnOn())}
              disabled={state === "working"}
              className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-4 text-[15px] font-semibold text-[var(--ink)] disabled:opacity-60"
            >
              {state === "working" ? "Working..." : state === "on" ? "Turn off alerts" : "Turn on alerts"}
            </button>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
