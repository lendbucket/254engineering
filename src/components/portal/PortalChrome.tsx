"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { NavItem } from "./nav";

/**
 * The interactive parts of the shell: the mobile drawer, the profile menu, the
 * notification panel, and the command palette.
 *
 * WHY ONLY THESE ARE A CLIENT COMPONENT
 * -------------------------------------
 * The layout itself stays a server component so the session, the profile, and
 * the navigation are resolved on the server and never round trip. What is
 * shipped to the browser is the handful of things that genuinely need a click:
 * two menus, a palette, and the active link highlight.
 *
 * The nav items arrive as props already filtered by the authorization matrix.
 * This component never decides what a person may see; it only decides what is
 * open right now.
 */

function Icon({ name, className = "" }: { name: NavItem["icon"] | "bell" | "search" | "menu" | "close"; className?: string }) {
  const common = {
    className,
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
    case "files":
      return <svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
    case "people":
      return <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8" /><path d="M17.5 20a5.5 5.5 0 0 0-2-4" /></svg>;
    case "review":
      return <svg {...common}><path d="M4 5h16v11H4z" /><path d="m8 20 4-4 4 4" /><path d="m8.5 10.5 2 2 4-4" /></svg>;
    case "jobs":
      return <svg {...common}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case "clients":
      return <svg {...common}><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-6h6v6" /></svg>;
    case "audit":
      return <svg {...common}><path d="M12 3v18" /><path d="M5 7h14" /><path d="M7 7 4 14h6z" /><path d="M17 7l-3 7h6z" /></svg>;
    case "profile":
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case "protocols":
      return <svg {...common}><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></svg>;
    case "tasks":
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10" /><path d="m17 17 2 2 3-4" /></svg>;
    case "messages":
      return <svg {...common}><path d="M4 5h16v11H9l-4 4z" /><path d="M8 9h8M8 12h5" /></svg>;
    case "charge":
      return <svg {...common}><path d="M7 4h10v16H7z" /><path d="M10 8.5h4M10 12h4M10 15.5h2" /></svg>;
    case "onboarding":
      return <svg {...common}><path d="M4 20a6 6 0 0 1 12 0" /><circle cx="10" cy="8" r="3.2" /><path d="M18 8v6M15 11h6" /></svg>;
    case "certification":
      return <svg {...common}><circle cx="12" cy="9.5" r="5.5" /><path d="m8.5 14.5-1 6.5 4.5-2.4 4.5 2.4-1-6.5" /></svg>;
    case "techs":
      return <svg {...common}><circle cx="12" cy="7" r="3.2" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /><path d="m19 3 1.6 1.6-3.2 3.2" /></svg>;
    case "documents":
      return <svg {...common}><path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M14 4v5h5" /><path d="M8 13h8M8 16.5h5" /></svg>;
    case "orders":
      return <svg {...common}><path d="M4 7.5 12 3.5l8 4v9L12 20.5l-8-4z" /><path d="M4 7.5 12 11.5l8-4M12 11.5v9" /></svg>;
    case "billing":
      return <svg {...common}><path d="M3 6h18v12H3z" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 12h.01M17.5 12h.01" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  }
}

export function PortalIcon({ name }: { name: NavItem["icon"] }) {
  return <Icon name={name} />;
}

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar links. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] items-center gap-3 rounded-[4px] px-3 text-[14px] font-semibold transition-colors ${
              active
                ? "bg-white/[0.14] text-slate-fg"
                : "text-slate-fg/70 hover:bg-white/[0.07] hover:text-slate-fg"
            }`}
          >
            <span className={active ? "text-brass-light" : "text-slate-fg/55"}>
              <Icon name={item.icon} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The mobile tab bar.
 *
 * Fixed to the bottom with the safe area inset added to its padding, because on
 * a notched phone a bar that stops at the viewport edge puts its labels under
 * the home indicator. Every target is at least 44px tall before padding.
 */
export function MobileTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Portal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-slate-deep pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold ${
                  active ? "text-brass-light" : "text-slate-fg/65"
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

/** The profile menu, and the sign out that goes with it. */
export function ProfileMenu({
  displayName,
  roleLabel,
  email,
}: {
  displayName: string;
  roleLabel: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await fetch("/api/portal/session", { method: "DELETE" });
    router.push("/portal/login");
    router.refresh();
  }

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-[4px] px-2 text-slate-fg hover:bg-white/[0.08]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brass text-[12px] font-bold text-slate-ink">
          {initials || "?"}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] leading-tight font-semibold">{displayName}</span>
          <span className="block text-[11px] leading-tight text-slate-fg/60">{roleLabel}</span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[260px] rounded-[4px] border border-limestone-line bg-white p-2 shadow-[0_18px_40px_rgba(11,26,48,0.22)]"
        >
          <div className="border-b border-limestone-line px-3 pt-2 pb-3">
            <p className="text-[13px] font-semibold text-slate">{displayName}</p>
            <p className="mt-0.5 text-[12px] break-all text-slate-muted">{email}</p>
            <p className="mt-1 text-[11px] font-bold tracking-[0.1em] text-brass-ink uppercase">{roleLabel}</p>
          </div>
          <Link
            href="/portal/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-[44px] items-center rounded-[3px] px-3 text-[14px] font-semibold text-slate hover:bg-limestone"
          >
            Your profile and password
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex min-h-[44px] w-full items-center rounded-[3px] px-3 text-left text-[14px] font-semibold text-slate hover:bg-limestone"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The notification bell and its panel. */
export function NotificationBell({
  unread,
  items,
}: {
  unread: number;
  items: {
    id: string;
    title: string;
    body: string | null;
    href: string | null;
    created_at: string;
    read: boolean;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Opening the panel marks everything read.
   *
   * Not clicking an item: somebody who opens the bell, reads four titles and
   * decides none of them need action has read them, and leaving the badge at
   * four teaches them the badge means nothing. The rows keep their own read_at
   * either way, so nothing is lost.
   */
  useEffect(() => {
    if (!open || seen) return;
    setSeen(true);
    void fetch("/api/portal/comms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", ids: [] }),
    }).catch(() => undefined);
  }, [open, seen]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid h-11 w-11 place-items-center rounded-[4px] text-slate-fg hover:bg-white/[0.08]"
      >
        <Icon name="bell" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brass px-1 text-[10px] font-bold text-slate-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        /*
         * Fixed to the viewport on a phone, absolute to the bell above it.
         *
         * Anchored to the bell alone, right-0 measures from the BELL's right
         * edge, and the bell is not the rightmost thing in the header: the menu
         * button and the avatar sit to its right. At 390 that put the panel's
         * left edge at -62px, with the first sixty pixels of every notification
         * off the screen.
         *
         * mobile-overflow-audit could not catch it. The panel is clipped rather
         * than widening the document, so scrollWidth still equalled clientWidth
         * and the page was, by that measure, fine. Found by opening the bell in
         * a screenshot and reading the titles.
         */
        <div className="fixed inset-x-4 top-[calc(60px+env(safe-area-inset-top))] z-50 rounded-[4px] border border-limestone-line bg-white shadow-[0_18px_40px_rgba(11,26,48,0.22)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[340px]">
          <p className="border-b border-limestone-line px-4 py-3 text-[12px] font-bold tracking-[0.12em] text-brass-ink uppercase">
            Notifications
          </p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-[14px] leading-[1.6] text-slate-muted">
              Nothing yet. Job offers, review requests, and deadline reminders arrive here.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-limestone-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-limestone ${
                      n.read ? "" : "border-l-[3px] border-l-brass"
                    }`}
                  >
                    <p className="text-[14px] font-semibold text-slate">{n.title}</p>
                    {n.body ? <p className="mt-1 text-[13px] leading-[1.55] text-slate-muted">{n.body}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The command palette.
 *
 * Opens on Ctrl+K or Cmd+K and on the search button. It navigates to the routes
 * this person is allowed to reach, and it says plainly that searching clients
 * and files arrives with Phase 1 rather than pretending to search and returning
 * nothing, which reads as broken.
 */
export function CommandPalette({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  const matches = items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-h-[40px] items-center gap-2 rounded-[4px] border border-white/15 px-3 text-[13px] text-slate-fg/70 hover:border-white/30 hover:text-slate-fg lg:flex"
      >
        <Icon name="search" />
        <span>Search</span>
        <kbd className="ml-2 rounded-[3px] border border-white/20 px-1.5 py-0.5 text-[11px]">Ctrl K</kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] bg-slate-abyss/60 p-4 pt-[12vh]"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Command palette"
            className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[4px] border border-limestone-line bg-white shadow-[0_24px_60px_rgba(11,26,48,0.35)]"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Go to..."
              aria-label="Go to"
              className="w-full border-b border-limestone-line px-4 py-4 text-[16px] text-slate outline-none"
            />
            <ul className="max-h-[50vh] overflow-y-auto py-1">
              {matches.map((item) => (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-[14px] font-semibold text-slate hover:bg-limestone"
                  >
                    <span className="text-brass-ink">
                      <Icon name={item.icon} />
                    </span>
                    {item.label}
                  </button>
                </li>
              ))}
              {matches.length === 0 ? (
                <li className="px-4 py-4 text-[14px] text-slate-muted">Nothing here matches that.</li>
              ) : null}
            </ul>
            <p className="border-t border-limestone-line bg-limestone px-4 py-3 text-[12px] leading-[1.5] text-slate-muted">
              Navigation only for now. Searching clients and files starts when there are clients and
              files, in the next phase.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The mobile drawer trigger, for the routes that do not fit the tab bar. */
export function MobileMore({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="More"
        className="grid h-11 w-11 place-items-center rounded-[4px] text-slate-fg hover:bg-white/[0.08] lg:hidden"
      >
        <Icon name="menu" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] bg-slate-abyss/60 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[8px] bg-white pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-limestone-line px-4 py-3">
              <p className="text-[12px] font-bold tracking-[0.12em] text-brass-ink uppercase">More</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-11 w-11 place-items-center text-slate"
              >
                <Icon name="close" />
              </button>
            </div>
            <ul className="p-2">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-[52px] items-center gap-3 rounded-[3px] px-3 text-[15px] font-semibold text-slate hover:bg-limestone"
                  >
                    <span className="text-brass-ink">
                      <Icon name={item.icon} />
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
