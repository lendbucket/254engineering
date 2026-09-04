import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { accountDefaults, savedProperties } from "@/lib/ops-account";
import { listApiKeys } from "@/lib/account-api-keys";
import { Wordmark } from "@/components/brand/Wordmark";
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
    <main className="mx-auto max-w-[720px] px-4 py-10">
      <div className="mb-6">
        <Wordmark height={36} />
      </div>

      <p className="text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">Your account</p>
      <h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-[1.2] font-semibold text-slate">
        Settings
      </h1>
      <p className="mt-3 max-w-[62ch] text-[1rem] leading-[1.7] text-slate-muted">
        What the firm uses by default when this organisation orders. Everything here can still be
        changed on a single order.
      </p>

      <div className="mt-8">
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

      <p className="mt-8 text-[13.5px] text-slate-muted">
        <Link href="/account" className="underline underline-offset-2">
          Back to your account
        </Link>
      </p>
    </main>
  );
}
