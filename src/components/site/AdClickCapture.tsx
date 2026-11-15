"use client";

import { useEffect } from "react";
import { AD_CLICK_COOKIE, AD_CLICK_MAX_AGE_SECONDS, adClickFromParams, encodeAdClick } from "@/lib/ad-click";

/**
 * Writes the ad click cookie on the page an ad opened (Robert's item 9, the
 * rules in src/lib/ad-click.ts). It renders nothing and runs once per page
 * load: a URL carrying gclid, gbraid, wbraid or a utm value replaces the
 * cookie, one carrying none leaves it alone.
 *
 * First party, Lax, Secure on https, ninety days. It is read by the server when
 * a lead or an order is written, never sent anywhere from here.
 */
export function AdClickCapture() {
  useEffect(() => {
    try {
      const click = adClickFromParams(new URLSearchParams(window.location.search), new Date(), window.location.pathname);
      if (!click) return;
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${AD_CLICK_COOKIE}=${encodeAdClick(click)}; Max-Age=${AD_CLICK_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    } catch {
      /* A browser that refuses cookies records no click, which is the truth about that visit. */
    }
  }, []);
  return null;
}
