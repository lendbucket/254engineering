import type { Metadata } from "next";
import { adminAuthConfigured } from "@/lib/admin-auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * The sign in screen.
 *
 * The unconfigured state is stated plainly rather than shown as a failing login.
 * An operator whose ADMIN_PASSPHRASE is unset would otherwise retype a correct
 * passphrase until they gave up, and the portal holds nothing a visitor could
 * reach anyway while it is in that state.
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate via-slate-deep to-slate-abyss px-[clamp(1rem,4vw,1.75rem)] py-12">
      <div className="w-full max-w-[420px]">
        <p className="text-[12px] font-bold tracking-[0.14em] text-brass-light uppercase">
          254 Engineering Services
        </p>
        <h1 className="mt-3 font-display text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-slate-fg">
          Operator sign in
        </h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-slate-fg-muted">
          This portal holds applicant and onboarding records. It is not part of the public site.
        </p>

        <div className="mt-7 rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white p-[clamp(20px,3vw,28px)]">
          {adminAuthConfigured() ? (
            <LoginForm />
          ) : (
            <div>
              <p className="text-[12px] font-bold tracking-[0.12em] text-brass-ink uppercase">
                Not configured
              </p>
              <p className="mt-2 text-[15px] leading-[1.7] text-slate-muted">
                ADMIN_PASSPHRASE is not set, or is shorter than twelve characters and rejected as
                too weak. Nobody can sign in until it is set in the deployment environment. Nothing
                in this portal is reachable in the meantime.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
