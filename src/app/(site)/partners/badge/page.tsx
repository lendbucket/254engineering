import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { Rule } from "@/components/ui/primitives";
import { SectionHead } from "@/components/ui/section";
import { OfferCta } from "@/components/launch/OfferCta";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business } from "@/config/business";
import { partnerBadgeHtml, partnerBadgeText } from "@/lib/partner-copy";
import { partnerBadgeSvg } from "@/lib/partner-badge-svg";

/**
 * THE PARTNER BADGE PAGE. Robert, 2026-11-01, round 3 item c, approved in his
 * answer 4: a small text-only SVG badge with copy-paste HTML linking to
 * 254engineering.com, plain link, no tracking script, gate-aware wording
 * carrying the registrant and the firm number.
 *
 * Nothing on this page types the firm's name or number. The badge sentence is
 * partnerBadgeText(), the same one signed-in partners take from
 * /partner/materials, so the two can never offer different wording. It is
 * passed false for "is any line open", the shut answer, because a static page
 * cannot read the signed record (see src/app/partners/badge.svg/route.ts).
 *
 * The 2026-10-15 rule holds: a partner sells under its own name, and the badge
 * is a disclosure beside that name, never a mark to trade under. So it is text
 * in a box with no numerals and no logo.
 */
export const metadata: Metadata = buildMetadata({
  title: "Partner Badge and Copy-Paste HTML | 254 Engineering",
  description:
    "A text-only badge for a partner's own site, naming the firm of record for the engineering, with the HTML to copy. No logo and no script. See the badge.",
  path: "/partners/badge",
  /* Robert, 2026-11-02: noindex and out of the sitemap; /press links it. */
  noIndex: true,
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Partner badge", path: "/partners/badge" },
];

export default function PartnerBadgePage() {
  const text = partnerBadgeText(false);
  const { width, height } = partnerBadgeSvg(text);
  const svgUrl = `${business.url}/partners/badge.svg`;
  const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const imageSnippet = `<a href="${business.url}" rel="noopener"><img src="${svgUrl}" alt="${escapeAttr(text)}" width="${width}" height="${height}"></a>`;
  const textSnippet = partnerBadgeHtml(text, business.url);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <PageHeader
        eyebrow="Partners"
        title="The partner badge"
        lede="A small badge a partner can place on its own site, beside its own business name. It is text in a box, with no logo, and it links to 254engineering.com."
        crumbs={crumbs}
      />

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="The badge" title="What it says, and why" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              {/* next/image, unoptimized because an SVG is served as it is rather than re-encoded (the-site-images-serve-avif-then-webp.mjs holds every public image to next/image). */}
              <Image src="/partners/badge.svg" alt={text} width={width} height={height} unoptimized className="h-auto max-w-full" />
              <p className="mt-8 text-[1.02rem] leading-[1.75] text-slate-muted">
                The sentence is read from the firm&apos;s registration record, so the name and number
                in it are the ones the Texas Board of Professional Engineers and Land Surveyors holds.
                Its wording follows the firm&apos;s launch gate and changes by itself when the gate
                does, so a badge placed today never says more than the firm may say.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                Use it beside your own business name, never in place of it. It loads no script and
                carries nothing but the sentence and a link.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHead eyebrow="The HTML" title="Copy one of these" level="h2" />
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[1.05rem] font-semibold text-slate">The badge as an image</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all border border-limestone-line bg-white p-4 font-mono text-[0.85rem] leading-[1.6] text-slate">
                <code>{imageSnippet}</code>
              </pre>
              <p className="mt-8 text-[1.05rem] font-semibold text-slate">The same sentence as a plain text link</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all border border-limestone-line bg-white p-4 font-mono text-[0.85rem] leading-[1.6] text-slate">
                <code>{textSnippet}</code>
              </pre>
            </div>
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
