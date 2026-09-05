import type { MetadataRoute } from "next";
import { business } from "@/config/business";

/**
 * robots.txt.
 *
 * WHY THE AI CRAWLERS ARE NAMED EXPLICITLY
 * ----------------------------------------
 * A wildcard Allow already permits them, so naming GPTBot, ClaudeBot,
 * PerplexityBot, and Google-Extended changes nothing mechanically. It is a
 * statement of intent that survives a future edit: the day somebody adds a
 * blanket disallow for an unrelated reason, these lines are what makes the
 * decision about AI crawling explicit rather than collateral.
 *
 * This firm wants to be in those systems. An institutional site whose whole
 * purpose is to be the authoritative record of an entity is exactly the kind of
 * page an assistant should be able to read when somebody asks who a firm is.
 *
 * /api is disallowed because those routes accept POSTs and return nothing worth
 * indexing. /waitlist is disallowed because it is a temporary surface that
 * becomes a redirect the day the firm opens, and its metadata already carries
 * noindex; the two agree on purpose.
 */
export default function robots(): MetadataRoute.Robots {
  /*
   * /onboarding, /admin, and /portal are disallowed because none is public. None
   * is PROTECTED by this line: an onboarding link needs a valid 43 character
   * token and the admin needs a session. The disallow exists so a crawler does
   * not waste requests on routes that answer 404 and redirect.
   *
   * /waitlist USED TO BE ON THIS LIST AND ITS REMOVAL IS THE POINT
   * -------------------------------------------------------------
   * Sitemap audit, 2026-09-04. Disallow and noindex do not stack; they cancel.
   * A crawler obeying a disallow never fetches the page, so it never sees the
   * noindex it is being asked to obey. The URL can still be indexed from links
   * pointing at it, as a bare URL with no snippet, which is the worst of both:
   * present in results, and unable to say it does not want to be.
   *
   * /waitlist is linked twice from the homepage, so it is discoverable. It is
   * removed from this list SO THAT the noindex can be read and honoured, which
   * is the only mechanism that actually keeps a linked page out of the index.
   *
   * WHY /onboarding KEEPS ITS DISALLOW, AND THIS IS NOT AN OVERSIGHT
   * ----------------------------------------------------------------
   * It is the identical pattern and it is harmless there, for one reason:
   * /onboarding/[token] needs a valid 43 character token and is linked from
   * nowhere. No crawler can discover the URL, so there is nothing for a bare
   * URL listing to be made of, and the disallow costs nothing while saving the
   * crawl budget it was added for.
   *
   * The difference is DISCOVERABILITY, not the directive. Do not "fix" the
   * onboarding line to match this one: removing that disallow would invite
   * crawlers to spend requests on a route that answers 404 without a token, and
   * would gain nothing, because nothing links to it.
   */
  const allowAll = { allow: "/", disallow: ["/api/", "/onboarding", "/admin", "/portal"] };

  return {
    rules: [
      { userAgent: "*", ...allowAll },
      { userAgent: "Googlebot", ...allowAll },
      { userAgent: "Bingbot", ...allowAll },
      { userAgent: "Google-Extended", ...allowAll },
      { userAgent: "GPTBot", ...allowAll },
      { userAgent: "OAI-SearchBot", ...allowAll },
      { userAgent: "ChatGPT-User", ...allowAll },
      { userAgent: "ClaudeBot", ...allowAll },
      { userAgent: "Claude-Web", ...allowAll },
      { userAgent: "anthropic-ai", ...allowAll },
      { userAgent: "PerplexityBot", ...allowAll },
      { userAgent: "Applebot", ...allowAll },
      { userAgent: "Applebot-Extended", ...allowAll },
      { userAgent: "CCBot", ...allowAll },
    ],
    sitemap: `${business.url}/sitemap.xml`,
    host: business.url,
  };
}
