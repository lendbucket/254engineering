import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { homeFor } from "@/lib/ops-authz";
import { opsSessionConfigured } from "@/lib/ops-session";
import { supabaseConfigured } from "@/lib/supabase";
import { SystemAlert } from "@/components/portal/design";
import { SignInFrame, SignInHeading } from "@/components/portal/SignInFrame";
import { LoginForm } from "./LoginForm";
import { PortalUnreachable } from "@/components/portal/Unreachable";
import { isDatabaseUnreachable } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * Staff sign in.
 *
 * THE 2026-11-08 REDESIGN, AND WHAT IT DID NOT TOUCH
 * --------------------------------------------------
 * Robert's order: one design for the three sign-in screens, a navy panel and
 * the form on white, "a visual change only". Every behaviour is untouched: the
 * redirect for an already signed in actor, the unreachable database screen, the
 * suspended and reset notices, and the configuration check that says so rather
 * than rejecting a correct password in silence. The noindex is the layout's
 * metadata and is unchanged.
 *
 * What left the page on the same order: the registration line (still stated in
 * the public footer, every email and the portal rail, each asserted by
 * compliance-audit), "This area is not public and is not indexed", the
 * administrator sentence under the button, and (answer 3) the gate's
 * restricted-mode notice. "Forgot your password?" opens /portal/forgot-password
 * (answer 1).
 *
 * THE LINE THAT IS NOT HERE, AND WHY
 * ----------------------------------
 * The 2026-09 prototype's sign in screen read "Multi-factor authentication is
 * required for all staff accounts." It is not rendered: a second factor is
 * optional by role (0025), so the sentence would be a security claim the
 * account in front of the reader may not have.
 */
export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; suspended?: string; reset?: string }>;
}) {
  const params = await searchParams;

  // Already signed in: go where this role belongs rather than showing a form
  // that will immediately bounce.
  //
  // A signed in person whose session could not be read is told so, and is not
  // shown the sign in form, which would read as having been signed out.
  // Operator ruling, 2026-10-12.
  let actor: Awaited<ReturnType<typeof currentActor>>;
  try {
    actor = await currentActor();
  } catch (error) {
    if (isDatabaseUnreachable(error)) return <PortalUnreachable />;
    throw error;
  }
  if (actor && actor.status === "active") redirect(homeFor(actor.role));

  /*
   * An unconfigured portal says so. The alternative is rejecting a correct
   * password with no explanation, which sends the operator hunting for a typo
   * in their own credentials.
   */
  const ready = opsSessionConfigured() && supabaseConfigured();

  return (
    /*
      NO RESTRICTED-MODE NOTICE ON A SIGN-IN PAGE. Robert's answer 3 of
      2026-11-08 (issue #1, 6724956292): the firm can do everything it lists.
      It leaves the three sign-in pages only and changes nothing in the gate.
    */
    <SignInFrame purpose="The firm's work, from intake to the sealed letter.">
      <SignInHeading />

      {params.suspended || params.reset || !ready ? (
        <div className="mt-5 flex flex-col gap-3">
          {params.suspended ? (
            <SystemAlert condition="Account suspended." tone="failed">
              An administrator can restore it. Signing in is refused until they do.
            </SystemAlert>
          ) : null}

          {params.reset ? (
            <p className="text-[15px] leading-[1.55] text-[var(--ink)]">
              Your password is set. Sign in with it.
            </p>
          ) : null}

          {ready ? null : (
            <SystemAlert condition="Not configured." tone="failed">
              The portal is not configured on this deployment, so nobody can sign in. What is
              missing is in the server logs rather than on this page.
            </SystemAlert>
          )}
        </div>
      ) : null}

      <LoginForm next={params.next ?? null} disabled={!ready} forgotHref="/portal/forgot-password" />
    </SignInFrame>
  );
}
