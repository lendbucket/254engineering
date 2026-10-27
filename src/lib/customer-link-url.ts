import { business } from "@/config/business";

/**
 * The customer's way back in, built in one place.
 *
 * Every email that carries this link and the page that answers it agree by
 * construction rather than by two string templates that happen to match today.
 * The reference is in the path because it is what a customer quotes on the
 * phone and what makes the entry recognisable in their history; the token is
 * the query, and the reference alone opens nothing.
 *
 * Its own module since addendum item 4, so the outstanding information email
 * can build it without importing the whole customer view.
 */
export function customerStatusUrl(reference: string, token: string): string {
  return `${business.url}/order/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`;
}
