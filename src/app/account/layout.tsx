import type { Metadata } from "next";

export const metadata: Metadata = {
  /* Its own description rather than the home page's (site audit issue 12, 2026-11-02). */
  description: "Sign in to a 254 Engineering customer account to see orders, statements and settings.",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The customer account surface.
 *
 * Its own segment, sharing no layout with either the marketing site or the
 * portal. That is not styling preference: the portal layout calls currentActor()
 * and renders staff navigation, and a customer page that inherited it would be
 * one rendering bug away from showing a buyer the review queue.
 *
 * Never indexed. An account surface in a search result is a login page inviting
 * credential stuffing, and there is nothing here for a crawler.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[var(--canvas)]">{children}</div>;
}
