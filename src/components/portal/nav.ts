import type { Action, Role } from "@/lib/ops-authz";

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
  action: Action;
  /** Shown in the bottom tab bar on a phone. At most five, by design. */
  primary?: boolean;
  icon:
    | "home" | "files" | "people" | "review" | "jobs" | "clients" | "audit"
    | "profile" | "protocols" | "techs" | "onboarding" | "certification" | "charge"
    | "tasks" | "messages";
};

export const NAV: NavItem[] = [
  { href: "/portal", label: "Dashboard", short: "Home", action: "files.list", primary: true, icon: "home" },
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
  { href: "/portal/clients", label: "Clients", short: "Clients", action: "clients.list", icon: "clients" },
  { href: "/portal/protocols", label: "Protocols", short: "Specs", action: "protocols.author", icon: "protocols" },
  { href: "/portal/techs", label: "Technicians", short: "Techs", action: "profiles.list", icon: "techs" },
  { href: "/portal/onboarding", label: "Onboarding", short: "Onboard", action: "profiles.create", icon: "onboarding" },
  { href: "/portal/people", label: "People", short: "People", action: "profiles.list", primary: true, icon: "people" },
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

export function navFor(role: Role, allowed: (action: Action) => boolean): NavItem[] {
  const items = NAV.filter((item) => allowed(item.action));
  // An engineer's dashboard is the review queue and a tech's is their jobs, so
  // the generic dashboard is admin only rather than a third empty page.
  return role === "admin" ? items : items.filter((i) => i.href !== "/portal");
}

export function mobileTabsFor(items: NavItem[]): NavItem[] {
  return items.filter((i) => i.primary).slice(0, MOBILE_TAB_LIMIT);
}
