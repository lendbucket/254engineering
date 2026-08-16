"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { primaryNav } from "./nav";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * The mobile navigation sheet.
 *
 * Three behaviours are load bearing and each is asserted by
 * scripts/mobile-audit.ts: it opens, it locks the body while open, and it closes
 * on navigation with the lock released. The third one is the one that breaks
 * silently. App Router navigation does not unmount this component, so a sheet
 * that only closes in its own click handler stays open when the browser back
 * button changes the route, and the body stays locked behind it on a page the
 * user can no longer scroll.
 *
 * Closing on `pathname` change rather than on click is what covers both.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-slate"
      >
        <span aria-hidden="true" className="relative block h-[13px] w-6">
          <span className="absolute inset-x-0 top-0 h-px bg-current" />
          <span className="absolute inset-x-0 top-1.5 h-px bg-current" />
          <span className="absolute inset-x-0 top-3 h-px bg-current" />
        </span>
      </button>

      {open ? (
        <div
          data-testid="mobile-menu"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-limestone"
        >
          <div className="flex items-center justify-between border-b border-limestone-line px-5 py-4">
            <Wordmark />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-slate"
            >
              <span aria-hidden="true" className="relative block h-5 w-5">
                <span className="absolute top-1/2 left-0 h-px w-full rotate-45 bg-current" />
                <span className="absolute top-1/2 left-0 h-px w-full -rotate-45 bg-current" />
              </span>
            </button>
          </div>

          <nav aria-label="Primary" className="px-5 py-4">
            <ul>
              {primaryNav.map((item) => (
                <li key={item.href} className="border-b border-limestone-line/70">
                  <Link
                    href={item.href}
                    className="block py-4 font-display text-xl font-semibold text-slate"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
