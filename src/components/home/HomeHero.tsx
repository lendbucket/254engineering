import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { TexasCountyMap } from "@/components/map/TexasCountyMap";
import { modelSentence } from "@/content/model-copy";
import { isPrelaunch } from "@/lib/launch";
import { headlineOffer } from "@/lib/ordering";
import { displayPhone, telHref } from "@/config/contact";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { PhoneNumber } from "@/components/ui/PhoneNumber";

/**
 * The hero, as the approved v5 design sets it.
 *
 * A three stop navy gradient, a gold outlined status pill, the headline with
 * "254 counties" carried in gold, a lede, two calls to action, and the county
 * map to the right. A hairline closes the band and a stat rail sits under it.
 *
 * THE MAP IS THE REPO'S, NOT A PICTURE OF ONE
 * -------------------------------------------
 * v5 leaves `{{ heroMapDark }}` as a placeholder. What fills it is the existing
 * component: 254 county paths derived from public domain Census geometry, with
 * region borders computed from the same assignment the coverage lists use and a
 * fingerprint that fails the build if the two drift apart. Its data integrity
 * guards are untouched by this workstream.
 *
 * NO TYPE SITS ON AN IMAGE HERE
 * -----------------------------
 * The previous hero put a photograph behind the headline and needed a measured
 * scrim to stay legible. v5 uses a flat gradient instead, so every pairing in
 * this band is two known colours and contrast is a fixed number rather than a
 * function of what is in a picture. That is a simplification worth naming: it is
 * why this hero needs no image contrast reasoning at all.
 *
 * THE STAT RAIL COUNTS REAL THINGS
 * --------------------------------
 * 254, 8, and 9 are read from the coverage and services data rather than typed,
 * so a region or a service line added tomorrow cannot leave the homepage stating
 * a number the rest of the site disagrees with.
 */
export function HomeHero() {
  const prelaunch = isPrelaunch();
  const countyCount = regions.reduce((sum, r) => sum + r.counties.length, 0);
  const offer = headlineOffer();

  return (
    <section id="top" className="overflow-hidden bg-gradient-to-b from-slate via-slate-deep to-slate-abyss text-slate-fg">
      <Container>
        <div className="flex flex-wrap items-center gap-[clamp(36px,5vw,80px)] pt-[clamp(52px,7vw,96px)]">
          <div className="flex-1 basis-[400px]">
            {prelaunch ? (
              <span className="inline-block rounded-[2px] border border-brass/65 px-3.5 py-[7px] text-[12px] font-bold tracking-[0.14em] text-brass-light uppercase">
                Taking enquiries
              </span>
            ) : null}

            {/* text-slate-fg is explicit and must stay. globals.css sets a
                colour on h1 through h4 at the base layer, and a declaration on
                the element beats an inherited one, so a heading on a dark band
                that relies on inheriting from its section renders navy on navy.
                That is exactly what happened here on the first render. */}
            {/*
              THE H1, RULED BY THE OPERATOR 2026-09-18 FROM THREE OPTIONS.

              "Structural Engineering Across Texas, on a Written Protocol."

              His reasoning, which is a better rule than the choice: the protocol
              is the only differentiator a competitor cannot copy by writing a
              sentence, and it is true today. He refused a headline promising the
              firm answers the phone, because the first missed call makes it
              false and that puts the firm's honesty in the hands of its
              staffing. He refused a safe one for saying nothing.

              It leads with the primary term from the SEO revision, "structural
              engineer", which is 18,000 a month at difficulty 0 and the largest
              cluster on this site by a wide margin, and it reads as a sentence
              rather than a keyword string.

              SUPERSEDED 2026-10-10 by the operator's approval of the search
              appearance table: the H1 leads with the homepage title's keyword,
              "Texas Engineering Firm", and keeps the written protocol as its
              second half, which is the part of the 2026-09-18 reasoning that
              survives. The original is kept above so the change reads as a
              ruling rather than an accident.
            */}
            <h1 className="mt-[22px] max-w-[20ch] font-display text-[clamp(34px,5vw,56px)] leading-[1.12] font-bold tracking-[-0.015em] text-slate-fg">
              Texas Engineering Firm,{" "}
              <span className="text-brass-light">Structural Work on a Written Protocol</span>
            </h1>

            <p className="mt-[22px] max-w-[56ch] text-[clamp(16px,1.9vw,18.5px)] leading-[1.7] text-slate-fg-muted">
              {/*
                The approved copy's opening, close to verbatim. It states the
                problem in the buyer's words before it states the firm's answer,
                which is the order the copy document uses throughout.

                The second sentence is the gate aware model sentence rather than
                a literal, because it is the one that has to change when a
                protocol is approved and sealing begins.
              */}
              You need a sealed letter from a licensed engineer, for a closing, a permit, or an
              insurer. {modelSentence()}
            </p>

            {/*
              THE CALLS TO ACTION THE OPERATOR RULED: "Start a job" is the verb,
              the telephone is on every page because half these buyers would
              rather talk, and "See pricing" goes to the page that publishes the
              numbers. Never a waitlist.

              MOBILE FIRST: the row wraps, and each button carries its own
              padding rather than relying on a grid, so at 390 they stack as
              three full width targets instead of two and a half.
            */}
            {/*
              THE PRIMARY BUTTON IS THE ORDER, AND THE PRICE IS ON IT.
              Operator ruling, 2026-10-03, instruction 1.

              It was "Start a job" to /contact. The firm has been open for
              ordering with one line and the most prominent control on the site
              asked for a message instead, which is the finding that started this
              whole piece of work.

              NOTHING HERE NAMES THE ROOF, THE $549 OR THE $75. `headlineOffer()`
              returns the cheapest line that is listed, protocol approved and
              behind an open gate, and the button takes its name and its figures
              from the catalogue entry. A hero is the single worst place in this
              repository to type a price: CLAUDE.md records the site publishing
              $549 while a card was charged $600, and that was in a FILE whose
              header claimed the two could not drift. A button is read by more
              people than that file ever was.

              WITH THE GATE SHUT IT FALLS BACK rather than disappearing. There is
              no order to offer, so the button offers the chooser and says so, and
              the price line is simply absent because there is nothing to charge.
            */}
            <div className="mt-[34px] flex flex-wrap gap-3">
              <Link
                href={offer ? offer.href : "/order"}
                className="inline-block rounded-[3px] bg-brass px-8 py-4 text-[16px] font-bold text-slate-ink shadow-[0_6px_18px_rgba(217,160,50,0.3)] transition-colors hover:bg-brass-light"
              >
                {offer ? offer.orderLabel : "Start a job"}
              </Link>
              {telHref() && displayPhone() ? (
                <a
                  href={telHref() ?? undefined}
                  className="inline-block rounded-[3px] border-[1.5px] border-white/50 px-8 py-4 text-[16px] font-semibold text-slate-fg transition-colors hover:border-brass hover:text-brass-light"
                >
                  Call <PhoneNumber />
                </a>
              ) : null}
              <Link
                href="/process"
                className="inline-block rounded-[3px] border-[1.5px] border-white/50 px-8 py-4 text-[16px] font-semibold text-slate-fg transition-colors hover:border-brass hover:text-brass-light"
              >
                See pricing
              </Link>
            </div>

            {/*
              THE PRICE, PLAINLY, UNDER THE BUTTON IT BELONGS TO. Operator
              ruling, 2026-10-03, instruction 1: "with the price shown plainly".

              Not on the button face. A figure inside a button competes with the
              verb and wraps badly at 390, and this reader is often on a phone.
              Under it, at body size, it reads as a fact about the thing above
              rather than as decoration.

              THE COASTAL LINE IS NAMED SEPARATELY, never folded into the first
              figure. That is the operator's ruling of 2026-09-02 about this
              surcharge, and it holds on every surface that shows it: a reader in
              Nueces pays it and a reader in Houston does not, and one blended
              number would be wrong for both of them.

              Absent entirely when there is nothing orderable, because a price
              with no purchase behind it is a claim about a thing you cannot buy.
            */}
            {offer?.price ? (
              <p className="mt-4 text-[15px] leading-[1.7] text-slate-fg-muted">
                <span className="font-semibold text-slate-fg">{offer.price}</span>
                {offer.coastal ? `, ${offer.coastal}` : ""}.
              </p>
            ) : null}
          </div>

          <div className="mx-auto flex w-full max-w-[460px] flex-1 basis-[300px] flex-col items-center self-end">
            <div className="w-full max-w-[400px]">
              <TexasCountyMap tone="dark" shared="define" />
            </div>
          </div>
        </div>
      </Container>

      <div className="mt-[clamp(36px,5vw,56px)] border-t border-white/[0.16]">
        <Container>
          <dl className="flex flex-wrap gap-x-[clamp(28px,6vw,88px)] gap-y-6 py-[clamp(20px,3vw,28px)]">
            {/*
              "at launch" came off on 2026-09-18. It was prelaunch language
              describing a future state, and the firm is trading. The number is
              still derived from the coverage data rather than typed.
            */}
            <Stat figure={countyCount} label="Texas counties served" />
            <Stat figure={regions.length} label="Service regions" />
            {/*
              "8 Sealed service lines" came off on 2026-10-03. Operator ruling:
              it suggests all eight can be ordered today, and one can.

              It was also the regulated word doing the most work on the page.
              "Sealed" is load bearing in Texas, and eight of them read as a claim
              that the firm is sealing eight lines when it is sealing one.

              AND A FOURTH STAT COUNTING THE OPEN LINES WAS BUILT AND THEN REMOVED
              THE SAME DAY, on his ruling: "Advertising the count of orderable
              lines tells visitors 7 of 8 are not."

              He is right, and it is a good correction to record rather than
              quietly obey. The figure was true and derived, which is what made it
              feel safe to add. What it actually did was invite a subtraction: a
              reader who sees 8 beside 1 has been handed the other 7 as a fact
              about what this firm cannot do today, on the first screen.

              The rail is three stats again. The alternative he allowed was a fact
              already declared elsewhere in the codebase, and the only candidates
              are about windstorm counties, which would be a number doing duty as
              a filler in a row about scale. Nothing was invented to fill the gap.
            */}
            <Stat figure={services.length} label="Engineering service lines" />
          </dl>
        </Container>
      </div>
    </section>
  );
}

function Stat({ figure, label }: { figure: number; label: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="sr-only">{label}</dt>
      <dd className="flex items-baseline gap-3">
        <span className="font-display text-[clamp(28px,3vw,36px)] leading-none font-extrabold tabular-nums text-slate-fg">
          {figure}
        </span>
        <span className="text-[14px] font-semibold text-slate-fg-dim">{label}</span>
      </dd>
    </div>
  );
}
