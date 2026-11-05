import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { RooferApplicationForm } from "@/components/forms/RooferApplicationForm";
import { Callout } from "@/components/ui/section";
import { Container } from "@/components/ui/Container";
import { founder } from "@/config/contact";
import { regions } from "@/content/regions";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { buildMetadata } from "@/lib/seo";

/**
 * THE APPLICATION ITSELF. Robert's request of 2026-11-05: short, works on a
 * phone, keeps progress if the roofer leaves, validates as they type, takes the
 * certificate cleanly, and ends on a confirmation page that says what happens
 * next. The form is RooferApplicationForm; the rules it validates with are
 * roofer-application.ts, which the route parses with too.
 *
 * Only region names and their county lists reach the browser, for the county
 * picker: the regions' copy stays on the server.
 */
export const metadata: Metadata = buildMetadata({
  title: "Apply to Be a Roofing Partner in Texas | 254 Engineering",
  description:
    "The roofing partner application: your company, your crews and counties, your general liability cover and two references. Three short steps; send it today.",
  path: "/roofing-partners/apply",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Roofing partners", path: "/roofing-partners" },
  { name: "Apply", path: "/roofing-partners/apply" },
];

export default function RooferApplyPage() {
  const picker = regions.map((r) => ({ name: r.name, counties: r.counties }));
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <PageHeader
        crumbs={crumbs}
        eyebrow="Roofing partners"
        title="Apply to work with the firm"
        lede="Three short steps: your company, your work, and your insurance and references. A person at the firm reads every application."
      />
      <section className="bg-limestone">
        <Container>
          <div className="grid gap-8 py-[clamp(36px,6vw,72px)] lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-[4px] border border-limestone-line border-t-4 border-t-brass bg-white p-[clamp(20px,3vw,36px)]">
              <RooferApplicationForm regions={picker} />
            </div>
            <aside className="flex flex-col gap-5 lg:pt-2">
              <Callout label="What you need" title="Before you start">
                Your general liability carrier and limits, and the names and phone numbers of two references. The
                certificate helps, and can be a photo.
              </Callout>
              <Callout label="Questions" title={founder.name}>
                {founder.name}, the firm&apos;s founder, answers questions about the program before you apply.
              </Callout>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
