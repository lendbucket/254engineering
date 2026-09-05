"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A bottom anchored composer that the keyboard cannot cover.
 *
 * POINT 7 OF THE NATIVE STANDARD
 * ------------------------------
 * A focused input is never covered by the keyboard, the composer moves with it,
 * and inputs are at least 16px so focusing one never zooms the viewport.
 *
 * The 16px half was already met everywhere in this portal. This is the other
 * half, and it is built before Section 3 because the messaging centre is the
 * surface that needs it and building it there would mean building it in a
 * hurry.
 *
 * WHY visualViewport AND NOT A RESIZE LISTENER
 * --------------------------------------------
 * On iOS the software keyboard does not resize the layout viewport. window
 * height does not change, resize does not fire, and 100dvh keeps reporting the
 * full screen, so a bar positioned against the bottom sits underneath the
 * keyboard with the input the person is typing into hidden behind it. That is
 * the single most common way a web application announces itself as one.
 *
 * visualViewport reports what is actually visible. The offset below is the gap
 * between the bottom of the layout viewport and the bottom of the visual one,
 * which is the keyboard's height when a keyboard is up and zero otherwise.
 *
 * The fallback when the API is absent is to sit at the bottom and do nothing,
 * which is exactly today's behaviour rather than something worse.
 */
export function KeyboardAwareComposer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [lift, setLift] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!vv) return;

    const measure = () => {
      /*
       * Rounded, and floored at zero. Sub pixel values here produce a bar that
       * jitters by a fraction on every scroll event, and a negative value on
       * an overscroll would drag the composer off the bottom of the screen.
       */
      const gap = window.innerHeight - (vv.height + vv.offsetTop);
      setLift(Math.max(0, Math.round(gap)));
    };

    /*
     * Coalesced into a frame. visualViewport fires resize and scroll together
     * and often, and setting state on every one of them is what makes a
     * keyboard animation stutter.
     */
    const onChange = () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(measure);
    };

    measure();
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, []);

  return (
    <div
      data-portal-composer
      style={lift ? { transform: `translateY(-${lift}px)` } : undefined}
      className={
        "sticky bottom-0 z-20 border-t border-[var(--border)] bg-white " +
        "pb-[env(safe-area-inset-bottom)] " +
        className
      }
    >
      {/*
        The safe area padding is dropped while the keyboard is up, because the
        home indicator is not on screen then and the inset would leave a band of
        white between the composer and the keyboard.
      */}
      <div className={lift ? "pb-0" : ""}>{children}</div>
    </div>
  );
}
