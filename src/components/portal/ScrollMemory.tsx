"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The scrolling region remembers where each screen was.
 *
 * POINT 8 OF THE NATIVE STANDARD, SECOND HALF
 * -------------------------------------------
 * "A list that can grow renders a bounded number of rows, and its scroll
 * position survives navigating away and back." The bounded half has been
 * asserted since Phase 11 by a visible row count. This is the other half, and
 * until now it was asserted by nothing and implemented by nothing.
 *
 * WHY IT HAS TO BE WRITTEN AT ALL
 * -------------------------------
 * Point 1 made the DOCUMENT stop scrolling and gave the scrolling job to one
 * element between the fixed chrome. A browser restores document scroll on a
 * back navigation for free; it does not restore an element's scrollTop, and
 * that element survives the route change because it lives in the layout. So the
 * default is the opposite of correct: going back lands at the top of a list
 * somebody was halfway down.
 *
 * WHAT IT DOES
 * ------------
 * Forward navigation puts the region at the top, because that is what opening a
 * screen means. Back and forward restore what that screen had. Nothing else
 * touches it.
 *
 * WHERE THE POSITION IS READ, AND THE MEASUREMENT THAT MOVED IT
 * -------------------------------------------------------------
 * The obvious place to save the outgoing screen's position is the effect that
 * notices the pathname changed. The first version did exactly that, and it
 * recorded 24px for a screen that was sitting at 400px.
 *
 * The router gets there first. Next's ScrollAndFocusHandler runs during commit
 * and calls scrollIntoView on the incoming segment, and the nearest scrollable
 * ancestor of that segment is this region, so by the time any passive effect
 * runs the position is already gone. It is not a race that sometimes loses. It
 * loses every time, and it produced a component that looked right, a
 * sessionStorage entry that looked populated, and a restored position that was
 * the router's leftover padding offset.
 *
 * So the position is read when a navigation is ASKED FOR rather than after one
 * happened: a capture phase click, which runs before the link's own handler,
 * and popstate, which fires before React re-renders. Both are moments when the
 * region still holds what the person was looking at.
 *
 * That is this repository's recurring defect one more time. The effect was not
 * broken. It was reading the right property of the right element at a moment
 * when the value no longer meant what it was being asked to mean.
 *
 * WHY sessionStorage AND NOT A REF
 * --------------------------------
 * A ref dies on a full page load, and the portal does one on every sign in and
 * whenever a server action redirects. Session storage is per tab and cleared
 * when the tab closes, which is exactly the lifetime of "where I was", and it
 * is not shared with another tab where the same operator is looking at a
 * different file. Every access is wrapped: a browser with site data blocked
 * throws on read, and a portal that fails to render because it could not
 * remember a scroll position would be a worse defect than the one being fixed.
 */

const KEY = "portal-scroll-position";

function regionOf(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-portal-scroll]");
}

function read(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function write(positions: Record<string, number>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(positions));
  } catch {
    /* A browser that will not store it still has to render the portal. */
  }
}

export function ScrollMemory() {
  const pathname = usePathname();

  /*
   * The screen the region is currently showing, readable from a listener that
   * was attached once. It is updated in the effect below rather than during
   * render, which is both what React asks for and soon enough: a click or a
   * popstate is a human action, and effects for a navigation have flushed long
   * before the next one arrives.
   */
  const here = useRef(pathname);

  const camePopped = useRef(false);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const remember = () => {
      const region = regionOf();
      if (!region) return;
      const positions = read();
      positions[here.current] = region.scrollTop;
      write(positions);
    };

    const onPop = () => {
      /*
       * Before the position is destroyed, in this order deliberately: React has
       * not re-rendered yet, so `here` is still the screen being left.
       */
      remember();
      camePopped.current = true;
    };

    /*
     * Capture, so it runs before the link's own handler and before the router
     * is told anything. Every navigation inside the portal begins with a click:
     * a Link, a button that pushes, a row that opens a file. A click that
     * navigates nowhere costs one read of scrollTop and one small write.
     */
    document.addEventListener("click", remember, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", remember, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    /*
     * First, and before any early return: the listeners attached above read
     * this to know which screen a position belongs to, and a region that has
     * not rendered yet is no reason for them to keep naming the last one.
     */
    here.current = pathname;

    const region = regionOf();
    if (!region) return;

    const moved = previous.current !== null && previous.current !== pathname;
    previous.current = pathname;

    if (camePopped.current) {
      camePopped.current = false;
      const remembered = read()[pathname];
      if (typeof remembered !== "number") return;

      /*
       * A frame later, and then again until it takes, because the incoming
       * screen's content decides how far the region can scroll and it is not in
       * the DOM yet. Setting scrollTop against a short region clamps it to the
       * bottom of what is there, which looks like the position was lost.
       *
       * Every portal route is force-dynamic, so coming back refetches the
       * screen rather than reading a cache. It retries until the position is
       * reached or roughly a second has passed, whichever comes first, and it
       * stops the moment it takes.
       *
       * It gives up rather than looping, because the remembered position can be
       * genuinely unreachable now: a row was removed while the operator was on
       * another screen and the list is shorter. Landing at the bottom of a
       * shorter list is the right answer there, and a loop that never settles
       * would fight the person's own scrolling for as long as they stayed.
       */
      let cancelled = false;
      const until = Date.now() + 1000;
      const stop = () => {
        cancelled = true;
      };
      region.addEventListener("wheel", stop, { passive: true });
      region.addEventListener("touchstart", stop, { passive: true });

      const restore = () => {
        if (cancelled) return;
        region.scrollTop = remembered;
        if (region.scrollTop < remembered - 1 && Date.now() < until) {
          requestAnimationFrame(restore);
          return;
        }
        stop();
      };
      requestAnimationFrame(restore);

      return () => {
        cancelled = true;
        region.removeEventListener("wheel", stop);
        region.removeEventListener("touchstart", stop);
      };
    }

    if (moved) {
      /*
       * Forward navigation. Not on the first render, which is why this is
       * guarded: a full page load already starts at the top, and scrolling to
       * zero there would fight a browser restoring a position of its own.
       *
       * The router has already brought the incoming segment into view, which
       * leaves the region a couple of dozen pixels down rather than at the top.
       * This is what makes opening a screen mean the top of it.
       */
      region.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}
