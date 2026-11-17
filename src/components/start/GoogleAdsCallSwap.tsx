import Script from "next/script";
import { displayPhone } from "@/config/contact";

/**
 * GOOGLE'S FORWARDING NUMBER ON /start, SO A CALL FROM AN AD IS COUNTED.
 * Robert's add-on of 2026-11-15, item 13, and his answer 2 of 13:11 Central.
 *
 * Google Ads' "calls from a website" conversion: the Google tag is configured
 * with the number exactly as the page prints it, and for a visitor who came
 * from an ad Google replaces that text with a forwarding number and counts a
 * call that lasts as long as the conversion action says (60 seconds, which is
 * set in the Google Ads account, not here). Every other visitor, and every
 * other page, keeps the firm's own line, because only this layout renders this.
 *
 * Renders nothing until both NEXT_PUBLIC_GOOGLE_ADS_ID (AW-...) and
 * NEXT_PUBLIC_GOOGLE_ADS_CALL_LABEL are set, so the page is correct before the
 * account exists. Loaded after idle, like GA4, so it is never on the path to
 * the first paint.
 */
export function GoogleAdsCallSwap() {
  const id = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CALL_LABEL;
  const phone = displayPhone();
  if (!id || !/^AW-\d+$/.test(id) || !label || !/^[A-Za-z0-9_-]+$/.test(label) || !phone) return null;
  const config = JSON.stringify({ phone_conversion_number: phone });
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="lazyOnload" />
      <Script id="google-ads-call-swap" strategy="lazyOnload">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
gtag('config', '${id}/${label}', ${config});`}
      </Script>
    </>
  );
}
