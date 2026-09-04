import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentActor } from "@/lib/ops-auth";
import { homeFor } from "@/lib/ops-authz";
import { opsSessionConfigured } from "@/lib/ops-session";
import { supabaseConfigured } from "@/lib/supabase";
import { RestrictedMode, SystemAlert } from "@/components/portal/design";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * Sign in, ported to the design system.
 *
 * WHAT CHANGED, AND WHAT DELIBERATELY DID NOT
 * -------------------------------------------
 * Presentation only. Every behaviour is untouched: the redirect for an already
 * signed in actor, the suspended and reset notices, and the configuration check
 * that says so rather than rejecting a correct password in silence.
 *
 * The navy gradient is gone. The standards file says never gradients, and the
 * prototype puts this screen on the light canvas with the logo above a white
 * card. token-audit fails the build on a gradient in a ported file.
 *
 * THE LINE THAT IS NOT HERE, AND WHY
 * ----------------------------------
 * The prototype's sign in screen reads "Multi-factor authentication is required
 * for all staff accounts."
 *
 * There is no MFA in this platform. Not partially, not behind a flag: the
 * string does not appear anywhere in the codebase, and the standards file's own
 * build roadmap lists "MFA enforcement" as work still to do with this screen as
 * its hook. So the sentence is a security claim about protection an account
 * does not have, told to the person signing in to that account, and it is the
 * same class of fabrication as the evidence hash the operator ruled out at gate
 * 0. It is dropped rather than rendered.
 *
 * If MFA is built, this is where the sentence goes back.
 */
export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; suspended?: string; reset?: string }>;
}) {
  const params = await searchParams;

  // Already signed in: go where this role belongs rather than showing a form
  // that will immediately bounce.
  const actor = await currentActor();
  if (actor && actor.status === "active") redirect(homeFor(actor.role));

  /*
   * An unconfigured portal says so. The alternative is rejecting a correct
   * password with no explanation, which sends the operator hunting for a typo
   * in their own credentials.
   */
  const ready = opsSessionConfigured() && supabaseConfigured();

  return (
    <main className="portal-surface grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark height={44} priority />
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-6 sm:p-7">
          <h1 className="font-display text-[17px] leading-[1.25] font-bold text-[var(--navy)]">
            Operations portal
          </h1>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
            This area is not public and is not indexed.
          </p>

          <div className="mt-5 flex flex-col gap-3">
            {params.suspended ? (
              <SystemAlert condition="Account suspended." tone="failed">
                An administrator can restore it. Signing in is refused until they do.
              </SystemAlert>
            ) : null}

            {params.reset ? (
              <p className="rounded-[var(--radius-control)] border border-[var(--green-border)] bg-[var(--green-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--green)]">
                Your password is set. Sign in with it.
              </p>
            ) : null}

            {ready ? null : (
              <SystemAlert condition="Not configured." tone="failed">
                The portal is not configured on this deployment, so nobody can sign in. What is
                missing is in the server logs rather than on this page.
              </SystemAlert>
            )}

            {/*
              Rendered unconditionally. The component reads the gate itself and
              returns null once it lifts, so there is nothing to remember to
              remove on launch day.
            */}
            <RestrictedMode />
          </div>

          <LoginForm next={params.next ?? null} disabled={!ready} />
        </div>

        <p className="mt-5 text-center text-[12px] leading-[1.6] text-[var(--secondary)]">
          Firm registration pending with the Texas Board of Professional Engineers and Land
          Surveyors. No engineer of record is yet in responsible charge.
        </p>
      </div>
    </main>
  );
}
