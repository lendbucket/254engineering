import "server-only";
import { cookies } from "next/headers";
import { AD_CLICK_COOKIE, decodeAdClick, type AdClick } from "@/lib/ad-click";

/**
 * The ad click this request's visitor landed with, read from the first party
 * cookie on the server (ad-click.ts says why never from a request body), or
 * null. A cookie that fails validation reads as no click, which is the truth
 * about it.
 */
export async function adClickOfRequest(): Promise<AdClick | null> {
  try {
    return decodeAdClick((await cookies()).get(AD_CLICK_COOKIE)?.value);
  } catch {
    return null;
  }
}
