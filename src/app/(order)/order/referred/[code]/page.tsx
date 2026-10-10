import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ReferralCapture } from "@/components/site/ReferralCapture";
import { deliverablesFor } from "@data/catalog";
import { services } from "@/content/services";
import { launchMode } from "@/lib/launch";
import { orderBlockedNow } from "@/lib/line-gate";
import { partnerByCode } from "@/lib/ops-partners";
import { partnerAttributionLine, performingFirmLine } from "@/lib/partner-copy";

/*
 * ===========================================================================
 * A PARTNER'S ORDER PAGE. Run item 16, 2026-10-10.
 * ===========================================================================
 *
 * The partner is in the path, so a visit is a touch with nothing for anybody to
 * strip, and the order the visitor then places is attributed by the visitor
 * cookie as every other partner order is (attributeOrder, the 90 day rule).
 *
 * WHAT THE PAGE CARRIES, AND WHAT IT NEVER CARRIES
 *   - the partner's organisation, as who referred the visitor, never as who
 *     performs the work;
 *   - the fixed attribution per line, from the register (partner-copy.ts);
 *   - the performing firm sentence every partner surface carries;
 *   - ONLY the lines open for ordering now, asked of each deliverable through
 *     orderBlockedNow, the money door every order page uses. A line the gate or
 *     the engineer's signed record holds shut is not listed at all.
 *
 * Never indexed and never in the sitemap: it is one partner's door, not a page
 * about anything, and indexing a copy per partner is the doorway pattern.
 * An unknown or inactive code is a 404, as partnerByCode answers null for both.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const partner = await partnerByCode(code);
  return {
    title: partner ? `Referred by ${partner.organisation} | 254 Engineering` : "Order | 254 Engineering",
    robots: { index: false, follow: false },
  };
}

export default async function PartnerOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const partner = await partnerByCode(code);
  if (!partner) notFound();

  const mode = launchMode();
  const open = (
    await Promise.all(
      services.map(async (service) => {
        const deliverables = deliverablesFor(service.slug);
        if (deliverables.length === 0) return null;
        const blocked = await Promise.all(deliverables.map((d) => orderBlockedNow(d, mode)));
        return blocked.some((b) => b === null) ? service : null;
      }),
    )
  ).filter((s): s is (typeof services)[number] => s !== null);

  return (
    <Container>
      <ReferralCapture code={partner.code} />
      <div className="mx-auto max-w-[68ch] py-12 sm:py-16">
        <p className="v10-label">Referred by {partner.organisation}</p>
        <h1 className="mt-2.5 text-[clamp(1.75rem,3vw,2.1rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          Engineering work, referred by {partner.organisation}
        </h1>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
          {performingFirmLine()}
        </p>

        {open.length === 0 ? (
          <div className="mt-9 border-t border-[var(--color-limestone-line)] pt-7">
            <h2 className="text-[20px] leading-[1.25] font-semibold text-[var(--color-ink)]">
              Nothing can be ordered online here yet
            </h2>
            <p className="mt-3 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
              No service line is open for ordering today. The firm answers enquiries by email in the meantime.
            </p>
            <Link
              href="/contact"
              className="mt-7 inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--color-slate)] px-6 text-[15px] font-semibold text-white"
            >
              Contact the firm
            </Link>
          </div>
        ) : (
          <ul className="mt-9 border-t border-[var(--color-limestone-line)]">
            {open.map((service) => (
              <li key={service.slug} className="border-b border-[var(--color-limestone-line)] py-6">
                <h2 className="text-[20px] leading-[1.25] font-semibold text-[var(--color-ink)]">{service.shortName}</h2>
                <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
                  {partnerAttributionLine(service.shortName)}
                </p>
                <Link
                  href={`/order/start/${service.slug}`}
                  className="mt-4 inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--color-slate)] px-6 text-[15px] font-semibold text-white"
                >
                  Start an order
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
