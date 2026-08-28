import type { Metadata } from "next";

/**
 * The admin section is never indexed and never previewed.
 *
 * robots.ts already disallows /admin, and the middleware already keeps a signed
 * out visitor from reaching anything here. This is the third layer, and it is
 * the only one that survives a crawler that ignores robots.txt: `noindex,
 * nofollow` in the page itself, which the major engines honour even when they
 * have fetched a page they were asked not to.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
