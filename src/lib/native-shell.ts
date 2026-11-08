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
