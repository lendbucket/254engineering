import { ReferralCapture } from "@/components/site/ReferralCapture";
import { AdClickCapture } from "@/components/site/AdClickCapture";
import { Analytics } from "@/components/site/Analytics";
import { GoogleAdsCallSwap } from "@/components/start/GoogleAdsCallSwap";
import { business } from "@/config/business";

/**
 * THE GOOGLE ADS LANDING PAGE'S OWN CHROME. Robert's add-on of 2026-11-15.
 *
 * Its own route group, like (order), because the approved design draws its own
 * header and footer and the page is kept out of the site's navigation. What it
 * keeps from (site): the skip link and the main landmark, the partner capture
 * (a partner's link can land here too), the ad click capture, and GA4.
 *
 * What it adds: the Google Ads tag that swaps the firm's line for the Google
 * forwarding number on this page only, so a call from an ad is counted (item
 * 13). It loads only when NEXT_PUBLIC_GOOGLE_ADS_ID is set, and every other page
 * keeps the firm's own number because none of them loads it.
 *
 * No entity schema: the page is noindex, and markup on a page no crawler may
 * index has no reader.
 */
export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:bg-slate focus:px-4 focus:py-2 focus:text-slate-fg"
      >
        Skip to content
      </a>
      {children}
      <ReferralCapture />
      <AdClickCapture />
      <Analytics host={new URL(business.url).host} />
      <GoogleAdsCallSwap />
    </div>
  );
}
