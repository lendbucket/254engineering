/**
 * THE FIELD APP'S SERVICE WORKER. Mobile phase 1 (ruling 13 of 2026-10-27),
 * and offline start (Robert's T2 and his answer 1 of 2026-11-07, 6717223376).
 *
 * WHAT IT DOES, ALL OF IT.
 *
 *   1. It caches the build's own static files, the ones under /_next/static
 *      whose names carry a content hash, so a technician on a weak signal is not
 *      waiting for the same script twice.
 *   2. It keeps one page: the offline screen, /portal/jobs/offline, fetched
 *      while there is signal (src/components/portal/DayPackSync.tsx). That page
 *      is rendered from nothing in the database, so the copy holds no job, no
 *      address and no photograph; it reads the day from the phone's IndexedDB
 *      when it opens (src/lib/field-day-store.ts).
 *   3. When a jobs screen cannot be reached at all, because the network failed
 *      rather than because the server answered, it shows that kept copy in its
 *      place.
 *
 * Everything else goes to the network exactly as it would without a worker:
 * every other page, every API call, and every request that is not a GET. The
 * day's jobs themselves are never in this worker's caches. Since answer 1 they
 * are on the phone, in IndexedDB, for 48 hours at most, cleared at sign out and
 * at reassignment or submission, which is a ruling about the phone and is kept
 * where the ruling says.
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
 * Changing a cache's name throws the old one away on the next activation. The
 * shell cache's name is also cleared at sign out, from FIELD_SHELL_CACHE in
 * src/lib/field-day-store.ts, which must stay equal to SHELL below.
 */
const SCOPE = "/portal/jobs";
const CACHE = "field-static-v1";
const SHELL = "field-shell-v1";
const OFFLINE = "/portal/jobs/offline";

const WORKER = `
const CACHE = ${JSON.stringify(CACHE)};
const SHELL = ${JSON.stringify(SHELL)};
const OFFLINE = ${JSON.stringify(OFFLINE)};

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE && n !== SHELL).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
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
    return;
  }

  if (url.pathname === OFFLINE) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(OFFLINE, copy));
          }
          return response;
        })
        .catch(() => caches.open(SHELL).then((cache) => cache.match(OFFLINE)).then((hit) => hit || Response.error())),
    );
    return;
  }

  if (request.mode === "navigate" && url.pathname.startsWith(${JSON.stringify(SCOPE)})) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(SHELL).then((cache) => cache.match(OFFLINE)).then((hit) => hit || Response.error()),
      ),
    );
  }
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
