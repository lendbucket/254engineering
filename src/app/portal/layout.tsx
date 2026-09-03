import type { Metadata } from "next";
import { previewPointingAtProduction } from "@/lib/db-guard";
import { MispointedPreview } from "@/components/portal/MispointedPreview";

/**
 * Everything under /portal, signed in or not.
 *
 * TWO THINGS LIVE HERE, AND THEY ARE DIFFERENT KINDS OF THING
 * -----------------------------------------------------------
 * The instruction not to index any of it, and the mispointed preview screen.
 *
 * The AUTHENTICATION guard lives one level down in (app)/layout.tsx, because the
 * sign in and set password screens are also /portal routes and an auth guard
 * here would redirect the login page to the login page. Splitting the group is
 * what makes that impossible rather than a bug somebody fixes twice.
 *
 * The mispointed preview check is the opposite case and belongs here, above the
 * split. It was put in (app) first and that was wrong: an unauthenticated
 * visitor to a preview wired to production got the ordinary login page, typed a
 * password, and received a 500 from the throw in supabase.ts. Protected, and
 * completely illegible, which is the exact stack trace problem the screen exists
 * to replace.
 *
 * Found by pointing a real server at production and looking at what a person
 * would see, rather than by trusting that the unit test covering the predicate
 * covered the experience.
 */
export const metadata: Metadata = {
  title: "Portal | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  if (previewPointingAtProduction()) return <MispointedPreview />;
  return children;
}
