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
  /*
   * ADDED 2026-10-29. Robert, 13:11 and 22:12 Central: Corpus Christi is a
   * highlighted market, linked from the main navigation, the home page and
   * /coverage, until its office address is set.
   */
  { href: "/corpus-christi", label: "Corpus Christi" },
  { href: "/government", label: "Government" },
  { href: "/insights", label: "Insights" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
] as const;

/*
 * THE ROOFER PARTNER APPLICATION, IN THE NAVIGATION BUT NOT IN THE BAR.
 * Robert, 2026-11-05: "Every page and call to action that suits a contractor
 * gets a clear link to the application, and so does the site navigation."
 *
 * The bar holds nine links and, as measured on 2026-10-29, leaves 70px spare at
 * 1280 and 14px at 1024; a tenth overruns a row that does not wrap. So this one
 * link sits in the header's right hand block on a desk, in the mobile sheet
 * after the nine, and in the footer, which reach every page without moving the
 * bar. Defined once here so the three cannot disagree.
 */
export const partnerLink = { href: "/roofing-partners", label: "Roofing partners" } as const;
