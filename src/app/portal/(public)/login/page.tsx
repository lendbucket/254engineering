import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentActor } from "@/lib/ops-auth";
import { homeFor } from "@/lib/ops-authz";
import { opsSessionConfigured } from "@/lib/ops-session";
import { supabaseConfigured } from "@/lib/supabase";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

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
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-slate via-slate-deep to-slate-abyss px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Wordmark onDark height={44} priority />
        </div>

        <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white p-6 sm:p-7">
          <h1 className="font-display text-[22px] leading-[1.2] font-bold text-slate">
            Sign in to the portal
          </h1>
          <p className="mt-2 text-[14px] leading-[1.6] text-slate-muted">
            Operations for 254 Engineering Services. This area is not public and is not indexed.
          </p>

          {params.suspended ? (
            <p
              role="alert"
              className="mt-5 rounded-[3px] border border-[#f3c9c6] bg-[#fdeceb] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[#8c1d18]"
            >
              That account is suspended. An administrator can restore it.
            </p>
          ) : null}

          {params.reset ? (
            <p className="mt-5 rounded-[3px] border border-[#bcdcc7] bg-[#e8f3ec] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[#14522f]">
              Your password is set. Sign in with it.
            </p>
          ) : null}

          {ready ? null : (
            <p
              role="alert"
              className="mt-5 rounded-[3px] border border-[#f0d9a8] bg-[#fdf3e0] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[#7a4c05]"
            >
              The portal is not configured on this deployment, so nobody can sign in. The operator
              needs to set OPS_SESSION_SECRET and the Supabase credentials.
            </p>
          )}

          <LoginForm next={params.next ?? null} disabled={!ready} />
        </div>

        <p className="mt-5 text-center text-[12px] leading-[1.6] text-slate-fg/55">
          Firm registration pending with the Texas Board of Professional Engineers and Land
          Surveyors. No engineer of record is yet in responsible charge.
        </p>
      </div>
    </main>
  );
}
