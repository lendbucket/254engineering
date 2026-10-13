"use client";

/* Primitives directly, not the design index: the index carries server modules a client bundle must not. */
import { PrimaryButton } from "@/components/portal/design/Primitives";
import { PORTAL_UNREACHABLE } from "@/lib/outcome-copy";

/**
 * Reload the screen the person asked for, address and query included. A reload
 * rather than a link, because the layout that renders the page below cannot
 * know which screen it is standing in for: Next gives a layout no path.
 */
export function RetryButton() {
  return (
    <PrimaryButton type="button" onClick={() => window.location.reload()}>
      Try again
    </PrimaryButton>
  );
}

/**
 * THE PORTAL COULD NOT REACH THE DATABASE, AND THE PERSON IS STILL SIGNED IN.
 * Operator ruling, 2026-10-12, his wording.
 *
 * Shown where the session read failed or stalled. It is not the login screen
 * and it touches no cookie: a person who was signed in a moment ago still is,
 * and sending them to sign in again would tell them something false about
 * their account to cover for the database. A missing session still goes to the
 * login screen, as it always has.
 */
export function PortalUnreachable() {
  return (
    <div className="portal-surface flex min-h-[60vh] items-center justify-center px-[var(--page-gutter)] py-10">
      <div
        role="alert"
        data-portal-unreachable
        className="w-full max-w-[520px] rounded-[var(--radius-card)] border border-[var(--border)] bg-white px-6 py-8 text-center sm:px-8"
      >
        <p className="mx-auto max-w-[46ch] text-[15px] leading-[1.6] font-semibold text-[var(--navy)]">
          {PORTAL_UNREACHABLE}
        </p>
        <div className="mt-6 flex justify-center">
          <RetryButton />
        </div>
      </div>
    </div>
  );
}
