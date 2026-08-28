import type { ReactNode } from "react";

/**
 * The one measure on the site.
 *
 * A single container width is most of what makes a page feel gridded rather than
 * assembled.
 *
 * 1200px and a fluid gutter come from the approved v5 design, which sets
 * `max-width: 1200px` with `padding: clamp(16px, 4vw, 28px)` on every section
 * without exception. The previous values were max-w-6xl at 1152px with a stepped
 * px-5 / px-8 gutter, which is close enough to look similar and far enough to
 * make every section on a rebuilt page sit 24px narrower than the reference.
 */
export function Container({
  children,
  className = "",
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  /** `prose` is the reading measure for long documents: terms, privacy, articles. */
  width?: "default" | "prose" | "wide";
}) {
  const max =
    width === "prose" ? "max-w-3xl" : width === "wide" ? "max-w-7xl" : "max-w-[1200px]";
  return (
    <div className={`mx-auto w-full ${max} px-[clamp(1rem,4vw,1.75rem)] ${className}`}>
      {children}
    </div>
  );
}
