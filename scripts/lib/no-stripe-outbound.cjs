/**
 * Preloaded into a proof's server process with NODE_OPTIONS=--require, so a
 * proof that drives the real webhook route with a throwaway key makes no call
 * to Stripe at all. The route's account consistency check fetches the event's
 * own object on its first webhook; here that connection is refused before it
 * leaves the machine, which the check already answers as "could not tell".
 *
 * Every refusal is written to the server's log with a fixed prefix, so the
 * proof can count them rather than assume.
 */
const https = require("node:https");

const BLOCKED = /(^|\.)stripe\.com$/i;
const PREFIX = "[no-stripe-outbound] refused";

function hostOf(args) {
  const first = args[0];
  if (typeof first === "string") return new URL(first).hostname;
  if (first instanceof URL) return first.hostname;
  return (first && (first.hostname || first.host)) || "";
}

for (const name of ["request", "get"]) {
  const original = https[name];
  https[name] = function patched(...args) {
    const host = String(hostOf(args)).split(":")[0];
    if (BLOCKED.test(host)) {
      console.error(`${PREFIX} https ${name} to ${host}`);
      const req = original.call(https, { host: "127.0.0.1", port: 9, method: "GET", path: "/" });
      return req;
    }
    return original.apply(https, args);
  };
}

const originalFetch = globalThis.fetch;
if (originalFetch) {
  globalThis.fetch = function patchedFetch(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (BLOCKED.test(new URL(url).hostname)) {
      console.error(`${PREFIX} fetch to ${new URL(url).hostname}`);
      return Promise.reject(new TypeError("fetch failed: refused by the proof's no-stripe-outbound preload"));
    }
    return originalFetch.call(this, input, init);
  };
}
