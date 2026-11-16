import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { Finder, type FinderLetter } from "@/components/start/Finder";
import { buildMetadata } from "@/lib/seo";
import { sellableLineOffers } from "@/lib/line-gate";
import { headlineEntry } from "@/lib/ordering";
import { isKnown } from "@/lib/ops-money";
import { LETTER_KEYS, LETTERS, REASONS, letterOf, quoteFor } from "@/lib/start-finder";
import { FIRST_TIER_COASTAL } from "@/content/windstorm";
import { TRIP_FEE_CENTS, money } from "@/config/prices";
import { displayPhone, postalAddressLine, telHref } from "@/config/contact";
import { business } from "@/config/business";
import { registrationLine } from "@/lib/launch";
import { StartFaq } from "@/components/start/StartFaq";

/**
 * /start, THE GOOGLE ADS LANDING PAGE. Robert's add-on of 2026-11-15, built
 * from the approved Claude Design artifact "254 Engineering Ads Landing Page"
 * (f77b6a49, version 1794769736-8484), after reading every claim in it against
 * the code (CLAUDE.md 2c; the verdicts are issue #1, 6902495709).
 *
 * NOINDEX, OUT OF THE SITEMAP AND THE NAVIGATION, NOT DISALLOWED IN robots.txt
 * (item 1): Google's ad checker has to be able to read it, and nothing links
 * to it but an ad.
 *
 * NOTHING TYPED (item 2): every price, the coastal charge, the trip fee, the
 * inspection fee, the office hours and the firm line are read from the price
 * book, the catalogue, the contact config and the register. The firm number
 * appears only in the footer, the FAQ and the sample letter.
 *
 * A CLOSED LINE (item 4) shows /order's own state, from sellableLineOffers().
 *
 * ?letter=<key> (item 6) opens the finder at the county step with that letter
 * chosen and puts the letter's own headline in the h1.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Engineering Letters for Texas Property | 254 Engineering",
    description:
      "Foundation, roof, windstorm, solar and permit letters, sealed by a Texas licensed engineer. See your price in 30 seconds, then order or call the office.",
    path: "/start",
  }),
  robots: { index: false, follow: true },
};

const DEFAULT_HEADLINE = "Engineering letters for Texas homes, signed and sealed.";

export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const chosen = letterOf(typeof params.letter === "string" ? params.letter : null);
  const offers = new Map((await sellableLineOffers()).map((o) => [o.slug, o]));
  const phone = displayPhone();
  const tel = telHref();
  const address = postalAddressLine();
  const host = new URL(business.url).host;

  const letters: FinderLetter[] = LETTER_KEYS.map((k) => {
    const l = LETTERS[k];
    const offer = offers.get(l.slug);
    const q = quoteFor(l, "yes");
    return {
      key: l.key,
      name: l.name,
      cta: l.cta,
      orderable: offer?.orderable ?? false,
      href: offer?.href ?? "/contact",
      offerLabel: offer?.cta ?? "Request a quote",
      price:
        q.kind === "fixed"
          ? { kind: "fixed", inland: money(q.baseCents), coastal: q.coastalCents !== null ? money(q.baseCents + q.coastalCents) : null }
          : q.kind === "hourly"
            ? { kind: "hourly", rate: money(q.rateCents), minimum: money(q.minimumCents) }
            : { kind: "none" },
    };
  });

  const counties = [...FIRST_TIER_COASTAL].join(", ");
  const coastalCents = headlineEntry("roof-inspections")?.coastalSurchargeCents ?? null;
  const coastalCharge = isKnown(coastalCents) ? money(coastalCents) : null;
  const inspectionCents = headlineEntry("roof-inspections")?.inspectionFeeCents ?? null;
  const inspectionFee = isKnown(inspectionCents) ? money(inspectionCents) : null;
  const lowest = letters.filter((l) => l.price.kind === "fixed").map((l) => (l.price as { inland: string }).inland)[0] ?? null;
  const headline = chosen ? chosen.headline : DEFAULT_HEADLINE;

  return (
    <>
      <header className="border-b border-[var(--color-limestone-line)] bg-white">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Wordmark height={64} cssHeight="clamp(48px, 7vw, 64px)" priority />
          <nav aria-label="On this page" className="hidden items-center gap-6 text-[14px] font-semibold text-slate lg:flex">
            <a href="#services">Services</a>
            <a href="#who">Who we work with</a>
            <a href="#process">Process</a>
            <a href="#prices">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          {tel && phone ? (
            <a href={tel} className="flex min-h-[44px] items-center gap-2 whitespace-nowrap text-[15px] font-semibold text-slate">
              <span className="hidden text-[13px] font-normal text-[var(--color-ink-quiet)] sm:inline">Talk to the office</span>
              {phone}
            </a>
          ) : null}
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="bg-[var(--color-limestone)]">
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_460px] lg:py-16">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--color-brass-ink)]">San Antonio, Corpus Christi and the Coastal Bend</p>
              <h1 className="mt-3 text-[28px] leading-[1.15] font-semibold tracking-[-0.5px] text-balance text-slate sm:text-[32px]">{headline}</h1>
              <p className="mt-5 max-w-[60ch] text-[17px] leading-[1.65] text-[var(--color-ink-quiet)]">
                Foundation, roof, windstorm, solar and permit letters, issued by a Texas licensed Professional Engineer. You see the price before you order, and you can follow the job online until the letter is in your inbox.
              </p>
              {tel && phone ? (
                <p className="mt-6">
                  <a href={tel} className="inline-flex min-h-[52px] items-center whitespace-nowrap bg-slate px-6 text-[16px] font-semibold text-white hover:bg-slate-deep">
                    Call {phone}
                  </a>
                  <span className="mt-2 block text-[14px] text-[var(--color-ink-quiet)]">Answered 8 AM to 8 PM Central, every day</span>
                </p>
              ) : null}
              <dl className="mt-8 grid max-w-[560px] grid-cols-3 gap-4 border-t border-[var(--color-limestone-line)] pt-5">
                {lowest ? (
                  <div>
                    <dt className="text-[13px] text-[var(--color-ink-quiet)]">Most letters, price published</dt>
                    <dd className="order-first text-[24px] font-semibold text-slate">{lowest}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[13px] text-[var(--color-ink-quiet)]">By a Texas licensed engineer</dt>
                  <dd className="order-first text-[24px] font-semibold text-slate">Sealed</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-[var(--color-ink-quiet)]">Office open 8 AM to 8 PM</dt>
                  <dd className="order-first text-[24px] font-semibold text-slate">7 days</dd>
                </div>
              </dl>
            </div>
            <div className="min-w-0">
              <Finder letters={letters} reasons={[...REASONS]} initialLetter={chosen?.key ?? null} host={host} phone={phone} tel={tel} coastalCounties={counties} />
            </div>
          </div>
        </section>

        <section aria-label="Why the firm" className="border-y border-[var(--color-limestone-line)] bg-white">
          <ul className="mx-auto grid w-full max-w-[1200px] gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            <li>
              <p className="text-[15px] font-semibold text-slate">Sealed by a licensed PE</p>
              <p className="mt-1 text-[14px] text-[var(--color-ink-quiet)]">The engineer of record signs every letter.</p>
            </li>
            <li>
              <p className="text-[15px] font-semibold text-slate">Prices on the page</p>
              <p className="mt-1 text-[14px] text-[var(--color-ink-quiet)]">Every standard letter&apos;s price is published here.</p>
            </li>
            <li>
              <p className="text-[15px] font-semibold text-slate">Refund if we decline</p>
              <p className="mt-1 text-[14px] text-[var(--color-ink-quiet)]">In full, if it happens before the visit.</p>
            </li>
            <li>
              <p className="text-[15px] font-semibold text-slate">Veteran owned</p>
              <p className="mt-1 text-[14px] text-[var(--color-ink-quiet)]">Based in San Antonio, with technicians in Corpus Christi.</p>
            </li>
          </ul>
        </section>

        <section id="services" className="bg-white">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6">
            <h2 className="text-[28px] font-semibold text-slate">Services</h2>
            <p className="mt-2 max-w-[60ch] text-[16px] text-[var(--color-ink-quiet)]">
              Each letter below has its price on the page. Design work starts with a conversation.
              {tel && phone ? (
                <>
                  {" "}Not sure which one? Call <a href={tel} className="whitespace-nowrap font-semibold text-slate underline underline-offset-2">{phone}</a>.
                </>
              ) : null}
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {letters.map((l) => (
                <li key={l.key} className="flex flex-col border border-[var(--color-limestone-line)] p-5">
                  <p className="text-[24px] font-semibold text-slate">
                    {l.price.kind === "fixed" ? l.price.inland : l.price.kind === "hourly" ? `${l.price.rate}/hr` : ""}
                  </p>
                  <h3 className="mt-1 text-[16px] font-semibold text-slate">{l.name}</h3>
                  <div className="mt-auto flex flex-wrap gap-3 pt-4">
                    <a
                      href={l.orderable ? l.href : l.href}
                      className={
                        l.orderable
                          ? "inline-flex min-h-[44px] items-center bg-slate px-4 text-[14px] font-semibold text-white hover:bg-slate-deep"
                          : "inline-flex min-h-[44px] items-center border border-[var(--color-limestone-edge)] px-4 text-[14px] font-semibold text-slate hover:border-slate"
                      }
                    >
                      {l.orderable ? "Order" : l.offerLabel}
                    </a>
                    <Link href={`/services/${LETTERS[l.key as keyof typeof LETTERS].slug}`} prefetch={false} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--color-link)]">
                      Details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="process" className="bg-[var(--color-limestone)]">
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-[28px] font-semibold text-slate">What happens at the property</h2>
              <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
                Each letter has a written protocol the engineer of record signed. The technician who visits follows it item by item: floor elevations taken across the slab, the roof covering and decking checked against the same list every time, photographs of each point.
              </p>
              <p className="mt-4 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
                Every photograph is time stamped and located by the firm&apos;s app, and the engineer reviews exactly what was taken on site. His letter states what was observed and what he concludes from it.
              </p>
            </div>
            <div className="min-w-0">
              <h2 className="text-[28px] font-semibold text-slate">How an order works</h2>
              <ol className="mt-4 grid gap-4">
                {[
                  ["Order online or by phone", "Tell us about the property and who needs the letter. You pay the published price and get a page to track the order."],
                  ["We schedule the visit", "A technician trained on the protocol for your letter comes out at a time that works for whoever has the keys."],
                  ["The engineer reviews", "He reads the record and reaches a conclusion. If he needs more, he asks for it before he decides."],
                  ["You get the sealed letter", "By email and on your order page. Anyone you added, like your agent or lender, gets their own copy."],
                ].map(([t, b], i) => (
                  <li key={t} className="grid grid-cols-[40px_1fr] gap-3">
                    <span className="text-[20px] font-semibold text-[var(--color-brass-ink)]">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block text-[16px] font-semibold text-slate">{t}</span>
                      <span className="mt-1 block text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">{b}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="who" className="bg-white">
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-[28px] font-semibold text-slate">Who orders from us</h2>
              <dl className="mt-6 grid gap-5">
                {[
                  ["Homeowners, buyers and sellers", "An inspection report says to have a structural engineer look at the foundation, or the insurer wants a letter on the roof's condition. You need one answer on letterhead, signed and sealed by a licensed engineer."],
                  ["Real estate agents and inspectors", "When the report recommends an engineer, the deal is waiting on a letter. Send your client here and add yourself as a copy, and you get the sealed letter when they do."],
                  ["Insurance agents and adjusters", "Roof condition letters for older roofs at new business or renewal, and WPI-8E evaluations for TWIA eligibility on the coast."],
                  ["Lenders and title companies", "Foundation certifications for manufactured home loans, and repair specifications when a lender wants the work defined before closing."],
                  ["Roofers, solar installers and builders", "Solar framing letters for the permit, structural letters answering a plan reviewer's comment, and repair scopes your crew can price from."],
                ].map(([t, b]) => (
                  <div key={t}>
                    <dt className="text-[16px] font-semibold text-slate">{t}</dt>
                    <dd className="mt-1 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">{b}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="min-w-0">
              <h2 className="text-[28px] font-semibold text-slate">What the letter looks like</h2>
              <figure className="mt-6 border border-[var(--color-limestone-line)] bg-white p-6">
                <p className="text-[12px] font-semibold text-[var(--color-ink-quiet)]">Sample</p>
                <p className="mt-2 text-[16px] font-semibold text-slate">254 Engineering</p>
                {address ? <p className="text-[13px] text-[var(--color-ink-quiet)]">{address}</p> : null}
                <p className="text-[13px] text-[var(--color-ink-quiet)]">{registrationLine()}</p>
                <dl className="mt-5 grid gap-3 text-[14px]">
                  <div><dt className="font-semibold text-slate">Property and purpose</dt><dd className="text-[var(--color-ink-quiet)]">The property, who asked for the letter and why, and the one question the engineer was asked to answer.</dd></div>
                  <div><dt className="font-semibold text-slate">What was observed</dt><dd className="text-[var(--color-ink-quiet)]">What the technician measured and photographed, in plain terms an underwriter or a buyer can follow.</dd></div>
                  <div><dt className="font-semibold text-slate">Opinion</dt><dd className="text-[var(--color-ink-quiet)]">A clear conclusion, signed and sealed by a Texas licensed Professional Engineer.</dd></div>
                </dl>
                <figcaption className="mt-5 text-[13px] text-[var(--color-ink-quiet)]">Layout only. Every letter is written for its own property.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section id="prices" className="bg-[var(--color-limestone)]">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6">
            <h2 className="text-[28px] font-semibold text-slate">Prices</h2>
            <p className="mt-3 max-w-[70ch] text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
              The price you see is what you pay for the letter. Two things can change it, and both are shown before you pay: a property in one of the 14 coastal counties, and travel outside San Antonio and the Coastal Bend.
            </p>
            <p className="mt-3 max-w-[70ch] text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
              If the engineer declines before anyone attends the property, you are refunded in full. What happens after a visit depends on the letter, and each letter&apos;s terms are shown in full before you pay. If nobody is there to let the technician in, there is a {money(TRIP_FEE_CENTS)} trip fee to come back.
            </p>
            {/* Reachable by keyboard when it scrolls at 390 (axe scrollable-region-focusable, contrast-audit). */}
            <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Prices by letter">
              <table className="w-full min-w-[520px] border-collapse bg-white text-left text-[15px]">
                <thead>
                  <tr className="border-b border-[var(--color-limestone-line)]">
                    <th scope="col" className="px-4 py-3 font-semibold text-slate">Letter</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate">Inland</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate">Coastal county</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((l) => (
                    <tr key={l.key} className="border-b border-[var(--color-limestone-line)]">
                      <th scope="row" className="px-4 py-3 font-normal text-slate">{l.name}</th>
                      {l.price.kind === "fixed" ? (
                        <>
                          <td className="px-4 py-3 text-[var(--color-ink)]">{l.price.inland}</td>
                          <td className="px-4 py-3 text-[var(--color-ink)]">{l.price.coastal ?? l.price.inland}</td>
                        </>
                      ) : l.price.kind === "hourly" ? (
                        <td colSpan={2} className="px-4 py-3 text-[var(--color-ink)]">{l.price.rate} an hour, fixed fee quoted first, {l.price.minimum} minimum</td>
                      ) : (
                        <td colSpan={2} className="px-4 py-3 text-[var(--color-ink)]">Quoted per matter</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[14px] text-[var(--color-ink-quiet)]">
              Coastal counties{coastalCharge ? ` (${coastalCharge} more)` : ""}: {counties}.
            </p>
          </div>
        </section>

        <section id="faq" className="bg-white">
          <div className="mx-auto w-full max-w-[880px] px-4 py-14 sm:px-6">
            <h2 className="text-[28px] font-semibold text-slate">Common questions</h2>
            {tel && phone ? (
              <p className="mt-2 text-[15px] text-[var(--color-ink-quiet)]">
                Don&apos;t see yours? Call the office at <a href={tel} className="whitespace-nowrap font-semibold text-slate underline underline-offset-2">{phone}</a>.
              </p>
            ) : null}
            <StartFaq
              items={[
                {
                  q: "How much does a letter cost?",
                  a: `Most letters are ${letters[0].price.kind === "fixed" ? letters[0].price.inland : ""}. The table above gives every letter's price${coastalCharge ? `, and properties in the 14 coastal counties add ${coastalCharge}` : ""}. Design work is billed by the hour against a fixed fee quoted up front.`,
                },
                {
                  q: "Who signs the letter?",
                  a: `The engineer of record, a Texas licensed Professional Engineer. The firm's registration is ${registrationLine()}, and you can look it up on the board's website.`,
                },
                {
                  q: "What if the engineer cannot certify it?",
                  a: `For a foundation certification, the engineer issues a sealed letter saying so and why, and that letter is the work you paid for. For the other letters, you are refunded everything except the ${inspectionFee ?? "inspection fee"} inspection and you receive what the engineer found and why. If the job is declined before anyone goes out, you are refunded in full. Each letter's terms are shown before you pay.`,
                },
                {
                  q: "Do I need to be at the property?",
                  a: `Someone has to let the technician in, and for a roof or attic, give access. It can be you, a tenant or your agent. If nobody is there at the agreed time, there is a ${money(TRIP_FEE_CENTS)} trip fee before the visit is booked again.`,
                },
                {
                  q: "Which areas do you cover?",
                  /* Q52, settled 2026-11-15 from Robert's statement of 13 November: the technicians are in San Antonio and Corpus Christi. */
                  a: "Field technicians work out of San Antonio and Corpus Christi. If the property is farther out, call before you order and the office will tell you whether travel applies and what it is.",
                },
                { q: "Can my agent or lender get a copy?", a: "Add them when you order. They get the sealed letter and nothing else from your order." },
                {
                  q: "Is this a home inspection?",
                  a: "No. A home inspector reports on the whole house. This is an engineer's opinion on one question, like the foundation or the roof, signed and sealed.",
                },
                {
                  q: "Can I talk to someone first?",
                  a: phone ? `Call ${phone}, any day from 8 AM to 8 PM Central, or leave your number in the price finder and the office calls you.` : "Leave your number in the price finder and the office calls you.",
                },
              ]}
            />
          </div>
        </section>

        <section className="bg-slate">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
            <p className="text-[24px] font-semibold text-white">See your price in 30 seconds, or call the office.</p>
            <div className="flex flex-wrap gap-3">
              <a href="#finder-title" className="inline-flex min-h-[52px] items-center bg-brass px-6 text-[16px] font-semibold text-[var(--color-slate-ink)]">
                Price your letter
              </a>
              {tel && phone ? (
                <a href={tel} className="inline-flex min-h-[52px] items-center whitespace-nowrap border border-white/40 px-6 text-[16px] font-semibold text-white">
                  {phone}
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--color-slate-deep)] text-[var(--color-slate-fg-footer)]">
        <div className="mx-auto grid w-full max-w-[1200px] gap-6 px-4 py-10 text-[14px] sm:px-6 md:grid-cols-3">
          <div>
            <p className="text-[16px] font-semibold text-white">254 Engineering</p>
            <p className="mt-2 leading-[1.65]">Foundation, roof, windstorm and structural letters for homeowners, agents, insurers, lenders and contractors. Every letter is signed and sealed by a Texas licensed Professional Engineer. Veteran owned.</p>
            {address ? <p className="mt-2">{address}</p> : null}
          </div>
          <div>
            <p className="font-semibold text-white">Talk to the office</p>
            {tel && phone ? (
              <a href={tel} className="mt-2 block whitespace-nowrap text-white">
                {phone}
              </a>
            ) : null}
            <p className="mt-1">Answered 8 AM to 8 PM Central, every day.</p>
            <a href={`mailto:${business.email}`} className="mt-1 block text-white">
              {business.email}
            </a>
          </div>
          <div>
            <p>{registrationLine()}. You can check the registration at pels.texas.gov.</p>
            <p className="mt-3 flex gap-4">
              <Link href="/privacy" prefetch={false} className="text-white underline underline-offset-2">Privacy</Link>
              <Link href="/terms" prefetch={false} className="text-white underline underline-offset-2">Terms</Link>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
