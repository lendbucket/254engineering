import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { ButtonLink } from "@/components/ui/primitives";
import { Section, SectionHead } from "@/components/ui/section";
import { business } from "@/config/business";
import { founder } from "@/config/contact";
import { buildMetadata } from "@/lib/seo";
import { BOOK_A_CALL_URL } from "@/content/book-a-call";

/**
 * STEP TWO: CHECK YOUR EMAIL. Robert's rework of 2026-11-06 (0117).
 *
 * The account opened at step one; the email link proves the address, sets the
 * password and signs them in. It names no time for the review, because a
 * person approves every partner and how long that takes is not something a
 * page can know. Out of the index: it is true only for the person just sent
 * here. The booking line is Robert's request of the same morning.
 */
export const metadata: Metadata = {
  ...buildMetadata({
    title: "Check Your Email: Your Partner Account | 254 Engineering",
    description:
      "Your roofing partner account is open. The email link sets your password and signs you in, where you finish your profile. A person approves every partner.",
    path: "/roofing-partners/apply/received",
  }),
  robots: { index: false, follow: true },
};

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Roofing partners", path: "/roofing-partners" },
  { name: "Check your email", path: "/roofing-partners/apply/received" },
];

export default function RooferApplicationReceivedPage() {
  const next = [
    {
      title: "Open the email link",
      body: "A message to the address you gave carries a link that sets your password and signs you in. If it is not in your inbox, look in spam.",
    },
    {
      title: "Finish your profile",
      body: "Inside your account: your work, your general liability cover with its certificate, and two references. Each part saves on its own.",
    },
    {
      title: "The firm approves your account",
      body: "A person at the firm reviews it: the office, the cover and its certificate, and your two references. Partner pricing and ordering turn on at approval.",
    },
  ];
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Step 2 of 3"
        title="Check your email"
        lede="Your partner account is open. The link in the email sets your password and signs you in."
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
        {/* Robert's request of 2026-11-06: a short call with him, one click after the review is described. */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <p className="max-w-[62ch] text-[15.5px] leading-[1.7] text-slate-ink">
            Want to talk sooner? Book a short call with {founder.name}, the firm&apos;s founder.
          </p>
          <ButtonLink href={BOOK_A_CALL_URL} newTab>
            Book a call
          </ButtonLink>
        </div>
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
