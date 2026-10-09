import { redirect } from "next/navigation";
import { performingFirmLine } from "@/lib/partner-copy";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentPartner } from "@/lib/partner-auth";
import { partnerSessionConfigured } from "@/lib/partner-session";
import { supabaseConfigured } from "@/lib/supabase";
import { RestrictedMode, SystemAlert } from "@/components/portal/design";
import { PartnerLoginForm } from "./PartnerLoginForm";

export const dynamic = "force-dynamic";

/**
 * Partner sign in.
 *
 * THE WORDMARK IS 254'S, AND ON THIS SCREEN THAT IS CORRECT
 * ---------------------------------------------------------
 * Non negotiable 4 says a partner's branding is primary inside the partner
 * portal. This screen is outside it in the way that matters: nobody is signed
 * in, so there is no partner to brand it as, and the only honest answer to
 * "whose sign in page is this" is the firm whose platform it is.
 *
 * The partner's name becomes the identity of the surface the moment they are
 * through the door.
 */
export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; suspended?: string }>;
}) {
  const params = await searchParams;

  const principal = await currentPartner();
  if (principal) redirect("/partner");

  const ready = partnerSessionConfigured() && supabaseConfigured();

  return (
    <main className="portal-surface v10-phone-ground-centred grid min-h-dvh place-items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-4 flex justify-center sm:mb-6">
          <Wordmark height={44} priority />
        </div>

        {/* V10, as the portal sign in: no card, sections under a 2px ink rule. */}
        <div className="v10-sections border-t-2 border-[var(--ink)] pt-5">
          <div>
            <h1 className="font-display text-[17px] leading-[1.25] font-bold text-[var(--navy)]">
              Referral partners
            </h1>
            <p className="mt-2 text-[14px] leading-[1.6] text-[var(--secondary)]">
              This area is not public and is not indexed.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:gap-3">
            {params.set ? (
              <p className="text-[14px] leading-[1.55] font-semibold text-[var(--ink)]">
                Your password is set. Sign in with it.
              </p>
            ) : null}

            {params.suspended ? (
              <SystemAlert condition="This partner account is not active." tone="failed">
                Signing in is refused until the firm restores it.
              </SystemAlert>
            ) : null}

            {ready ? null : (
              <SystemAlert condition="Not configured." tone="failed">
                The partner program is not configured on this deployment, so nobody can sign in.
                What is missing is in the server logs rather than on this page.
              </SystemAlert>
            )}

            {params.suspended ? null : <RestrictedMode />}
          </div>

          <PartnerLoginForm disabled={!ready} />
        </div>

        <p className="mt-4 text-center text-[12px] leading-[1.6] text-[var(--secondary)] sm:mt-5">
          {performingFirmLine()}
        </p>
      </div>
    </main>
  );
}
