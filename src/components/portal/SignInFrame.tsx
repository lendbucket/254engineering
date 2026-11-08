import { Wordmark } from "@/components/brand/Wordmark";

/**
 * THE ONE SIGN-IN LAYOUT, for staff (/portal/login), customers (/account/login)
 * and partners (/partner/login), and the two reset information pages. Robert,
 * 2026-11-08: "serious enterprise software"; a split layout at desktop width,
 * a deep navy panel on the left with the logo in white and one short plain line
 * about what the portal is for, the form on white on the right; on a phone, the
 * panel becomes a slim header with the logo and the form fills the screen. Calm
 * and quiet: no illustration, no gradient, no decorative icon, no marketing
 * copy. Gold only as a thin accent. The portal's own tokens (answer 4).
 *
 * PRESENTATION ONLY. Each page keeps its own guard, its own notices and its own
 * form, unchanged in what they do; this only places them. The page's noindex
 * comes from its layout's metadata and is untouched. No restricted-mode notice
 * sits here, on Robert's answer 3.
 *
 * THE WORDMARK IS A RASTER LOCKUP whose descriptor is part of the artwork, so
 * its height decides whether "ENGINEERING SERVICES" can be read. The account
 * page's own history records 28 rendering it as a smear; the first capture of
 * this layout at 28 and 48 showed the same, so it is 40 on a phone and 72 at
 * desktop width.
 */
export function SignInFrame({ purpose, children }: { purpose: string; children: React.ReactNode }) {
  return (
    <main className="portal-surface min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-[var(--navy)] text-[var(--on-navy)]">
        {/* On a phone: a slim header with the logo, nothing else. */}
        <div className="flex min-h-[64px] items-center px-5 lg:hidden">
          <Wordmark onDark height={40} priority />
        </div>
        {/* At desktop width: the logo, a thin gold rule and the one line. */}
        <div className="hidden h-full flex-col px-14 py-14 lg:flex">
          <Wordmark onDark height={72} priority />
          <div aria-hidden className="mt-10 h-[2px] w-12 bg-[var(--gold)]" />
          <p className="mt-6 max-w-[36ch] font-display text-[24px] leading-[1.3] font-semibold">{purpose}</p>
        </div>
      </aside>

      <section className="flex min-h-[calc(100dvh-64px)] items-start justify-center px-5 py-10 sm:items-center lg:min-h-dvh lg:px-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </section>
    </main>
  );
}

/** The heading every sign-in form carries, and nothing else above it. */
export function SignInHeading() {
  return <h1 className="font-display text-[24px] leading-[1.25] font-bold text-[var(--navy)]">Sign in</h1>;
}
