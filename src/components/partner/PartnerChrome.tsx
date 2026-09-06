"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The partner portal's chrome.
 *
 * WHY THIS IS NOT PortalChrome
 * ----------------------------
 * The staff chrome derives its navigation from the authorization matrix: every
 * NavItem names an Action and the shell asks the same `can()` the route handler
 * asks. A partner has no role and must never appear in that system, so a
 * partner nav built from NavItem would either need a fake role or a widened
 * matrix, and both are worse than a second component.
 *
 * What IS shared is the design system the native standard is written about, and
 * the two data attributes the audit looks for: `data-portal-scroll` on the
 * scrolling region and `data-portal-tabs` on the bar. Sharing those means the
 * same checks measure both surfaces, which is the point of having a standard
 * rather than a house style.
 */

export type PartnerNavItem = { href: string; label: string; short: string; icon: IconName };

export const PARTNER_NAV: PartnerNavItem[] = [
  { href: "/partner", label: "Overview", short: "Home", icon: "home" },
  { href: "/partner/referrals", label: "Referrals", short: "Referrals", icon: "referrals" },
  { href: "/partner/statements", label: "Statements", short: "Statements", icon: "statements" },
  { href: "/partner/materials", label: "Materials", short: "Materials", icon: "materials" },
  { href: "/partner/agreement", label: "Agreement", short: "Agreement", icon: "agreement" },
];

type IconName = "home" | "referrals" | "statements" | "materials" | "agreement";

function isActive(pathname: string, href: string): boolean {
  if (href === "/partner") return pathname === "/partner";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1Z" />
      </svg>
    );
  }
  if (name === "referrals") {
    return (
      <svg {...common}>
        <path d="M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M3 16.5c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5" />
        <path d="M13.5 6.5h3.5M15.25 4.75v3.5" />
      </svg>
    );
  }
  if (name === "materials") {
    return (
      <svg {...common}>
        <path d="M4 4.5h8v11H4Z" />
        <path d="M7 3h9v11" />
        <path d="M6.5 8h3M6.5 11h3" />
      </svg>
    );
  }
  if (name === "statements") {
    return (
      <svg {...common}>
        <path d="M5 2.5h10v15l-2.5-1.5L10 17.5 7.5 16 5 17.5Z" />
        <path d="M7.5 6.5h5M7.5 9.5h5M7.5 12.5h3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 2.5h7l3 3v12H5Z" />
      <path d="M12 2.5v3h3" />
      <path d="M7.5 11.5l1.5 1.5 3.5-3.5" />
    </svg>
  );
}

/**
 * The bottom bar on a phone. Five destinations, which is the cap.
 *
 * The staff tab bar holds at most five and puts the rest behind a More sheet.
 * This surface has exactly five, so there is nothing to overflow and no sheet.
 * A sixth destination would mean building that sheet rather than squeezing a
 * sixth 11px label into a 390px bar, and native-audit asserts the tab bar
 * carries every destination the wide layout does, so it fails on the day
 * somebody adds one and forgets.
 */
export function PartnerTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Partner"
      data-portal-tabs
      className="z-40 shrink-0 border-t border-white/12 bg-[var(--navy)] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {PARTNER_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 border-t-[var(--active-bar-width)] px-1 py-2 text-[11px] font-semibold ${
                  active
                    ? "border-t-[var(--gold)] text-[var(--gold-bright)] active:bg-white/[0.12]"
                    : "border-t-transparent text-white/65 active:bg-white/[0.12]"
                }`}
              >
                <Icon name={item.icon} />
                <span className="leading-none">{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The same five destinations across the top at lg, instead of a rail.
 *
 * The staff portal has a 230px fixed rail because it has twenty screens and
 * three roles. This surface has five screens and one kind of person, and a rail
 * carrying five links would be 230px of navy explaining that there is not much
 * here. Point 9 of the standard is satisfied by construction: both layouts are
 * built from PARTNER_NAV, so nothing can exist on one and not the other.
 */
export function PartnerTopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Partner sections" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {PARTNER_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] px-3 text-[13.5px] font-semibold active:bg-[var(--navy)]/[0.08] ${
                  active ? "bg-[var(--navy)]/[0.06] text-[var(--navy)]" : "text-[var(--secondary)]"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Who is signed in, and the way out.
 *
 * A menu rather than a bare button, because the email address is worth showing:
 * a partner organisation can have several people, and knowing which one this
 * browser is signed in as is the difference between "my figures are wrong" and
 * "I am looking at this as somebody else".
 */
export function PartnerIdentity({
  organisation,
  displayName,
  email,
}: {
  organisation: string;
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    await fetch("/api/partner/session", { method: "DELETE" }).catch(() => {});
    router.push("/partner/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-[var(--tap-target)] items-center gap-2 rounded-[var(--radius-control)] px-2 text-[13.5px] font-semibold text-white active:bg-white/[0.12] lg:text-[var(--navy)] lg:active:bg-[var(--navy)]/[0.08]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--gold)] text-[12px] font-bold text-[var(--navy)]">
          {organisation.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{displayName}</span>
      </button>

      {open ? (
        <>
          {/* A full screen catcher, so a tap anywhere closes it on a touch screen. */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-[min(88vw,280px)] rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-panel)]"
          >
            <p className="text-[13.5px] font-bold text-[var(--navy)]">{organisation}</p>
            <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">{email}</p>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="mt-3 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 text-[13.5px] font-semibold text-[var(--ink)] active:bg-[var(--canvas)] disabled:opacity-45"
            >
              {busy ? "Signing out" : "Sign out"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
