import { business } from "@/config/business";

/**
 * The origin a customer should be sent back to.
 *
 * WHY THIS IS NOT JUST business.url
 * ---------------------------------
 * It was, and the first real Stripe payment showed why that is wrong: a test
 * order paid on a preview redirected the customer to
 * 254engineering.com/order/..., which is production, does not have that order,
 * and answered 404.
 *
 * Harmless in a test and wrong in principle. A deployment that sends people
 * somewhere other than itself cannot be exercised end to end, and the version of
 * this mistake that matters is a preview handing a real customer a link into
 * production, or production handing one into a preview.
 *
 * PRODUCTION USES THE CANONICAL DOMAIN, NOT ITS OWN HOSTNAME
 * ----------------------------------------------------------
 * A production deployment also answers on its .vercel.app address, and a
 * customer who followed a Stripe receipt to that address would see the site at
 * a hostname the firm does not publish and search engines are told to ignore.
 * So production is pinned to business.url and everything else follows itself.
 *
 * The branch alias is preferred over VERCEL_URL because it is stable across
 * deployments of the same branch, which is what a Stripe endpoint and a
 * bookmarked link both want.
 */
export type OriginEnv = {
  VERCEL_ENV?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_URL?: string;
};

export function deploymentOrigin(env: OriginEnv = process.env as OriginEnv): string {
  if (env.VERCEL_ENV === "production") return business.url;
  if (env.VERCEL_BRANCH_URL) return `https://${env.VERCEL_BRANCH_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  /*
   * A local machine, where neither is set. business.url rather than a guessed
   * localhost port: sending somebody to a port that is not listening is worse
   * than sending them to the real site.
   */
  return business.url;
}
