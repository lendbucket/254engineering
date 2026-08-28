"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";

/**
 * The mobile apply bar, which gets out of the way once you are applying.
 *
 * WHY IT HIDES ITSELF
 * -------------------
 * The bar exists so that somebody reading a long role description does not have
 * to scroll back to find the form. Once the form is on screen that job is done,
 * and the bar becomes a control pointing at the thing directly behind it while
 * covering about sixty pixels of a small screen. On the licensure step of a five
 * step application that is a field's worth of space spent on a button that
 * scrolls you to where you already are.
 *
 * So it watches the apply section and steps aside when it appears. That is the
 * standing rule stated plainly: a sticky element never overlaps the content it
 * is about.
 *
 * WHY IntersectionObserver AND NOT A SCROLL HANDLER
 * -------------------------------------------------
 * A scroll listener runs on the main thread on every frame of every scroll, on
 * the phones this is meant to feel good on. The observer fires twice: once when
 * the form appears and once when it leaves. It also degrades honestly: if the
 * script never runs, the bar simply stays visible, which is the behaviour that
 * shipped before this component existed.
 *
 * The element is removed from the flow rather than faded, because a transparent
 * bar still swallows the taps aimed at whatever is behind it.
 */
export function StickyApply({ targetId, label }: { targetId: string; label: string }) {
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setHidden(e.isIntersecting);
      },
      // A sliver is enough. Waiting for the whole form would keep the bar up
      // through most of a tall step.
      { threshold: 0, rootMargin: "0px 0px -25% 0px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [targetId]);

  if (hidden) return null;

  return (
    <div
      ref={ref}
      className="pb-safe sticky bottom-0 z-40 border-t border-limestone-line bg-limestone-raised/95 backdrop-blur md:hidden"
    >
      <Container>
        <div className="pt-3">
          <a
            href={`#${targetId}`}
            className="flex min-h-[48px] w-full items-center justify-center rounded-[3px] bg-brass px-6 font-sans text-[16px] font-bold text-slate-ink transition-colors hover:bg-brass-light"
          >
            {label}
          </a>
        </div>
      </Container>
    </div>
  );
}
