import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The admin chrome.
 *
 * INTERIOR PARITY, APPLIED LIGHTLY
 * --------------------------------
 * On the token system and nothing more. Navy bar, Archivo headings, the card
 * chrome, the gold accent, the 44px targets. What it deliberately does not take
 * from the public site is the composition: no alternating bands, no oversized
 * display moments, no hero. Those devices exist to hold a stranger's attention
 * through an argument, and this is a tool used by one person who already knows
 * why they opened it. Rhythm here would be decoration on a workbench.
 *
 * Density is the point instead. A table that shows thirty rows without scrolling
 * is worth more to the operator than a section that breathes.
 */

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/onboarding", label: "Onboarding" },
] as const;

export function AdminShell({
  title,
  lede,
  children,
  actions,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-limestone">
      <header className="bg-slate">
        <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-1 gap-y-2 px-[clamp(1rem,4vw,1.75rem)]">
          <span className="mr-4 py-3 font-display text-[15px] font-bold tracking-[0.02em] text-slate-fg">
            254 Admin
          </span>
          <nav aria-label="Admin" className="flex flex-wrap items-stretch">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[44px] items-center px-3 text-[14px] font-semibold text-slate-fg-muted transition-colors hover:text-slate-fg"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/admin/logout" method="post" className="ml-auto">
            <button
              type="submit"
              className="flex min-h-[44px] items-center px-3 text-[14px] font-semibold text-slate-fg-dim transition-colors hover:text-brass-light"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] px-[clamp(1rem,4vw,1.75rem)] py-[clamp(24px,4vw,44px)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold tracking-[-0.01em] text-slate">
              {title}
            </h1>
            {lede ? (
              <p className="mt-2 max-w-[70ch] text-[15px] leading-[1.65] text-slate-muted">{lede}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}

/** The card chrome, matching the public site so the two do not look unrelated. */
export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white ${className}`}
    >
      {title ? (
        <h2 className="border-b border-limestone-line px-5 py-3.5 font-display text-[15px] font-bold text-slate">
          {title}
        </h2>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * A table that scrolls inside itself.
 *
 * `scroll-x` is the utility from globals.css: overflow-x auto, contained
 * overscroll, momentum. A wide table is the one thing on this portal that
 * genuinely cannot fit a phone, and containing it is what keeps
 * mobile-overflow-audit honest rather than making the document drag sideways.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-x -mx-5 px-5">
      <table className="w-full min-w-[640px] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-limestone-line py-2.5 pr-4 text-[11.5px] font-bold tracking-[0.1em] text-brass-ink uppercase">
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <td className={`border-b border-limestone-line py-3 pr-4 align-top text-[14px] text-ink ${className}`}>
      {children}
    </td>
  );
}

/** A status chip. Colour carries meaning and the word repeats it. */
export function Chip({ status }: { status: string }) {
  const tone =
    status === "accepted" || status === "complete" || status === "verified"
      ? "border-[#1c6b45]/35 bg-[#e7f4ec] text-[#125433]"
      : status === "rejected"
        ? "border-[#8d2b2b]/35 bg-[#fbeceb] text-[#8d2b2b]"
        : status === "uploaded" || status === "submitted"
          ? "border-brass-ink/35 bg-brass-tint text-brass-ink"
          : "border-limestone-line bg-limestone text-slate-muted";
  return (
    <span
      className={`inline-block rounded-[2px] border px-2 py-[3px] text-[11.5px] font-bold tracking-[0.06em] uppercase ${tone}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
