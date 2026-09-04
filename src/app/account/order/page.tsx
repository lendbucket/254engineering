import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { Wordmark } from "@/components/brand/Wordmark";
import { deliverablesFor, orderBlockedReason } from "@data/catalog";
import { services } from "@/content/services";
import { isPrelaunch } from "@/lib/launch";
import { BulkOrderClient } from "./BulkOrderClient";

export const dynamic = "force-dynamic";

/**
 * Ordering for several properties at once.
 *
 * The compliance gate is rendered here rather than linked around, exactly as the
 * single order flow does it. A dead link would look like a broken site; a page
 * that names the registration is the honest answer and the credible one.
 */
export default async function BulkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  const { service } = await searchParams;
  const prelaunch = isPrelaunch();

  /*
   * Only lines that can actually be ordered in bulk. A quote only deliverable
   * has no price, so forty of them is forty conversations rather than one
   * payment, and offering it here would produce a submission nobody can price.
   */
  const orderable = services
    .map((s) => ({
      service: s,
      deliverables: deliverablesFor(s.slug).filter(
        (d) => orderBlockedReason(d, prelaunch) === null && d.priceCents !== null,
      ),
    }))
    .filter((s) => s.deliverables.length > 0);

  const chosen = orderable.find((s) => s.service.slug === service) ?? orderable[0];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-10">
      <div className="mb-6">
        <Wordmark height={36} />
      </div>

      <p className="text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">
        {me.displayName}
      </p>
      <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.2rem)] leading-[1.2] font-semibold text-slate">
        Order for several properties
      </h1>

      {orderable.length === 0 ? (
        <div className="mt-8 rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white px-6 py-7">
          <h2 className="font-display text-[1.25rem] font-semibold text-slate">
            {prelaunch ? "The firm is not taking orders yet" : "Nothing can be ordered in bulk yet"}
          </h2>
          <p className="mt-3 text-[1rem] leading-[1.7] text-slate-muted">
            {prelaunch
              ? "254 Engineering Services is not yet accepting engineering work. Firm registration with the Texas Board of Professional Engineers and Land Surveyors is pending."
              : "Every service on this account is quoted rather than fixed price, so each one is a conversation rather than a submission."}
          </p>
          <Link
            href="/account"
            className="mt-6 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-slate underline underline-offset-2"
          >
            Back to your account
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-[68ch] text-[1.02rem] leading-[1.7] text-slate-muted">
            Paste the properties, answer the qualifying questions once, and change any property
            where the answer differs. You see which the firm can take, which it cannot and why, and
            what the total is, before anything is charged.
          </p>

          <nav className="mt-6 flex flex-wrap gap-2">
            {orderable.map((o) => (
              <Link
                key={o.service.slug}
                href={`/account/order?service=${o.service.slug}`}
                className={`inline-flex min-h-[44px] items-center rounded-[3px] border px-3.5 text-[13px] font-semibold ${
                  o.service.slug === chosen.service.slug
                    ? "border-slate bg-slate text-white"
                    : "border-limestone-line bg-white text-slate"
                }`}
              >
                {o.service.shortName}
              </Link>
            ))}
          </nav>

          <div className="mt-8">
            <BulkOrderClient
              key={chosen.service.slug}
              billingMode={me.account.billingMode}
              deliverables={chosen.deliverables.map((d) => ({
                serviceSlug: d.serviceSlug,
                tier: d.tier,
                name: d.name,
                priceCents: d.priceCents,
                qualifiers: d.qualifiers.map((q) => ({
                  id: q.id,
                  prompt: q.prompt,
                  options: [...q.options],
                })),
              }))}
            />
          </div>
        </>
      )}
    </main>
  );
}
