"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * NEW ORDERS AND INQUIRIES WITHOUT A REFRESH. Office ready, 2026-10-20.
 *
 * Asks the desk counts every 30 seconds. The tab title carries the number of
 * inquiries waiting plus the orders placed since this tab opened, so a rep
 * with the portal in a background tab sees work arrive. When either number
 * moves, the screen re-renders from the server, which is how a new row
 * appears on the inbox or the order lookup without anybody reloading.
 *
 * A count the server could not read comes back null and is left out of the
 * title rather than shown as zero. A failed request changes nothing.
 */
const EVERY_MS = 30_000;

export function LiveCounts() {
  const router = useRouter();
  const baselineOrders = useRef<number | null>(null);
  const last = useRef<string | null>(null);
  const originalTitle = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    originalTitle.current = document.title.replace(/^\([0-9]+\) /, "");

    async function tick() {
      try {
        const res = await fetch("/api/portal/desk", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { inquiries: number | null; ordersLastDay: number | null };
        if (stopped) return;
        if (baselineOrders.current === null && body.ordersLastDay !== null) baselineOrders.current = body.ordersLastDay;
        const newOrders = body.ordersLastDay !== null && baselineOrders.current !== null ? Math.max(0, body.ordersLastDay - baselineOrders.current) : 0;
        const waiting = (body.inquiries ?? 0) + newOrders;
        const base = (originalTitle.current ?? document.title).replace(/^\([0-9]+\) /, "");
        document.title = waiting > 0 ? `(${waiting}) ${base}` : base;
        const key = `${body.inquiries}:${body.ordersLastDay}`;
        if (last.current !== null && last.current !== key) router.refresh();
        last.current = key;
      } catch {
        /* Offline for a moment. The next tick asks again. */
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      if (originalTitle.current) document.title = originalTitle.current;
    };
  }, [router]);

  return null;
}
