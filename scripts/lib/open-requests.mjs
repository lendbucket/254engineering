/**
 * ===========================================================================
 * WHICH REQUESTS ARE STILL OPEN WHEN A PAGE DOES NOT GO QUIET.
 * ===========================================================================
 *
 * Robert's answer 14 of 2026-10-26, 09:12 Central. dashboard-speed-audit twice
 * reported "5 of 5 loads never went quiet" (boards 40169333114 and
 * 40320368396) and said nothing about what kept the network busy, so neither
 * instance could be diagnosed. This follows a Playwright page's requests from
 * start to finish or failure and lists what is still open: the method, the URL,
 * and how long it has been open. A third instance names its request.
 *
 * It reads only the page's own events, so it is a pure observer: attaching it
 * changes nothing the page does.
 */

/**
 * @param {{ on: (event: string, fn: (r: any) => void) => void }} page a Playwright page, or anything with the same events
 * @param {{ now?: () => number }} [clock]
 * @returns {{ openNow: () => { method: string, url: string, openMs: number }[], describe: () => string }}
 */
export function trackOpenRequests(page, clock = {}) {
  const now = clock.now ?? (() => Date.now());
  const open = new Map();
  page.on("request", (r) => open.set(r, now()));
  page.on("requestfinished", (r) => open.delete(r));
  page.on("requestfailed", (r) => open.delete(r));
  const openNow = () =>
    [...open.entries()]
      .map(([r, since]) => ({ method: String(r.method()), url: String(r.url()), openMs: Math.max(0, now() - since) }))
      .sort((a, b) => b.openMs - a.openMs);
  return {
    openNow,
    describe: () => {
      const list = openNow();
      if (list.length === 0) return "no request was still open, so something other than the network kept it from going quiet";
      return list.map((o) => `${o.method} ${o.url} open ${o.openMs} ms`).join("; ");
    },
  };
}
