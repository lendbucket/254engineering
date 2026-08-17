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
  const allowAll = { allow: "/", disallow: ["/api/", "/waitlist"] };

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
