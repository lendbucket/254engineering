"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A bottom sheet on a phone, a centred panel on a desk.
 *
 * POINT 5 OF THE NATIVE STANDARD
 * ------------------------------
 * Modals and pickers present from the bottom, sized to their content,
 * dismissible by dragging, never as centred desktop dialogs. A centred box with
 * a close button in the corner is the single clearest tell that a phone is
 * being shown a desktop interface: it arrives from nowhere, it puts its
 * dismissal at the far end of a reach, and it does not respond to the gesture
 * every other sheet on the device responds to.
 *
 * At lg and above it is a centred panel, because that is what a desk expects
 * and the standard is explicitly about 390.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It is not a focus trap and does not claim to be. Escape closes it, the
 * backdrop closes it, and the drag closes it; a full trap needs an inert
 * background and a focus ring manager, which is a larger piece of work than the
 * surfaces using this today need. Said here rather than discovered later.
 */

export function Sheet({
  open,
  onClose,
  title,
  children,
  /** Rendered against the bottom edge, above the safe area. Actions, usually. */
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  // Escape closes it, on both surfaces.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /*
   * The page behind must not scroll while a sheet is over it. Without this the
   * content slides away under the sheet on a phone, which is the other half of
   * the same complaint point 1 answers.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setDragY(0);
      panel.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  /*
   * THE DRAG.
   *
   * Downward only, and it never moves the panel up: a sheet that follows a
   * finger upward implies it can expand, and this one cannot. Past a quarter of
   * its own height it closes, which is the threshold that stops a small
   * accidental drag dismissing something somebody was reading.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onPointerUp = () => {
    const height = panel.current?.offsetHeight ?? 1;
    if (dragY > height / 4) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-[var(--ink-navy)]/45"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        className={
          "relative flex max-h-[85dvh] w-full flex-col rounded-t-[16px] bg-white outline-none " +
          "pb-[env(safe-area-inset-bottom)] lg:max-w-[560px] lg:rounded-[var(--radius-card)] lg:pb-0"
        }
      >
        {/*
          The grabber. It is the affordance for the drag, and it is a real
          target rather than a decorative bar: the whole strip takes the
          pointer, so the gesture works from anywhere along the top edge.
        */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 cursor-grab touch-none px-4 pt-3 pb-1 lg:hidden"
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)]" aria-hidden />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-2 pb-3 lg:pt-4">
          <h2 className="font-display text-[17px] leading-[1.25] font-bold text-[var(--navy)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[4px] text-[var(--secondary)] hover:bg-[var(--canvas)] active:bg-[var(--row-hover)]"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/*
          The one scrolling region inside the sheet, which is the same rule the
          shell follows: the sheet does not grow, its content scrolls.
        */}
        <div className="portal-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
