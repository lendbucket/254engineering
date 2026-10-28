"use client";

import { useEffect } from "react";

/**
 * Registers the field app's service worker (src/app/field-sw.js/route.ts) for
 * the technician's jobs screens and nowhere else. Mounted by the jobs layout
 * only, with the scope /portal/jobs, so no other portal screen is controlled by
 * it. Renders nothing. A browser without service workers, or one that refuses
 * the registration, carries on exactly as before: the worker only caches the
 * build's static files, so nothing a technician does depends on it.
 */
export function FieldAppWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/field-sw.js", { scope: "/portal/jobs" }).catch((error) => {
      console.warn(`[field-app] the service worker was not registered: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, []);
  return null;
}
