import type { Action, LicensedAction } from "@/lib/ops-authz";

/**
 * The portal's navigation, derived from the authorization matrix.
 *
 * WHY NAV IS DERIVED AND NOT LISTED PER ROLE
 * ------------------------------------------
 * A hand written nav per role is a second authorization model, and the two drift.
 * The first time they drift, a link appears for somebody who is then denied when
 * they click it, which reads as a broken product rather than a locked door.
 *
 * Each destination names the action that gates it. The shell asks the same
 * `can()` the route handler asks, so a link exists exactly when the thing behind
 * it is permitted. Adding a route means adding an action, which means deciding
 * who has it, which is the decision that should be hard to skip.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Short label for the mobile tab bar, where space is real. */
  short: string;
  /*
   * Either kind, because a MENU needs to know which screens exist and two of
   * them are the engineer's. Widening this does not widen a grant: a role's
   * grants are Action[] and cannot hold a licensed action, which
   * scripts/proofs/licensed-actions-are-unrepresentable.ts asserts at compile
   * time including this exact case.
   *
   * navFor takes one predicate that answers for both, so the menu asks the same
   * question the screen behind it asks.
   */
  action: Action | LicensedAction;
  /** Shown in the bottom tab bar on a phone. At most five, by design. */
  primary?: boolean;
  icon:
    | "home" | "files" | "people" | "review" | "jobs" | "clients" | "audit"
    | "profile" | "protocols" | "techs" | "onboarding" | "certification" | "charge"
    | "tasks" | "messages" | "documents" | "billing" | "orders" | "accounts" | "queue" | "status" | "pay"
    | "intake" | "roles" | "partners" | "applications";
};

export const NAV: NavItem[] = [
  { href: "/portal", label: "Dashboard", short: "Home", action: "files.list", primary: true, icon: "home" },
  {
    /*
     * THE TELEPHONE CALL PATH, and it sits second on purpose.
     *
     * Phase 10 Section 1. The firm's primary intake is somebody ringing up, and
     * until this existed an administrator could open an unpriced file and
     * nothing else. Putting it behind a menu would be the platform disagreeing
     * with how the firm actually gets work.
     *
     * One NAV entry gives the sidebar, the mobile tab bar and the command
     * palette, because all three are built from this list. The files screen
     * links to it separately, since that is where somebody already looking at
     * work would reach for it.
     *
     * files.create rather than a permission of its own: taking a job IS opening
     * a file, and the difference is how much is known at the time.
     */
    href: "/portal/intake",
    label: "New job",
    short: "New",
    action: "files.create",
    primary: true,
    icon: "intake",
  },
  { href: "/portal/jobs", label: "My jobs", short: "Jobs", action: "offers.list_own", primary: true, icon: "jobs" },
  {
    // A technician's own gate status. Primary on a phone, because "why am I not
    // getting work" is the question this screen exists to answer and hiding it
    // behind a menu is how somebody spends a week assuming the platform is quiet.
    href: "/portal/certification",
    label: "Certification",
    short: "Certs",
    action: "evidence.capture",
    primary: true,
    icon: "certification",
  },
  {
    // A technician who cannot see what they have earned asks by text message.
    // Primary on a phone for the same reason Certification is: it answers a
    // question somebody has on a driveway, not at a desk.
    href: "/portal/pay",
    label: "Your pay",
    short: "Pay",
    action: "ledger.read_own",
    icon: "pay",
  },
  { href: "/portal/review", label: "Review queue", short: "Review", action: "review.queue", primary: true, icon: "review" },
  {
    // An engineer's own regulatory record. Their licence stands on it, so it is
    // one tap away rather than behind a menu.
    href: "/portal/charge-log",
    label: "Responsible charge",
    short: "Charge",
    action: "responsible_charge.read_own",
    icon: "charge",
  },
  { href: "/portal/tasks", label: "Tasks", short: "Tasks", action: "tasks.use", primary: true, icon: "tasks" },
  { href: "/portal/messages", label: "Messages", short: "Chat", action: "messages.use", primary: true, icon: "messages" },
  { href: "/portal/files", label: "Files", short: "Files", action: "files.list", primary: true, icon: "files" },
  { href: "/portal/documents", label: "Documents", short: "Docs", action: "documents.read", icon: "documents" },
  { href: "/portal/orders", label: "Orders", short: "Orders", action: "payments.reconcile", icon: "orders" },
  { href: "/portal/accounts", label: "Accounts", short: "Accts", action: "accounts.manage", icon: "accounts" },
  { href: "/portal/partners", label: "Partners", short: "Partners", action: "partners.manage", icon: "partners" },
  { href: "/portal/billing", label: "Billing", short: "Money", action: "billing.read", icon: "billing" },
  /*
   * Reports, gated on reports.production rather than reports.revenue.
   *
   * A nav item carries ONE action and the screen behind it allows any of four,
   * so the item has to name the one every report reading role holds. Admin
   * holds all four and the engineer holds production alone, so production is
   * the intersection. Naming revenue here would have hidden the link from the
   * engineer while leaving the page reachable by URL, which is the shape of a
   * screen somebody finds by accident.
   *
   * reporting-audit fails if a role ever holds a report grant without holding
   * this one, so the intersection cannot silently stop being one.
   */
  { href: "/portal/reports", label: "Reports", short: "Reports", action: "reports.production", icon: "billing" },
  /*
   * The marketing suppression list. Reachable for customer service, which is
   * the role the request actually arrives at, and for an administrator.
   *
   * It is in the menu rather than buried on a settings screen because the whole
   * reason it exists is that somebody on a telephone call needs to record what
   * they were just told, while the person is still on the line. A screen that
   * takes three clicks to find is a screen where the request gets written on
   * paper instead.
   */
  { href: "/portal/suppressions", label: "Do not contact", short: "Do not", action: "suppressions.manage", icon: "messages" },
  { href: "/portal/clients", label: "Clients", short: "Clients", action: "clients.list", icon: "clients" },
  { href: "/portal/protocols", label: "Protocols", short: "Specs", action: "protocols.author", icon: "protocols" },
  { href: "/portal/techs", label: "Technicians", short: "Techs", action: "profiles.list", icon: "techs" },
  { href: "/portal/onboarding", label: "Onboarding", short: "Onboard", action: "profiles.create", icon: "onboarding" },
  {
    /*
     * The hiring pipeline, moved here from /admin when that surface was deleted.
     * Gated on profiles.create, because the person who reads an application is
     * the person who invites the successful one.
     */
    href: "/portal/applications",
    label: "Applications",
    short: "Apps",
    action: "profiles.create",
    icon: "applications",
  },
  { href: "/portal/people", label: "People", short: "People", action: "profiles.list", primary: true, icon: "people" },
  { href: "/portal/queue", label: "Job queue", short: "Queue", action: "jobs.manage", icon: "queue" },
  { href: "/portal/status", label: "Platform status", short: "Status", action: "jobs.manage", icon: "status" },
  {
    /*
     * What stands between the firm and live. Beside platform status because
     * both answer "what is the state of this thing", and gated on roles.manage
     * rather than jobs.manage because deciding the firm may trade is the
     * administrator's act rather than the operator's.
     *
     * The status icon is reused deliberately. A new glyph for a screen that is
     * read a handful of times before launch and then never again is a cost the
     * icon set does not need to carry.
     */
    href: "/portal/launch",
    label: "Launch readiness",
    short: "Launch",
    action: "roles.manage",
    icon: "status",
  },
  { href: "/portal/audit", label: "Audit trail", short: "Audit", action: "audit.read", icon: "audit" },
  {
    /*
     * Who may do what. Below the audit trail because it is consulted rarely and
     * changed rarely, and above the profile because it is the firm's rather
     * than one person's.
     */
    href: "/portal/roles",
    label: "Roles",
    short: "Roles",
    action: "roles.manage",
    icon: "roles",
  },
  { href: "/portal/profile", label: "Your profile", short: "You", action: "profiles.read_self", primary: true, icon: "profile" },
];

/**
 * The bottom bar holds five at most.
 *
 * Six tabs on a 390px screen gives every one of them 65px, which is under the
 * 44px tap target once padding is taken out and is exactly the mush the mobile
 * pass exists to prevent. Five is the ceiling and the order below is the
 * priority when a role qualifies for more.
 */
export const MOBILE_TAB_LIMIT = 5;

/*
 * Every role gets the dashboard, and that is a change.
 *
 * It was admin only, on the reasoning that an engineer's dashboard was the
 * review queue and a technician's was their jobs, so a generic one would be a
 * third empty page. Phase 6 built the two that were missing: the engineer's
 * carries their queue, their minutes this period and their production ledger,
 * and the technician's carries offers, deadlines and what they are owed.
 *
 * The old reasoning is recorded rather than deleted because it was right while
 * it was true. Sign in still lands each role on the surface they work in, via
 * homeFor. The dashboard is where they go to see everything at once.
 */
/**
 * THE ROLE PARAMETER IS GONE, AND ITS ABSENCE IS THE POINT.
 *
 * It was `_role: Role`, unused, kept from when navigation was decided by role
 * identity rather than by grants. Underscored, so nothing complained.
 *
 * An unused parameter is usually harmless. This one was not: it required every
 * caller to hold a value of the Phase 0 union, and the portal layout holds a
 * role KEY, so it was one of the pressures producing `as Role` casts across the
 * tree. Six defects were found on 2026-09-07 that all had the same shape, and
 * the casts are what let every one of them past the type checker.
 *
 * Removing it costs nothing and removes a reason to write one.
 */
export function navFor(allowed: (action: Action | LicensedAction) => boolean): NavItem[] {
  return NAV.filter((item) => allowed(item.action));
}

export function mobileTabsFor(items: NavItem[]): NavItem[] {
  return items.filter((i) => i.primary).slice(0, MOBILE_TAB_LIMIT);
}
