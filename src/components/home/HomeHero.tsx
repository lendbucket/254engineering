import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { TexasCountyMap } from "@/components/map/TexasCountyMap";
import { modelSentence } from "@/content/model-copy";
import { isPrelaunch } from "@/lib/launch";
import { services } from "@/content/services";
import { regions } from "@/content/regions";

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

  return (
    <section id="top" className="overflow-hidden bg-gradient-to-b from-slate via-slate-deep to-slate-abyss text-slate-fg">
      <Container>
        <div className="flex flex-wrap items-center gap-[clamp(36px,5vw,80px)] pt-[clamp(52px,7vw,96px)]">
          <div className="flex-1 basis-[400px]">
            {prelaunch ? (
              <span className="inline-block rounded-[2px] border border-brass/65 px-3.5 py-[7px] text-[12px] font-bold tracking-[0.14em] text-brass-light uppercase">
                Opening soon
              </span>
            ) : null}

            {/* text-slate-fg is explicit and must stay. globals.css sets a
                colour on h1 through h4 at the base layer, and a declaration on
                the element beats an inherited one, so a heading on a dark band
                that relies on inheriting from its section renders navy on navy.
                That is exactly what happened here on the first render. */}
            <h1 className="mt-[22px] max-w-[20ch] font-display text-[clamp(34px,5vw,56px)] leading-[1.12] font-bold tracking-[-0.015em] text-slate-fg">
              One firm for all <span className="text-brass-light">254 counties</span> of Texas
            </h1>

            <p className="mt-[22px] max-w-[56ch] text-[clamp(16px,1.9vw,18.5px)] leading-[1.7] text-slate-fg-muted">
              {/* v5's opening sentence, then the gate aware model sentence. The
                  second half is not hardcoded because it is the sentence that has
                  to change when the registration issues. */}
              254 Engineering Services is named for the 254 counties of Texas, every one of which it
              will serve. {modelSentence()}
            </p>

            <div className="mt-[34px] flex flex-wrap gap-3">
              <Link
                href={prelaunch ? "/waitlist" : "/contact"}
                className="inline-block rounded-[3px] bg-brass px-8 py-4 text-[16px] font-bold text-slate-ink shadow-[0_6px_18px_rgba(217,160,50,0.3)] transition-colors hover:bg-brass-light"
              >
                {prelaunch ? "Join the Waitlist" : "Contact the Firm"}
              </Link>
              <Link
                href="/services"
                className="inline-block rounded-[3px] border-[1.5px] border-white/50 px-8 py-4 text-[16px] font-semibold text-slate-fg transition-colors hover:border-brass hover:text-brass-light"
              >
                Explore Services
              </Link>
            </div>
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
            <Stat figure={countyCount} label="Texas counties served at launch" />
            <Stat figure={regions.length} label="Service regions" />
            <Stat figure={services.length} label="Sealed service lines" />
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
