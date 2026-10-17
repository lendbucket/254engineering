import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { accountDefaults, savedProperties } from "@/lib/ops-account";
import { listApiKeys } from "@/lib/account-api-keys";
import { Wordmark } from "@/components/brand/Wordmark";
import { registrationLine } from "@/lib/launch";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  const [defaults, properties, keys] = await Promise.all([
    accountDefaults(me.accountId),
    savedProperties(me.accountId),
    listApiKeys(me.accountId),
  ]);

  return (
    /*
     * RESTYLED TO DESIGN V10, 2026-09-29. THE SHELL ONLY, AND THAT IS STATED
     * RATHER THAN LEFT TO BE NOTICED.
     *
     * The header, the heading, the footer and this page's own copy are on V10.
     * `SettingsClient` beneath it is 408 lines of dense form and is NOT
     * restyled: it is still on the staff palette and the staff type scale, so
     * this screen currently reads as a V10 shell around an older interior.
     *
     * That is a real seam and it is deliberate rather than an oversight. A
     * token pass over a form that holds API keys, saved properties and billing
     * contacts is not a restyle, it is a rewrite of every control on it, and
     * doing that at speed on the surface where a customer edits what the firm
     * bills them is the wrong trade. It is in BACKLOG.md with the two other
     * clients in the same position.
     */
    <div className="v10-phone-ground flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/account" prefetch={false} aria-label="254 Engineering Services, your account">
            {/* v5's header rule as CSS. See the note on /account/login. */}
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" />
          </Link>
          <Link
            href="/account"
            prefetch={false}
            className="text-[14px] font-semibold text-[var(--color-link)]"
          >
            Your account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div>
          <p className="v10-label">Your account</p>
          <h1 className="mt-2.5 text-[clamp(1.65rem,3vw,2rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
            Settings
          </h1>
          <p className="mt-3 max-w-[62ch] text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
            What the firm uses by default when this organization orders. Everything here can still be
            changed on a single order.
          </p>
        </div>

        <div className="mt-10">
        <SettingsClient
          isOwner={me.accountRole === "owner"}
          defaults={
            defaults ?? {
              billingEmail: null,
              billingContact: null,
              preferredUrgency: null,
              accessInstructions: null,
              defaultCounties: [],
            }
          }
          apiKeys={keys.map((k) => ({
            id: k.id,
            label: k.label,
            prefix: k.prefix,
            rateLimitPerMinute: k.rate_limit_per_minute,
            lastUsedAt: k.last_used_at,
            revokedAt: k.revoked_at,
          }))}
          properties={properties.map((p) => ({
            id: p.id,
            label: p.label,
            propertyAddress: p.propertyAddress,
            city: p.city,
            county: p.county,
            postalCode: p.postalCode,
          }))}
        />
      </div>

        <p className="mt-10 text-[14px] text-[var(--color-ink-quiet)]">
          <Link
            href="/account"
            className="text-[var(--color-link)] underline underline-offset-2"
          >
            Back to your account
          </Link>
        </p>
      </main>

      <footer className="border-t border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-[var(--color-ink-quiet)] sm:px-6">
          {/* Derived from the board's own record. Never typed. */}
          <p>{registrationLine()}</p>
          <nav className="flex gap-5">
            <Link href="/terms" prefetch={false} className="text-[var(--color-link)]">
              Terms
            </Link>
            <Link href="/privacy" prefetch={false} className="text-[var(--color-link)]">
              Privacy
            </Link>
            <Link href="/contact" prefetch={false} className="text-[var(--color-link)]">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
