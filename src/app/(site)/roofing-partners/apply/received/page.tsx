import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { ButtonLink } from "@/components/ui/primitives";
import { Section, SectionHead } from "@/components/ui/section";
import { business } from "@/config/business";
import { founder } from "@/config/contact";
import { buildMetadata } from "@/lib/seo";

/**
 * THE CONFIRMATION, AND WHAT HAPPENS NEXT. Robert's request of 2026-11-05.
 *
 * It names no time, because a person reads each application and how long that
 * takes is not something a page can know. It is out of the index: a page that
 * says "we have your application" is true only for the person just sent here.
 */
export const metadata: Metadata = {
  ...buildMetadata({
    title: "Your Roofing Partner Application Is In | 254 Engineering",
    description:
      "Your roofing partner application reached the firm. A person reads every one; approval brings an account and a password link, and a decline a short note.",
    path: "/roofing-partners/apply/received",
  }),
  robots: { index: false, follow: true },
};

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Roofing partners", path: "/roofing-partners" },
  { name: "Application received", path: "/roofing-partners/apply/received" },
];

export default function RooferApplicationReceivedPage() {
  const next = [
    {
      title: "An email confirms it",
      body: "A short message to the address you gave says the application arrived. If it is not in your inbox, look in spam, then reply to it with anything you want to add.",
    },
    {
      title: "A person reads it",
      body: "Someone at the firm reads the application, checks the office, the general liability cover and its certificate, and checks your two references.",
    },
    {
      title: "You hear the decision by email",
      body: "If it is approved, an email brings a link to set the password for your company's account. If it is not, a short note says so.",
    },
  ];
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Application received"
        title="Your application is in"
        lede="Thank you. Nothing else is needed from you right now."
      />
      <Section tone="white">
        <SectionHead eyebrow="What happens next" title="Three things, in this order" />
        <ol className="mt-8 grid gap-5 lg:grid-cols-3">
          {next.map((s, i) => (
            <li key={s.title} className="relative overflow-hidden rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6">
              <span aria-hidden="true" className="pointer-events-none absolute -right-2 -bottom-10 font-display text-[150px] leading-none font-extrabold text-limestone-sunk select-none">
                {i + 1}
              </span>
              <h3 className="relative font-display text-[20px] font-bold text-slate">{s.title}</h3>
              <p className="relative mt-2 text-[15px] leading-[1.65] text-slate-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-[62ch] text-[15.5px] leading-[1.7] text-slate-ink">
          Questions in the meantime go to {founder.name} at{" "}
          <a href={`mailto:${business.email}`} className="font-semibold text-slate underline">
            {business.email}
          </a>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/roofing-partners">Back to roofing partners</ButtonLink>
          <ButtonLink href="/services" tone="secondary">
            See the services
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
