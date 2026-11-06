import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { ButtonLink } from "@/components/ui/primitives";
import { CARD, Callout, IconTile, Section, SectionHead } from "@/components/ui/section";
import { ClipboardCheckIcon, PinIcon, RoofIcon, SealedLetterIcon, ShieldCheckIcon, SpecIcon, WindIcon } from "@/components/ui/icons";
import { business } from "@/config/business";
import { displayPhone, founder, telHref } from "@/config/contact";
import { firmName, isOpen, isTrading, sealingIsAvailable } from "@/lib/launch";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { buildMetadata } from "@/lib/seo";
import { BOOK_A_CALL_URL } from "@/content/book-a-call";

/**
 * ===========================================================================
 * /roofing-partners: THE ROOFER PARTNER PROGRAM, SOLD IN THE BRAND'S VOICE.
 * Robert's request and rulings of 2026-11-05.
 * ===========================================================================
 *
 * WHAT IT SAYS, and each claim is something the platform does:
 *   - partner pricing: an approved account carries prices the firm sets for
 *     it (trade prices, trade-pricing.ts, never below the ruled floors). No
 *     figure is printed, because none is fixed for a partner as such;
 *   - one place to order and track every job: the B2B account's orders list;
 *   - the engineer's review and the sealed letter through the platform: the
 *     review queue and the letter on the order page;
 *   - a named contact: Robert Reyna, as founder, which is how contact.ts
 *     names him and is no engineering title (ruling 5).
 *
 * WHAT IT NEVER SAYS, by CLAUDE.md section 1 and his request: no turnaround
 * for sealed work, no present tense service claim unless the gate allows it
 * (every such sentence reads isOpen, isTrading or sealingIsAvailable, so the
 * page is right in whichever mode it renders), no fee, commission, rebate or
 * credit for sending work (22 TAC 137.63(c)(4)), no mark for the roofer to
 * sell with (ruling 2), and no cap on partners (ruling 4).
 *
 * Composed to the interior parity standard in DESIGN_SPEC.md: a navy hero, a
 * white strip, a limestone argument, a navy middle band with ghost numerals,
 * a white section, and the navy closing band.
 */
export const metadata: Metadata = buildMetadata({
  title: "Roofing Partners: Apply to Work With Us | 254 Engineering",
  description:
    "Texas roofing companies: apply to work with the firm as a partner, with prices set for your account, every job in one place and a named contact. Apply online.",
  path: "/roofing-partners",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Roofing partners", path: "/roofing-partners" },
];

const APPLY = "/roofing-partners/apply";

export default function RoofingPartnersPage() {
  const open = isOpen();
  const trading = isTrading();
  const sealing = sealingIsAvailable();
  const phone = displayPhone();
  const tel = telHref();

  const offer = [
    {
      icon: <ClipboardCheckIcon size={22} />,
      tag: "Pricing",
      title: "Prices set for your account",
      body: "An approved partner account carries its own prices for the services your company orders, set by the firm when the account opens and shown before every order.",
    },
    {
      icon: <RoofIcon size={22} />,
      tag: "One account",
      title: open ? "Order and track every job in one place" : "Every job in one place",
      body: open
        ? "Each order, its status, its documents and its invoice sit in your account, for every property and every crew, so nobody on your side has to keep a spreadsheet of where each one stands."
        : "A partner account is built to hold each order, its status, its documents and its invoice, for every property and every crew, in one list.",
    },
    {
      icon: <SealedLetterIcon size={22} />,
      tag: "Engineering",
      title: sealing ? "The engineer's review and the sealed letter" : "The engineer's review, then the letter",
      body: sealing
        ? "Every job is reviewed by the firm's licensed engineer, and the sealed letter is delivered through your account, where it stays."
        : "The platform is built so that each job is reviewed by the firm's engineer before any letter is sealed, and so that the letter reaches your account rather than an inbox.",
    },
    {
      icon: <PinIcon size={22} />,
      tag: "A person",
      title: `A named contact: ${founder.name}`,
      body: `${founder.name}, the firm's founder, is your contact at the firm. You call or write to a person who knows your account, not a queue.`,
    },
  ];

  const steps = [
    {
      title: "Apply",
      body: "Tell the firm about your company, your crews, the counties you work in, your general liability cover and two references. Attach the certificate if you have it to hand. Your progress is kept on your device if you need to stop.",
    },
    {
      title: "A person reads it",
      body: "Someone at the firm reads every application and checks three things: an office in Texas, general liability cover with a certificate, and two references a person checks. Nothing is approved automatically.",
    },
    {
      title: "Your account opens",
      body: "On approval the firm opens an account for your company and emails a link to set its password. If the application is not taken forward, you receive a short note saying so.",
    },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <PageHeader
        crumbs={crumbs}
        eyebrow="Roofing partners"
        title="Engineering for Texas roofers, from one account"
        lede={
          trading
            ? "Texas roofing companies apply to work with the firm as partners. An approved partner orders inspections, roof certification letters, windstorm work and repair specifications from one account, at prices set for that account, with a person at the firm to call."
            : "Texas roofing companies can apply now to work with the firm as partners. A partner account is built for inspections, roof certification letters, windstorm work and repair specifications, at prices set for the account, with a person at the firm to call."
        }
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={APPLY} tone="onDark">
            Apply to become a partner
          </ButtonLink>
          <ButtonLink href="#what-the-firm-looks-for" tone="onDarkOutline">
            What the firm looks for
          </ButtonLink>
        </div>
      </PageHeader>

      {/* The strip: the four services a partner orders, read at a glance (DESIGN_SPEC addendum: a strip carries no head). */}
      <section className="border-b border-limestone-line bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-[clamp(16px,4vw,28px)] py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <RoofIcon size={30} />, label: "Roof inspections and certification letters", href: "/services/roof-inspections" },
            { icon: <WindIcon size={30} />, label: "Windstorm (WPI-8)", href: "/services/windstorm-wpi-8" },
            { icon: <SpecIcon size={30} />, label: "Repair specifications", href: "/services/repair-specifications" },
            { icon: <ShieldCheckIcon size={30} />, label: `About ${firmName()}`, href: "/about" },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="flex min-h-[44px] items-center gap-3 text-[15px] font-semibold text-slate hover:text-brass-ink">
              <span className="text-slate">{s.icon}</span>
              <span>{s.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <Section tone="sunk" id="what-a-partner-gets">
        <SectionHead
          eyebrow="The partner account"
          title="What working with the firm looks like"
          lede="Four things, each of them something the platform does rather than a promise on a page."
        />
        <ul className="mt-10 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
          {offer.map((o) => (
            <li key={o.title} className={`${CARD} relative p-6`}>
              <p className="absolute top-5 right-5 text-[11.5px] font-bold tracking-[0.1em] text-brass-ink uppercase">{o.tag}</p>
              <IconTile>{o.icon}</IconTile>
              <h3 className="mt-5 font-display text-[19px] leading-[1.3] font-bold text-slate">{o.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.65] text-slate-muted">{o.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="navy" id="how-it-works">
        <SectionHead
          onDark
          eyebrow="How approval works"
          title="Three steps, and a person at each one"
          lede="The program is selective in one way only: every application is read and decided by a person at the firm."
        />
        <ol className="mt-10 grid gap-5 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative overflow-hidden rounded-[4px] bg-white p-6 text-slate-ink">
              <span aria-hidden="true" className="pointer-events-none absolute -right-2 -bottom-10 font-display text-[150px] leading-none font-extrabold text-limestone-sunk select-none">
                {i + 1}
              </span>
              <p className="relative text-[12px] font-bold tracking-[0.14em] text-brass-ink uppercase">Step {i + 1}</p>
              <h3 className="relative mt-2 font-display text-[21px] font-bold text-slate">{s.title}</h3>
              <p className="relative mt-2 max-w-[44ch] text-[15px] leading-[1.65] text-slate-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="white" id="what-the-firm-looks-for">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <SectionHead
              eyebrow="What the firm looks for"
              title="Three things, read by a person"
              lede="There is no quota and no limit by county. An application that meets these is read on its merits."
            />
            <ul className="mt-6 space-y-3 text-[15.5px] leading-[1.65] text-slate-ink">
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-brass" />
                An office in Texas, in a city you name.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-brass" />
                General liability cover, with the carrier, the limits and a certificate.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-brass" />
                Two references a person at the firm checks, with their telephone numbers.
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-5">
            <Callout label="Plainly" title="What a partnership is not">
              The firm pays nothing to any roofer for sending it work: no fee, no commission and no credit. A partner
              sells under its own name and is given no badge, logo or mark of the firm&apos;s to use.
              {trading ? " The engineering on every job is the firm's, under its registration." : ""}
            </Callout>
            <Callout label="Your contact" title={founder.name}>
              Questions before you apply go to {founder.name}, the firm&apos;s founder, at{" "}
              <a href={`mailto:${business.email}`} className="font-semibold text-slate underline">
                {business.email}
              </a>
              {phone && tel ? (
                <>
                  {" "}or{" "}
                  <a href={tel} className="font-semibold whitespace-nowrap text-slate underline">
                    {phone}
                  </a>
                </>
              ) : null}
              {/* Robert, 2026-11-06: the page's path to a quote, once "Ask a question first" goes to his booking page. */}
              , or through the{" "}
              <Link href="/contact" className="font-semibold text-slate underline">
                contact page
              </Link>
              .
            </Callout>
          </div>
        </div>
      </Section>

      {/* The closing band: navy, eyebrow, h2, lede, gold primary, outline secondary (DESIGN_SPEC device 8). */}
      <section className="bg-gradient-to-b from-slate to-slate-deep text-slate-fg">
        <div className="mx-auto max-w-[1200px] px-[clamp(16px,4vw,28px)] py-[clamp(48px,7vw,88px)]">
          <SectionHead
            onDark
            eyebrow="Apply"
            title="The application takes about ten minutes"
            lede="Three short steps on a phone or a desk. Your answers are kept on your device until you send them, so you can stop and come back."
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={APPLY} tone="onDark">
              Start the application
            </ButtonLink>
            <ButtonLink href={BOOK_A_CALL_URL} tone="onDarkOutline" newTab>
              Ask a question first
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
