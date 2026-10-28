import { PROCEDURES, type Procedure } from "@/content/procedures";

/**
 * WHICH PROCEDURES A ROLE IS SHOWN. W4, Robert 2026-10-26: "Each role gets a
 * Procedures page that renders its workflows from docs/workflows.md."
 *
 * A role sees the sections of the map written for it, and the administrator
 * sees every section, the customer's and the partner's included, because he
 * answers for all of them. The rows follow the map's own roles table:
 *
 *   - the operations manager holds "the rep's grants plus" four more, so the
 *     rep's procedures are his as well as his own;
 *   - sales, customer service and dispatcher are the three older roles the map
 *     describes as each holding "a subset of the rep's work", so they read the
 *     rep's procedures, where the steps they can do are named;
 *   - read_only "has no workflow of its own and is not mapped", so it has no
 *     procedures and no link to the page (the page and its nav item both ask
 *     tasks.use, which every role but read_only holds).
 *
 * THE REP ALSO READS THE CUSTOMER'S PROCEDURES, 254-OPS-001 TO 006. Robert's
 * ruling 12 of 2026-10-27, 22:05 Central: a rep answers the telephone about
 * exactly those steps. The operations manager reads them too, because he holds
 * the rep's grants plus four. Sales, customer service and the dispatcher read
 * the rep's own procedures and not these, until Robert rules on them.
 *
 * A role created later in the permission screen and not named here sees an
 * empty page that says so, rather than somebody else's procedures.
 */
export const SECTIONS_FOR_ROLE: Readonly<Record<string, readonly string[]>> = {
  admin: ["Customer", "Rep", "Ops manager", "Admin and owner", "Field technician", "Engineer", "Partner"],
  ops_manager: ["Customer", "Rep", "Ops manager"],
  rep: ["Customer", "Rep"],
  sales: ["Rep"],
  customer_service: ["Rep"],
  dispatcher: ["Rep"],
  field_tech: ["Field technician"],
  engineer: ["Engineer"],
  read_only: [],
};

export function proceduresFor(role: string): Procedure[] {
  const sections = SECTIONS_FOR_ROLE[role] ?? [];
  return PROCEDURES.filter((p) => sections.includes(p.section));
}

/** Every word of a procedure, for the page's search. */
export function procedureText(p: Procedure): string {
  return [
    p.number,
    p.workflow,
    p.title,
    ...p.notes,
    ...p.steps.flatMap((s) => [s.screen, s.who, s.sees, s.does, s.next, s.told, s.record, s.marks]),
  ]
    .join(" ")
    .toLowerCase();
}
