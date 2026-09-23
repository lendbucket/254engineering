import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { Wordmark } from "@/components/brand/Wordmark";
import { deliverablesFor, orderBlockedReason } from "@data/catalog";
import { services } from "@/content/services";
import { launchMode, notYetAcceptingEngagements, registrationStatement, serviceLineIsOffered } from "@/lib/launch";
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
  /*
   * THE MODE, NOT A BOOLEAN NAMED FOR THE WRONG ONE. Corrected 2026-09-23, the
   * same defect as the public order page: `!isOpen()` is true in PRELAUNCH and
   * in TRADING and the name said only the first.
   */
  const mode = launchMode();
  const notYetOpen = mode !== "open";

  /*
   * Only lines that can actually be ordered in bulk. A quote only deliverable
   * has no price, so forty of them is forty conversations rather than one
   * payment, and offering it here would produce a submission nobody can price.
   */
  const orderable = services
    .map((s) => ({
      service: s,
      deliverables: deliverablesFor(s.slug).filter(
        (d) => orderBlockedReason(d, mode, serviceLineIsOffered(d.serviceSlug)) === null && d.priceCents !== null,
      ),
    }))
    .filter((s) => s.deliverables.length > 0);

  const chosen = orderable.find((s) => s.service.slug === service) ?? orderable[0];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-10">
      <div className="mb-6">
        <Wordmark height={36} />
      </div>

      <p className="portal-kicker text-[var(--gold-deep)]">
        {me.displayName}
      </p>
      <h1 className="mt-2 font-display text-[clamp(1.7rem,3vw,2.2rem)] leading-[1.2] font-semibold text-[var(--navy)]">
        Order for several properties
      </h1>

      {orderable.length === 0 ? (
        <div className="mt-8 rounded-[4px] border border-[var(--border)] border-t-brass bg-white px-6 py-7">
          <h2 className="font-display text-[1.25rem] font-semibold text-[var(--navy)]">
            {notYetOpen ? "The firm is not taking orders yet" : "Nothing can be ordered in bulk yet"}
          </h2>
          <p className="mt-3 text-[1rem] leading-[1.7] text-[var(--secondary)]">
            {/*
              * THREE MODES, THREE TRUE SENTENCES. Corrected 2026-09-23.
              *
              * PRELAUNCH keeps the pair it always had, and both are derived:
              * notYetAcceptingEngagements() and registrationStatement() read
              * the register, so neither can claim a registration state the
              * board does not hold.
              *
              * TRADING said the same thing until today, which was false: it
              * carried a registration disclaimer for a firm whose registration
              * is active. What is true in trading is that the firm is
              * registered and is not yet taking orders through the site, so
              * that is what it says.
              */}
            {mode === "prelaunch"
              ? [notYetAcceptingEngagements(), registrationStatement()].filter(Boolean).join(" ")
              : mode === "trading"
                ? `${registrationStatement()} Orders are not open through the site yet, so anything on this account is arranged with the office.`
                : "Every service on this account is quoted rather than fixed price, so each one is a conversation rather than a submission."}
          </p>
          <Link
            href="/account"
            className="mt-6 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
          >
            Back to your account
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-[68ch] text-[1.02rem] leading-[1.7] text-[var(--secondary)]">
            Paste the properties, answer the qualifying questions once, and change any property
            where the answer differs. You see which the firm can take, which it cannot and why, and
            what the total is, before anything is charged.
          </p>

          <nav className="mt-6 flex flex-wrap gap-2">
            {orderable.map((o) => (
              <Link
                key={o.service.slug}
                href={`/account/order?service=${o.service.slug}`}
                className={`inline-flex min-h-[44px] items-center rounded-[3px] border px-3.5 text-[13.5px] font-semibold ${
                  o.service.slug === chosen.service.slug
                    ? "border-[var(--navy)] bg-slate text-white"
                    : "border-[var(--border)] bg-white text-[var(--navy)]"
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
