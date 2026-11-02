"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  analyticsAllowedOn,
  cleanedLocation,
  gaMeasurementId,
  sendsFrom,
  type GaEvent,
} from "@/lib/analytics";

/**
 * GOOGLE ANALYTICS 4, AFTER THE PAGE IS IDLE. Robert's ruling, 2026-11-01. The
 * rules it follows are written once, in src/lib/analytics.ts.
 *
 * `lazyOnload` loads gtag.js during browser idle time after the page's load
 * event, so it is never on the path to the largest paint and never competes
 * with the masthead photograph. The commands queue in dataLayer before it
 * arrives, which is how the standard snippet works, and gtag.js reads the queue
 * when it runs.
 *
 * The page view is sent by this code rather than by gtag's automatic one, so
 * the address can be cleaned first; config carries send_page_view false.
 *
 * `host` is the canonical production host, read off business.url by the server
 * component that renders this, so the business config stays out of the bundle.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let lastLocation: string | null = null;

/** Defines the queue and configures once. False when this page must not send. */
function ready(host: string): boolean {
  const id = gaMeasurementId();
  if (!id) return false;
  if (!analyticsAllowedOn(window.location.pathname, window.location.search)) return false;
  if (!sendsFrom(window.location.host, host)) return false;
  if (!window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag.js reads Arguments objects off the queue, not arrays.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }
  return true;
}

function currentLocation(): string {
  return cleanedLocation(window.location.origin, window.location.pathname, window.location.search);
}

function referrer(): string | undefined {
  if (lastLocation) return lastLocation;
  const ref = document.referrer;
  if (!ref) return undefined;
  const url = new URL(ref);
  return url.origin === window.location.origin ? cleanedLocation(url.origin, url.pathname, url.search) : url.origin;
}

export function Analytics({ host }: { host: string }) {
  const id = gaMeasurementId();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(analyticsAllowedOn(window.location.pathname, window.location.search));
    if (!ready(host)) return;
    const location = currentLocation();
    window.gtag!("event", "page_view", {
      page_location: location,
      page_referrer: referrer(),
      page_title: document.title,
    });
    lastLocation = location;
  }, [pathname, host]);

  if (!id || !allowed) return null;
  return <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="lazyOnload" />;
}

/** Sends one event when the page it sits on has rendered. No price, name, email or address. */
export function TrackOnMount({ event, host, params }: { event: GaEvent; host: string; params?: Record<string, string> }) {
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    if (!ready(host)) return;
    window.gtag!("event", event, { ...(JSON.parse(key) as Record<string, string>), page_location: currentLocation() });
  }, [event, host, key]);
  return null;
}
