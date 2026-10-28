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
