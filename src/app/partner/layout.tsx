import type { Metadata } from "next";

export const metadata: Metadata = {
  /*
   * A title, because the tab said "Texas Engineering Services Statewide" until
   * this line existed: the site default, inherited by a signed in surface that
   * has nothing to do with it. A partner with three tabs open should be able to
   * tell which one is theirs.
   */
  title: "Referral partners | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The partner surface.
 *
 * Its own segment, sharing no layout with the marketing site, the portal or the
 * customer account. The portal layout calls currentActor() and renders staff
 * navigation; a partner page that inherited it would be one rendering bug away
 * from showing a referrer the review queue.
 *
 * Never indexed. A partner surface in a search result is a login page inviting
 * credential stuffing, and there is nothing here for a crawler.
 */
export default function PartnerRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
