import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { registrationLine } from "@/lib/launch";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

/**
 * The account home.
 *
 * Deliberately thin in this increment: it proves the boundary works end to end
 * and nothing more. Bulk ordering, saved properties, API keys and statements are
 * the increments that follow, and shipping empty shells for them now would be
 * four screens that look finished and are not.
 */
export default async function AccountHomePage() {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  return (
    /*
     * ===================================================================
     * RESTYLED TO DESIGN V10, 2026-09-29. PRESENTATION ONLY.
     * ===================================================================
     *
     * THERE IS NO CUSTOMER DASHBOARD IN THE DESIGN SET, and that is why this
     * screen is styled from the system rather than from a drawing.
     * V10A-dashboard is the OPERATIONS overview, a staff screen with a navy
     * sidebar, revenue figures and a technician table, and building any of it
     * here would put the firm's money in front of a buyer.
     *
     * So what is applied is V10's rules, not V10's admin layout: no boxes,
     * hairline rules between sections, a quiet uppercase label, and the
     * palette's ink rather than the portal's navy. The same header and footer
     * as the sign in and sign up screens, so the three read as one surface.
     */
    <div className="v10-phone-ground flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" prefetch={false} aria-label="254 Engineering, home">
            {/* v5's header rule as CSS. See the note on /account/login. */}
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" />
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[68ch] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        {/* The title block is one section on a phone, V10 rule 7, 2026-10-08. */}
        <div>
          <p className={LABEL}>Your account</p>
          <h1 className="mt-2.5 text-[clamp(1.75rem,3vw,2.1rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
            {me.displayName}
          </h1>
          <p className="mt-2 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
            Signed in as <span className="v10-email">{me.email}</span>.{" "}
            {me.account.billingMode === "invoice"
              ? `This account is invoiced, on ${me.account.netDays} day terms.`
              : "This account pays by card at the time of ordering."}
          </p>
        </div>

        {/*
          The three cards become three ruled sections. V10 rule 1: the border
          around a card carries no information that the whitespace and the rule
          between sections do not already carry.

          THE RULE GOES UNDER THE HEADING, 2px AND IN INK. Operator correction,
          2026-09-30: I had put a hairline ABOVE each section, which separates
          sections from each other. V10's rule sits UNDER the heading, in ink at
          2px, which does something different: it binds the heading to the
          content beneath it and gives the section a head rather than a fence.
          Presentation only, so it is aligned to the spec rather than raised.
        */}
        <section className="mt-12">
          <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">
            Order for several properties
          </h2>
          <p className="mt-2 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
            One submission, one payment, and each property becomes its own file. You see which the
            firm can take and which it cannot, with the reason, before anything is charged.
          </p>
          <Link
            href="/account/order"
            className="mt-5 inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--color-slate)] px-6 text-[15px] font-semibold text-white"
          >
            Start a submission
          </Link>
        </section>

        {/*
          THE LINK THAT WAS MISSING, 2026-10-01.

          The operator opened this page and asked where the list of orders was.
          There was none, and there was no link to one, while
          /account/orders/[reference] had existed since the bulk work: a customer
          could read ONE order if they already held its reference and had no way
          to find the reference. The screen answering "what have I bought from
          you" was the one screen missing, and the only way to notice was to look
          at the page as a person rather than to check it.
        */}
        <section className="mt-11">
          <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">
            Your orders
          </h2>
          <p className="mt-2 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
            Everything this account has ordered, newest first, with where each one
            has got to. Orders you placed with this email address before the
            account existed are here too.
          </p>
          <Link
            href="/account/orders"
            className="mt-4 inline-flex min-h-[var(--tap-target)] items-center text-[15px] font-semibold text-[var(--color-link)]"
          >
            See your orders
          </Link>
        </section>

        <section className="mt-11">
          <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">
            Settings
          </h2>
          <p className="mt-2 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
            The billing contact, the standing access instructions that go onto every order, and the
            properties you order against repeatedly.
          </p>
          <Link
            href="/account/settings"
            className="mt-4 inline-flex min-h-[var(--tap-target)] items-center text-[15px] font-semibold text-[var(--color-link)]"
          >
            Open settings
          </Link>
        </section>

        {me.account.billingMode === "invoice" ? (
          <section className="mt-11">
            <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">
              Statements
            </h2>
            <p className="mt-2 text-[15px] leading-[1.65] text-[var(--color-ink-quiet)]">
              What has been billed, what is still to be billed, and paying an outstanding statement.
            </p>
            <Link
              href="/account/statements"
              className="mt-4 inline-flex min-h-[var(--tap-target)] items-center text-[15px] font-semibold text-[var(--color-link)]"
            >
              Open statements
            </Link>
          </section>
        ) : null}
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

/*
 * V10's section label. Gold is an accent and never text on a light surface.
 *
 * The uppercase lives in the `.v10-label` class in globals.css rather than in
 * an `uppercase` utility here, because token-audit forbids the utility for an
 * accessibility reason: a CSS transform makes the DOM disagree with the screen.
 * The portal resolves the same tension the same way, with `.portal-kicker`.
 */
const LABEL = "v10-label";
