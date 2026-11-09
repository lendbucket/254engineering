"use client";

import { useEffect } from "react";
import { forgetFieldDay, storeDayPack } from "@/lib/field-day-store";
import type { DayPack } from "@/lib/field-day-rules";

/**
 * KEEPS THE DAY ON THE PHONE WHILE THERE IS SIGNAL. Robert's T2, 2026-11-07.
 *
 * Mounted on the technician's jobs screens. With signal, it asks the server for
 * the day pack (the `day_pack` action, src/lib/ops-field.ts dayPackFor) and
 * stores it whole, so a job reassigned or submitted since the last pack is gone
 * from the phone on the next one. It then loads the offline screen once, through
 * the service worker, so the worker holds a copy to show when there is no
 * signal, along with the scripts that screen needs.
 *
 * A session that has ended answers 401, and the day is forgotten: the phone of
 * somebody signed out by expiry or suspension keeps nothing.
 *
 * Renders nothing. Every failure is quiet, because the screen the technician is
 * on works without it; what does not work without it is opening a job later
 * with no signal, which the offline screen itself says plainly.
 */
const OFFLINE_SHELL = "/portal/jobs/offline";

export function DayPackSync() {
  useEffect(() => {
    if (!navigator.onLine) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/portal/field", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "day_pack" }),
        });
        if (res.status === 401) {
          await forgetFieldDay();
          return;
        }
        const body = (await res.json().catch(() => null)) as { ok?: boolean; pack?: DayPack } | null;
        if (cancelled || !res.ok || !body?.ok || !body.pack) return;
        await storeDayPack(body.pack);

        /*
         * Warm the offline screen through the worker, and the build files it
         * names, so all of them are in the worker's caches before the signal
         * goes. The worker decides what it keeps (src/app/field-sw.js/route.ts).
         */
        const shell = await fetch(OFFLINE_SHELL, { credentials: "same-origin" });
        if (!shell.ok || cancelled) return;
        const html = await shell.text();
        const assets = Array.from(new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? []));
        await Promise.all(assets.map((a) => fetch(a).catch(() => null)));
      } catch {
        /* No signal after all, or a refusal: the stored pack, if any, stands until it lapses. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
