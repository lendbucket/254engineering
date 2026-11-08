import { redirect } from "next/navigation";
import { performingFirmLine } from "@/lib/partner-copy";
import { currentPartner } from "@/lib/partner-auth";
import { partnerSessionConfigured } from "@/lib/partner-session";
import { supabaseConfigured } from "@/lib/supabase";
import { RestrictedMode, SystemAlert } from "@/components/portal/design";
import { SignInFrame, SignInHeading } from "@/components/portal/SignInFrame";
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
 *
 * THE 2026-11-08 REDESIGN. PRESENTATION ONLY. Robert's order: one design for
 * the three sign-in screens. The guard, the set and suspended notices, the
 * configuration check and the gate's restricted-mode notice are unchanged; the
 * notice sits in the navy panel. The performing firm line stays at the foot
 * until Robert answers question 3 (see the note beside it).
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
    <SignInFrame
      purpose="The work you refer to the firm, and your statements."
      notice={params.suspended ? null : <RestrictedMode />}
    >
      <SignInHeading />

      {params.set || params.suspended || !ready ? (
        <div className="mt-5 flex flex-col gap-3">
          {params.set ? (
            <p className="text-[15px] leading-[1.55] font-semibold text-[var(--ink)]">
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
        </div>
      ) : null}

      <PartnerLoginForm disabled={!ready} />

      {/*
        KEPT, PENDING ROBERT'S ANSWER TO QUESTION 3 (issue #1, 6724659079). The
        recommendation was that it leaves the sign-in page like the registration
        line; partner-audit asserts every partner surface renders it, and a
        regulatory disclosure does not leave a page on a recommendation. Outside
        the form, at the foot, so the form holds only what the order lists.
      */}
      <p className="mt-10 text-center text-[12px] leading-[1.6] text-[var(--secondary)]">
        {performingFirmLine()}
      </p>
    </SignInFrame>
  );
}
