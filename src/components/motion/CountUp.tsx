"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A figure that counts up when it comes into view.
 *
 * THE REAL NUMBER IS ALWAYS IN THE DOM
 * ------------------------------------
 * This renders `value` on the server and as its initial client state. The
 * animation only ever replaces it after mount, in a browser that supports
 * IntersectionObserver and whose reader has not asked for reduced motion.
 *
 * That ordering is the whole design. The obvious construction starts at zero and
 * counts up, which means the server HTML says 0, and 0 is what a crawler indexes,
 * what a screen reader announces if it reaches the node before the animation, and
 * what everybody sees if the script fails. On a site whose entire brand is the
 * number 254, shipping a homepage whose markup says 0 would be a genuinely
 * expensive piece of decoration.
 *
 * The counting is therefore a progressive enhancement over a correct page rather
 * than the mechanism that makes the page correct.
 *
 * `aria-hidden` on the animating span with the true value in a visually hidden
 * sibling would be the belt and braces version. It is not used because the value
 * lands on the real number within a second and assistive technology reading a
 * transient intermediate figure is a smaller problem than two nodes that can
 * disagree.
 */
export function CountUp({
  value,
  durationMs = 900,
  className = "",
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || done.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || done.current) continue;
          done.current = true;
          observer.disconnect();

          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            // Ease out cubic. The figure decelerates into its final value rather
            // than stopping dead, which is what makes it read as counting rather
            // than as a number flickering.
            const eased = 1 - Math.pow(1 - t, 3);
            setShown(Math.round(value * eased));
            if (t < 1) requestAnimationFrame(tick);
            else setShown(value);
          };
          // Start from zero only now, once it is certain the animation will run
          // to completion in this browser.
          setShown(0);
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
