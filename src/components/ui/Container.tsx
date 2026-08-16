import type { ReactNode } from "react";

/**
 * The one measure on the site.
 *
 * A single container width is most of what makes a page feel gridded rather than
 * assembled. Padding starts at 20px because 16 is where a 320px phone starts
 * feeling like a form and not a document.
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
  const max = width === "prose" ? "max-w-3xl" : width === "wide" ? "max-w-7xl" : "max-w-6xl";
  return <div className={`mx-auto w-full ${max} px-5 sm:px-8 ${className}`}>{children}</div>;
}
