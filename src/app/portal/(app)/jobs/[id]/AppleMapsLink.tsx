"use client";

import { useEffect, useState } from "react";

/**
 * APPLE MAPS, ON AN IPHONE OR IPAD ONLY. Robert's answer 5 of 2026-11-07
 * (6717223376): keep the external map and add Apple Maps on an iPhone.
 *
 * Drawn after the page has loaded, from the browser's own description of the
 * device, so nothing is rendered on the server for a device it cannot see. On
 * anything else this draws nothing and the Directions button stands alone.
 * The query is the one Directions already uses, encoded on the server.
 */
export function AppleMapsLink({ query }: { query: string }) {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    /* iPadOS reports itself as a Mac, so a Mac with a touch screen is read as an iPad. */
    setApple(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
  }, []);
  if (!apple) return null;
  return (
    <a
      href={`https://maps.apple.com/?q=${query}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[48px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-4 text-[15px] font-semibold text-[var(--ink)]"
    >
      Apple Maps
    </a>
  );
}
