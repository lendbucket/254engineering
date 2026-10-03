import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { currentCustomer } from "@/lib/customer-auth";
import { customerSessionConfigured } from "@/lib/customer-session";
import { deliverablePriceCents } from "@/config/prices";
import { deliverablesFor } from "@data/catalog";
import { money } from "@/lib/ops-money";
import { displayPhone, telHref } from "@/config/contact";
import { registrationLine, selfServiceSignUpOpen } from "@/lib/launch";
import { AccountLoginForm } from "./AccountLoginForm";
import { PhoneNumber } from "@/components/ui/PhoneNumber";

export const dynamic = "force-dynamic";

/**
 * Where an ordering account signs in.
 *
 * `next` is validated here as well as in the proxy. An open redirect out of a
 * sign in is a phishing primitive, and the rule is the same one the portal
 * uses: it must be a path on this site and it must be inside /account, because
 * a customer has no business being sent to a portal route after signing in.
 *
 * ===========================================================================
 * RESTYLED TO DESIGN V10, 2026-09-29. PRESENTATION ONLY.
 * ===========================================================================
 *
 * WHAT DID NOT CHANGE, AND THAT IS THE POINT. The form still takes an email and
 * a password and nothing else. The design shows three affordances this platform
 * does not have, a sign in link, a keep me signed in checkbox and a forgot
 * password link, and the operator ruled on 2026-09-29 that stage 1 is look only:
 * where a design shows a behaviour the product lacks, today's behaviour is kept
 * and styled. Those three are listed for a follow up branch and are deliberately
 * absent here rather than rendered as dead controls.
 *
 * WHAT CHANGED IS THE SHAPE. V10 rule 1: no boxes. This screen was a centred
 * card with a border, a brass top edge and a rounded corner, on a grey ground.
 * It is now two columns on white, a heading with content beneath it, separated
 * by whitespace and a single vertical rule.
 *
 * EVERY FIGURE ON THIS PAGE IS DERIVED. The design's right column carries a
 * price, and prices in this repository have one home. They had two once, and
 * every one of them disagreed: the site published $549 for a roof inspection
 * while a card was charged $600. So the headline comes from
 * `deliverablePriceCents` and the surcharge from the catalogue entry that the
 * order flow itself charges, and if either is absent the sentence is absent
 * rather than approximate.
 *
 * THE TELEPHONE IS DERIVED TOO, and it is absent until there is a number. The
 * design shows one in the header. `displayPhone()` returns null while
 * FIRM_PHONE is unset, and a sign in page that prints a placeholder number is
 * the placeholder-audit failure this firm already refuses everywhere else.
 */
export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const existing = await currentCustomer();
  if (existing) redirect("/account");

  const { next } = await searchParams;
  const safeNext = typeof next === "string" && /^\/account(\/|$)/.test(next) ? next : "/account";

  /*
   * The offered line's own figures, read rather than typed.
   *
   * `deliverablesFor` is the catalogue, whose priceCents is filled FROM the
   * price book so the two cannot disagree. The surcharge is on the same entry
   * and is the one the order flow adds for a first tier coastal county.
   */
  const roof = deliverablesFor("roof-inspections")[0] ?? null;
  const roofPriceCents = deliverablePriceCents("roof-inspections", roof?.tier ?? "standard");
  const surchargeCents = roof?.coastalSurchargeCents ?? null;
  const phone = displayPhone();

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/*
        The header bar. White with a hairline under it, as the design draws it
        for the signed out screens. The navy bar with the gold rule is the
        SIGNED IN shell and belongs to the screens that have a left nav, so
        putting it here would promise a portal the reader is not in yet.
      */}
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="254 Engineering Services, home">
            {/*
              THE v5 HEADER RULE, AND IT TOOK THREE GOES TO GET RIGHT.

              The mark is a raster lockup with a fixed aspect, so height alone
              drives it and "ENGINEERING SERVICES" is part of the artwork rather
              than live text. My restyle set this to 28, which renders the whole
              lockup 55 wide and the descriptor as an illegible smear. Nothing in
              the code could show that: the component was correct, the aspect was
              correct, the typecheck was clean and 59 audits were green. It was
              found by opening the capture.

              40 was the second go, and it was BETTER AND STILL WRONG. Measured
              from the browser on 2026-09-30 it rendered 78.36 by 40 at both
              widths, against a spec of 84 at 1280 and 58 at 390: short by 44 and
              by 18. A fixed number cannot satisfy a clamp, and eyeballing a
              capture cannot tell 78 from 84, which is why the operator asked for
              the measurement rather than another screenshot.

              So it is the rule itself, as CSS. `height` stays at the clamp's
              maximum because that is the source size Next must prepare: asking
              for less is how a mark ends up upscaled and soft at the wide end.
            */}
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" priority />
          </Link>
          {phone ? (
            <p className="text-[14px] text-[var(--color-ink-quiet)]">
              Questions?{" "}
              <a href={telHref() ?? undefined} className="text-[var(--color-slate)]">
                <PhoneNumber />
              </a>
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,420px)_1px_minmax(0,1fr)] lg:gap-14">
          {/* ------------------------------------------------------ sign in */}
          <section>
            <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
              Sign in
            </h1>
            <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
              For organizations that order regularly. If you placed a single order, the link emailed
              to you opens it without signing in.
            </p>

            {customerSessionConfigured() ? (
              <div className="mt-7">
                <AccountLoginForm next={safeNext} />
              </div>
            ) : (
              /*
                V10 forbids tinted boxes and status colour. This was a tinted
                warning panel; it is now a plain line with weight, which is how
                the design shows every piece of status.
              */
              <p className="mt-7 text-[15px] leading-[1.6] font-semibold text-[var(--color-ink)]">
                Accounts are not available on this deployment yet.
              </p>
            )}

            {/*
              THE DESIGN OFFERS THIS AND THE ROUTE EXISTS, so showing it is
              presentation rather than a new capability. What would be a change
              is offering it when the door is shut.

              `selfServiceSignUpOpen()` is the product's own answer, and it needs
              BOTH the operator's clearance and the gate to be open, which is the
              2026-09-24 ruling that clearing the flag early must not put public
              sign up live on a firm that is not taking orders. Reading it here
              means this link cannot invite somebody through a door that refuses.
            */}
            {selfServiceSignUpOpen() ? (
              <p className="mt-8 text-[14px] text-[var(--color-ink-quiet)]">
                New here?{" "}
                <Link
                  href="/account/sign-up"
                  prefetch={false}
                  className="font-semibold text-[var(--color-link)]"
                >
                  Create an account
                </Link>
              </p>
            ) : null}

            <p className="mt-4 text-[14px] text-[var(--color-ink-quiet)]">
              {/*
                Not prefetched, and deliberately. A viewport Link prefetches its
                target's payload, and "/" carries the lead form, which validates
                with the whole of zod in the browser. This one link cost the sign in
                screen 112KB, measured 2026-09-15 at 431KB against 319KB for the
                staff and partner screens, which have no link at all. The link still
                navigates; it just stops paying for the homepage before anybody
                clicks it.
              */}
              <Link href="/" prefetch={false} className="text-[var(--color-link)] underline underline-offset-2">
                Back to the site
              </Link>
            </p>
          </section>

          {/* The rule between the columns. A 1px line, not a border on a box. */}
          <div aria-hidden className="hidden bg-[var(--color-limestone-line)] lg:block" />

          {/* -------------------------------------------- how ordering works */}
          <section>
            {/*
              IT DESCRIBES, IT DOES NOT INVITE. `portal-voice-audit` caught this
              heading reading "Order a roof certification", which is a present
              tense service claim under a gate that is shut: the firm is not
              taking orders, and a signed out screen inviting one is the exact
              misstatement section 1 exists to prevent.

              I wrote it during stage 1 while restyling, which is the hazard
              this repository records about design imports. A drawing is made
              against a description of the platform, and V10 draws a customer
              surface for a firm that is open. Restyling is not supposed to
              introduce copy, and this did.

              The column below is a description of how the work is done, so the
              heading now says that and nothing more.
            */}
            <h2 className="v10-label">
              How a roof certification works
            </h2>
            <ol className="mt-5 space-y-6">
              <li className="flex gap-4">
                <span className="text-[15px] font-semibold text-[var(--color-slate)]">1</span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--color-ink)]">Order online</p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
                    Enter the address and the details the protocol asks for.
                    {roofPriceCents !== null ? ` ${money(roofPriceCents)}` : ""}
                    {roofPriceCents !== null && surchargeCents !== null
                      ? `, plus ${money(surchargeCents)} in first tier coastal counties.`
                      : roofPriceCents !== null
                        ? "."
                        : ""}
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="text-[15px] font-semibold text-[var(--color-slate)]">2</span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--color-ink)]">We visit</p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
                    A trained technician photographs the roof under the firm&rsquo;s written
                    protocol.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="text-[15px] font-semibold text-[var(--color-slate)]">3</span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--color-ink)]">
                    An engineer decides
                  </p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
                    A Texas licensed professional engineer reviews every photograph and records a
                    decision. You can follow each step in your account. We email you when it is
                    issued.
                  </p>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </main>

      <footer className="border-t border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-[var(--color-ink-quiet)] sm:px-6">
          {/* Derived from the board's own record. Never typed. */}
          <p>{registrationLine()}</p>
          <nav className="flex gap-5">
            <Link href="/terms" prefetch={false} className="text-[var(--color-link)]">
              Terms
            </Link>
            <Link href="/privacy" prefetch={false} className="text-[var(--color-link)]">
              Privacy
            </Link>
            <Link href="/contact" prefetch={false} className="text-[var(--color-link)]">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
