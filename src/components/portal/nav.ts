import type { Action, LicensedAction, Role } from "@/lib/ops-authz";

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
    | "intake";
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
  { href: "/portal/billing", label: "Billing", short: "Money", action: "billing.read", icon: "billing" },
  { href: "/portal/clients", label: "Clients", short: "Clients", action: "clients.list", icon: "clients" },
  { href: "/portal/protocols", label: "Protocols", short: "Specs", action: "protocols.author", icon: "protocols" },
  { href: "/portal/techs", label: "Technicians", short: "Techs", action: "profiles.list", icon: "techs" },
  { href: "/portal/onboarding", label: "Onboarding", short: "Onboard", action: "profiles.create", icon: "onboarding" },
  { href: "/portal/people", label: "People", short: "People", action: "profiles.list", primary: true, icon: "people" },
  { href: "/portal/queue", label: "Job queue", short: "Queue", action: "jobs.manage", icon: "queue" },
  { href: "/portal/status", label: "Platform status", short: "Status", action: "jobs.manage", icon: "status" },
  { href: "/portal/audit", label: "Audit trail", short: "Audit", action: "audit.read", icon: "audit" },
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
export function navFor(
  _role: Role,
  allowed: (action: Action | LicensedAction) => boolean,
): NavItem[] {
  return NAV.filter((item) => allowed(item.action));
}

export function mobileTabsFor(items: NavItem[]): NavItem[] {
  return items.filter((i) => i.primary).slice(0, MOBILE_TAB_LIMIT);
}
