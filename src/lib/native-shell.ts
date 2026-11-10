"use client";

/**
 * THE PORTAL, RUNNING INSIDE THE STORE APP. Robert's T8, 2026-11-08: "The app is
 * the portal's screens. No second copy of any screen or rule in native code."
 *
 * The store app (mobile/) is a Capacitor shell whose web view opens the portal
 * itself. Capacitor puts a bridge on `window.Capacitor` inside that view, and
 * nowhere else, so a screen asks this file whether it is inside the shell and,
 * if it is, calls the shell's native piece. Everything the screen then does
 * with the result is the portal's own code: the hash at capture, the queue,
 * the upload, the server's rules. In a browser every function here answers
 * "not in the shell" and the screen behaves exactly as it always has.
 *
 * No Capacitor package is imported. The bridge is read off the window, so the
 * portal's build carries no native dependency and nothing changes for a
 * browser.
 */

type Bridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
};

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: Bridge }).Capacitor;
  return cap && cap.isNativePlatform?.() ? cap : null;
}

/** Whether this page is running inside the store app. */
export function inNativeShell(): boolean {
  return bridge() !== null;
}

/** "android" or "ios" inside the store app, otherwise null. */
export function nativePlatform(): "android" | "ios" | null {
  const p = bridge()?.getPlatform?.();
  return p === "android" || p === "ios" ? p : null;
}

/**
 * Ask the phone for its push token: Firebase's on Android, Apple's on iPhone
 * (Robert's T8: native push "reuses T9's subscription table and push
 * channel"). Resolves to the channel and token for the caller to record
 * through the same push_subscribe the browser uses, or null when the
 * technician refused or the phone could not register. The plugin's own
 * listener carries the token, so this waits for it, for up to 20 seconds.
 */
export async function registerNativePush(): Promise<{ channel: "fcm" | "apns"; token: string } | null> {
  const cap = bridge();
  const push = cap?.Plugins?.PushNotifications;
  const platform = nativePlatform();
  if (!push?.requestPermissions || !push.register || !push.addListener || !platform) return null;
  try {
    const permission = (await push.requestPermissions()) as { receive?: string };
    if (permission?.receive !== "granted") return null;
    const token = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 20_000);
      void push.addListener("registration", (t: unknown) => {
        clearTimeout(timer);
        resolve((t as { value?: string })?.value ?? null);
      });
      void push.addListener("registrationError", () => {
        clearTimeout(timer);
        resolve(null);
      });
      void push.register();
    });
    return token ? { channel: platform === "ios" ? "apns" : "fcm", token } : null;
  } catch {
    return null;
  }
}

/**
 * Take a photograph with the phone's camera, kept in the app's own storage and
 * never written to the shared photo library (mobile plan section 6; Robert's
 * T8: "photos go into the app's own storage, never the phone's shared photo
 * library"). Resolves to the image's bytes, or null when the technician
 * cancelled or the camera is not available. The caller hashes and queues it
 * exactly as it does a browser photograph.
 */
export async function takeNativePhoto(): Promise<Blob | null> {
  const camera = bridge()?.Plugins?.Camera;
  if (!camera?.getPhoto) return null;
  try {
    const photo = (await camera.getPhoto({
      source: "CAMERA",
      resultType: "uri",
      saveToGallery: false,
      quality: 90,
      correctOrientation: true,
    })) as { webPath?: string };
    if (!photo?.webPath) return null;
    const res = await fetch(photo.webPath);
    return await res.blob();
  } catch {
    return null;
  }
}

/*
 * THE KEPT SIGN IN, IN THE PHONE'S KEYSTORE (0125; Robert's answer of
 * 2026-11-10, 6766967932). The SecureStorage plugin's own native methods are
 * called through the bridge, as the camera's are, so the portal's build still
 * carries no native package. On Android the value is encrypted under a key in
 * the Android Keystore; on an iPhone it is a Keychain item readable only while
 * the phone is open past its lock screen, and never copied to another device
 * or a backup (the plugin's access value 1, "this device only"). sync false:
 * never iCloud.
 *
 * The server keeps only the token's sha256 (src/lib/device-token.ts). What
 * this file does with it is three things: keep it, read it back, forget it.
 */
const KEPT_SIGN_IN = "254-field-sign-in";
const END_WAIT_MS = 5_000;

function keystore() {
  const s = bridge()?.Plugins?.SecureStorage;
  return s?.internalGetItem && s.internalSetItem && s.internalRemoveItem ? s : null;
}

/** Whether this phone can keep a sign in: inside the store app, with the keystore plugin present. */
export function canKeepSignIn(): boolean {
  return keystore() !== null && nativePlatform() !== null;
}

/**
 * After a full sign in inside the store app, ask the server for this phone's
 * token and put it in the keystore. Resolves true only when both happened. A
 * failure leaves the technician signed in exactly as a browser would be, and
 * they sign in again when the twelve hours end.
 */
export async function keepSignInOnThisPhone(): Promise<boolean> {
  const store = keystore();
  const platform = nativePlatform();
  if (!store || !platform) return false;
  try {
    const res = await fetch("/api/portal/device-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; token?: string } | null;
    if (!res.ok || !body?.ok || typeof body.token !== "string") return false;
    await store.internalSetItem({ prefixedKey: KEPT_SIGN_IN, data: body.token, sync: false, access: 1 });
    return true;
  } catch {
    return false;
  }
}

async function readKept(): Promise<string | null> {
  const store = keystore();
  if (!store) return null;
  try {
    const got = (await store.internalGetItem({ prefixedKey: KEPT_SIGN_IN, sync: false })) as { data?: unknown };
    return typeof got?.data === "string" && got.data ? got.data : null;
  } catch {
    return null;
  }
}

async function forgetKept(): Promise<void> {
  try {
    await keystore()?.internalRemoveItem({ prefixedKey: KEPT_SIGN_IN, sync: false });
  } catch {
    /* Nothing to forget, or the keystore refused: the server-side revoke below is what ends the token. */
  }
}

/**
 * Called by the portal chrome, which renders only for a FULL session: inside
 * the store app, with no token kept yet, ask for one. Once per app session, so
 * a refusal (any role but field technician) is not asked again on every page.
 * This is the one place a token is asked for, so a sign in that went through
 * the second factor screen keeps its sign in exactly as one that did not.
 */
export async function ensureKeptSignIn(): Promise<void> {
  if (!canKeepSignIn()) return;
  if (await readKept()) return;
  try {
    if (window.sessionStorage.getItem(KEPT_SIGN_IN)) return;
    window.sessionStorage.setItem(KEPT_SIGN_IN, "asked");
  } catch {
    return;
  }
  await keepSignInOnThisPhone();
}

/**
 * On the sign in screen inside the store app: if the phone holds a kept sign
 * in, trade it for a fresh session. Resolves to where to go, or null when
 * there is no token or the server refused it, in which case the token is
 * forgotten and the ordinary sign in screen is the answer.
 */
export async function resumeKeptSignIn(): Promise<string | null> {
  const token = await readKept();
  if (!token) return null;
  try {
    const res = await fetch("/api/portal/device-token/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; redirect?: string } | null;
    if (res.ok && body?.ok && typeof body.redirect === "string") return body.redirect;
    /* A 401 means the token is dead for good. A 429 or a 503 is a moment, so the token is kept for the next try. */
    if (res.status === 401) await forgetKept();
    return null;
  } catch {
    return null;
  }
}

/**
 * Sign out on this phone: the server stamps the token revoked, then the
 * keystore forgets it. Called before the portal's own sign out clears the
 * cookie. Resolves whether the server confirmed; the keystore is cleared either
 * way, so the phone cannot use it again even when the network is down.
 */
export async function endKeptSignIn(): Promise<boolean> {
  const token = await readKept();
  if (!token) return true;
  let confirmed = false;
  try {
    window.sessionStorage.removeItem(KEPT_SIGN_IN);
  } catch {
    /* No session storage: nothing was marked. */
  }
  /* Sign out never waits on a dead network for long, as forgetOfferAlerts does not. */
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), END_WAIT_MS);
  try {
    const res = await fetch("/api/portal/device-token/exchange", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: abort.signal,
    });
    confirmed = res.ok;
  } catch {
    confirmed = false;
  } finally {
    clearTimeout(timer);
  }
  /*
   * Forgotten either way. If the server never heard, the row stays live until
   * its thirty days end or the epoch moves, held by no phone: the residual risk
   * is only a copy taken before sign out, and "sign out everywhere" ends that.
   */
  await forgetKept();
  return confirmed;
}
