/**
 * The primary navigation, defined once.
 *
 * The desktop bar, the mobile sheet, and the footer column all read this, so a
 * page that gains a place in the navigation gains it everywhere at once. The
 * order is the order a procurement officer reads the firm in: who it is, what it
 * does, where it works, then how to engage it.
 */
export const primaryNav = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  /*
   * ADDED 2026-09-18. The process page is where a first time buyer finds out
   * what they are actually buying, and it sits immediately after Services
   * because that is the order the question arrives in: what do you do, then how
   * do you do it. The operator ruled it a confirmed page rather than an
   * optional one.
   */
  { href: "/process", label: "How it works" },
  { href: "/coverage", label: "Coverage" },
  { href: "/government", label: "Government" },
  { href: "/insights", label: "Insights" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
] as const;
