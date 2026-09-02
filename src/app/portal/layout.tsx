import type { Metadata } from "next";

/**
 * Everything under /portal, signed in or not.
 *
 * This layout carries exactly one thing: the instruction not to index any of it.
 * The guard lives one level down in (app)/layout.tsx, because the sign in and
 * set password screens are also /portal routes and a guard here would redirect
 * the login page to the login page.
 *
 * Splitting the group is what makes that impossible rather than a bug somebody
 * fixes twice.
 */
export const metadata: Metadata = {
  title: "Portal | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
