/**
 * THE FIELD APP'S SERVICE WORKER. Mobile phase 1 (ruling 13 of 2026-10-27):
 * a service worker for the technician screens only, and no offline writes yet.
 *
 * WHAT IT DOES, ALL OF IT. It caches the build's own static files, the ones
 * under /_next/static whose names carry a content hash, so a technician on a
 * weak signal is not waiting for the same script twice. Everything else goes to
 * the network exactly as it would without a worker: every page, every API call,
 * and every request that is not a GET. A job, a photograph or a customer's
 * address is never written to the cache, because a phone left in a truck is not
 * a place this firm keeps records, and a page served from a cache would show a
 * job as it was rather than as it is.
 *
 * AND OFFER ALERTS (Robert's T9, 2026-11-07). It shows a push as a notification
 * and opens My jobs when it is tapped. The push carries nothing; the wording is
 * fetched from the firm's server when one arrives (src/lib/ops-push.ts,
 * latestOfferPushFor), and is never written to any cache.
 *
 * WHERE IT RUNS. It is registered from the technician's jobs screens with the
 * scope /portal/jobs (src/components/portal/FieldAppWorker.tsx), so no other
 * portal screen, and no page of the public site, is ever controlled by it. The
 * Service-Worker-Allowed header below is what lets a script served from the
 * site root take that scope, and it names that one path and nothing wider.
 *
 * WHY IT IS SERVED HERE AND NOT UNDER /portal: a browser fetches a worker script
 * without the session cookie, and the portal gate would answer it with a
 * redirect, which a browser refuses to install. It carries no data.
 *
 * Changing the cache's name throws the old one away on the next activation.
 */
import { OFFER_PUSH_FALLBACK } from "@/lib/offer-push-rules";

const SCOPE = "/portal/jobs";
const CACHE = "field-static-v1";

const WORKER = `
const CACHE = ${JSON.stringify(CACHE)};

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/_next/static/")) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
      }),
    ),
  );
});

/*
 * OFFER ALERTS (Robert's T9 and his answers 6 and 7 of 2026-11-07). A push
 * arrives with no payload. The worker asks the firm's server, over the
 * technician's own session, what the lock screen may say: county and service,
 * never an address or a price. If the server cannot be reached, it says only
 * that a job is offered. A tap opens My jobs.
 */
self.addEventListener("push", (event) => {
  const fallback = ${JSON.stringify(OFFER_PUSH_FALLBACK)};
  event.waitUntil(
    fetch("/api/portal/field", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "push_latest" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        const text = data && data.ok && typeof data.title === "string" && typeof data.body === "string" ? data : fallback;
        return self.registration.showNotification(text.title, { body: text.body, tag: "offer", data: { url: ${JSON.stringify(SCOPE)} } });
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(${JSON.stringify(SCOPE)}));
});
`;

export const dynamic = "force-static";

export function GET() {
  return new Response(WORKER, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": SCOPE,
    },
  });
}
