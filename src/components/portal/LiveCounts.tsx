"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * NEW ORDERS AND INQUIRIES WITHOUT A REFRESH. Office ready, 2026-10-20.
 *
 * Asks the desk counts every 30 seconds. The tab title carries the number of
 * inquiries waiting plus the orders placed since this tab opened, so a rep
 * with the portal in a background tab sees work arrive. When anything has
 * arrived that the screen is not showing, the screen re-renders from the
 * server, which is how a new row appears on the inbox or the order lookup
 * without anybody reloading.
 *
 * THE FIRST ASK IS 30 SECONDS IN, NOT ON LOAD. dashboard-speed-audit holds
 * that opening the administrator's dashboard calls no API route, because the
 * last thing that did hung the page and wrote false audit rows. So the server
 * stamps when the shell was rendered, and every ask is "what arrived after
 * that": a row that came in during the first 30 seconds is still counted and
 * still refreshes the screen, on the first ask rather than never.
 *
 * A count the server could not read comes back null and is left out of the
 * title rather than shown as zero. A failed request changes nothing.
 */
const EVERY_MS = 30_000;

export function LiveCounts({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  /* What the rendered screen already accounts for: nothing that arrived after it. */
  const last = useRef("0:0");
  const originalTitle = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    originalTitle.current = document.title.replace(/^\([0-9]+\) /, "");

    async function tick() {
      try {
        const res = await fetch(`/api/portal/desk?since=${renderedAt}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          inquiries: number | null;
          inquiriesSince: number | null;
          ordersSince: number | null;
        };
        if (stopped) return;
        const waiting = (body.inquiries ?? 0) + (body.ordersSince ?? 0);
        const base = (originalTitle.current ?? document.title).replace(/^\([0-9]+\) /, "");
        document.title = waiting > 0 ? `(${waiting}) ${base}` : base;
        /* A count this role does not see, or that failed to read, holds its last value rather than moving. */
        const [seenInquiries, seenOrders] = last.current.split(":");
        const key = `${body.inquiriesSince ?? seenInquiries}:${body.ordersSince ?? seenOrders}`;
        if (last.current !== key) router.refresh();
        last.current = key;
      } catch {
        /* Offline for a moment. The next tick asks again. */
      }
    }

    const timer = window.setInterval(() => void tick(), EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      if (originalTitle.current) document.title = originalTitle.current;
    };
  }, [router, renderedAt]);

  return null;
}
