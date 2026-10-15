"use client";

import { PortalUnreachable } from "@/components/portal/Unreachable";
import { UNREACHABLE_DIGEST } from "@/lib/outcome-copy";

/**
 * The portal's error boundary, and it answers exactly one error.
 *
 * A failed session read throws DatabaseUnreachable, carrying its own digest so
 * this boundary can recognise it in a production build, where every other
 * property of a server error is hidden. The layout catches the same read first;
 * this is for the page beneath it, which Next renders whether or not the layout
 * shows it. Any other error is thrown on, to whatever handled it before this
 * file existed, so nothing else changes how it fails.
 */
export default function PortalError({ error }: { error: Error & { digest?: string } }) {
  if (error.digest !== UNREACHABLE_DIGEST) throw error;
  return <PortalUnreachable />;
}
