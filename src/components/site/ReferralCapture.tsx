"use client";

import { useEffect } from "react";

/**
 * A tracked partner link, captured once.
 *
 * WHY A CLIENT COMPONENT AND NOT THE SERVER
 * -----------------------------------------
 * The public pages are statically prerendered, which is deliberate and is what
 * makes them fast. Reading a query parameter on the server would make every
 * page dynamic to serve the small fraction of visits that carry a ref, and the
 * compliance gate depends on those pages being built rather than rendered.
 *
 * So the capture is one POST from the browser, fired after paint. It changes
 * nothing on the screen and blocks nothing: a visitor who followed a partner
 * link sees exactly the page they asked for, at the speed they would have seen
 * it anyway.
 *
 * WHY IT DOES NOT REPORT FAILURE
 * ------------------------------
 * There is nobody to report it to. The visitor did not ask for this and cannot
 * act on it. The endpoint answers 204 whatever happened, and the operator finds
 * out from the touch log, which is the only place the truth is useful.
 */
export function ReferralCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (!code) return;

    /*
     * Fired once per page load with a ref on it, and the endpoint reuses the
     * visitor cookie, so a second click from the same browser is a second touch
     * on the same visitor rather than a new visitor. That is what lets the most
     * recent touch rule mean anything.
     */
    void fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        landingPath: window.location.pathname,
        referrer: document.referrer || undefined,
      }),
      keepalive: true,
    }).catch(() => {
      /* Deliberately silent. See above. */
    });
  }, []);

  return null;
}
