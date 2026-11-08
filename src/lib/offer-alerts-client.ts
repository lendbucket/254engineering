"use client";

import { inNativeShell } from "./native-shell";

/** Where the store app remembers this phone's own push token (OfferAlerts reads the same key). */
export const NATIVE_TOKEN_KEY = "eng-native-push-token";

/** How long sign out waits for this before going ahead without it. */
const SIGN_OUT_WAIT_MS = 4000;

/**
 * SIGNING OUT TURNS OFF THIS PHONE'S OFFER ALERTS FIRST. Robert's answer 5 of
 * 2026-11-08 (issue #1, 6725977818): on a shared phone, the next technician
 * must not see the previous one's offers on the lock screen.
 *
 * Called by both sign out controls BEFORE the session ends, because turning a
 * subscription off on the server needs the session that owns it. Best effort
 * and bounded: sign out never waits more than four seconds for it and never
 * fails because of it.
 *
 *  - Browser: the server row is revoked, then the browser's own subscription
 *    is removed, so this browser receives nothing further either way.
 *  - Store app: the server row for the token this phone remembered is revoked,
 *    and the remembered token is forgotten, so the next person sees alerts as
 *    off and turns them on for themselves.
 *
 * WHAT IT CANNOT DO, said rather than hidden: signed out with no signal, the
 * server is never told. A browser subscription is still removed locally, so
 * nothing arrives. A store app token stays bound to the previous technician on
 * the server until the next technician turns alerts on, which moves the token
 * to them (subscribePush upserts on the endpoint), or until a send fails.
 */
export async function forgetOfferAlerts(): Promise<void> {
  const work = (async () => {
    const off = (endpoint: string) =>
      fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push_unsubscribe", endpoint }),
      }).catch(() => null);

    if (inNativeShell()) {
      const token = window.localStorage.getItem(NATIVE_TOKEN_KEY);
      if (token) await off(token);
      window.localStorage.removeItem(NATIVE_TOKEN_KEY);
      return;
    }
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    await off(sub.endpoint);
    await sub.unsubscribe().catch(() => false);
  })().catch(() => undefined);

  await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, SIGN_OUT_WAIT_MS))]);
}
