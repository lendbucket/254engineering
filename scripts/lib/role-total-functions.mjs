/**
 * EVERY SHIPPED ROLE GETS A REAL ANSWER FROM EVERY FUNCTION THAT TAKES ONE.
 *
 * WHY THIS IS ONE DECLARATION RATHER THAN SIX CHECKS
 * --------------------------------------------------
 * On 2026-09-07 a sweep found six live instances of a single defect: a total
 * function over the Phase 0 role union that stopped being total when migration
 * 0018 made roles rows and seven shipped.
 *
 *   ROLE_LABEL          rendered blank in the profile menu, roster and eyebrow
 *   readOpsSession      signed four of seven roles out on their next request
 *   people route        refused to create those four at all
 *   homeFor             returned undefined, so they signed in and landed nowhere
 *   portalInvite        told a dispatcher, in writing, they were a technician
 *   dashboardFor        served four roles the field technician's dashboard
 *
 * Each was found separately and fixed separately. This is the check that would
 * have caught all of them at once, and it is the shape worth keeping: not six
 * assertions about six functions, but one assertion about a property.
 *
 * THE PROPERTY
 * ------------
 * For every role in DEFAULT_ROLES, every function registered below returns
 * something REAL. Not undefined, not empty, not the answer meant for a
 * different role. What "real" means is declared per function, because "not
 * undefined" would have passed portalInvite, which returned a confident and
 * wrong "Field Technician".
 *
 * THE SIXTH ONE WAS NAMED HERE AND NOT CHECKED HERE, AND IT COST A SEVENTH
 * INSTANCE
 * --------------------------------------------------------------------------
 * `dashboardFor` was in the list above and not in the array below, on the
 * reasoning that the other five are pure functions of a role key while it is
 * async, takes an ACTOR, and reads a database. That was true and it was not a
 * reason.
 *
 * On 2026-09-09, Phase 12 Section 2 found `dashboardFor` had regressed to a
 * seventh instance of the same defect and stayed there: a dispatcher holds
 * `offers.list_own`, which was the field technician's branch, so every
 * dispatcher was served the technician's dashboard with every tile scoped to
 * somebody else's id and therefore reading none. The comment beneath that
 * ladder asserted it returned null for a dispatcher. A file that names a defect
 * and does not check it is this repository's recurring failure wearing a
 * declaration.
 *
 * **It is registered now.** Operator ruling, 2026-09-09: fix the file, not the
 * comment. The runner in roles-audit awaits every `call`, so an async entry is
 * ordinary, and the fixture is an actor built from the role's own grants with a
 * uuid belonging to nobody. The entry itself explains why that is enough.
 *
 * `dashboards-audit` no longer keeps its own copy of the mapping. It asserts
 * that THIS registry covers `dashboardFor`, which is the hole that let the
 * regression through, closed as a check rather than as a paragraph.
 *
 * ADDING A FUNCTION THAT TAKES A ROLE MEANS ADDING IT HERE
 * --------------------------------------------------------
 * That is the same rule the surface inventory carries, for the same reason: the
 * denominator cannot be a memory. A function that takes a role and is absent
 * from this list is the seventh instance waiting to happen.
 */

import { DEFAULT_ROLES, roleLabel, homeFor, actionsFor, inviteFieldsFor } from "../../src/lib/ops-authz.ts";
import { dashboardFor } from "../../src/lib/ops-dashboard.ts";
import { portalInvite } from "../../src/lib/email-templates.ts";

/**
 * Each entry: what it is, how to call it, and what a REAL answer looks like.
 *
 * The `real` predicate is per function on purpose. A shared "not undefined"
 * check is what would have let the invitation email through.
 */
export const ROLE_TOTAL_FUNCTIONS = [
  {
    name: "roleLabel",
    what: "what a role is called on a screen",
    call: (role) => roleLabel(role.key),
    real: (out, role) =>
      typeof out === "string" && out.trim().length > 0 && out === role.name
        ? null
        : `expected ${JSON.stringify(role.name)}, got ${JSON.stringify(out)}`,
  },
  {
    name: "homeFor",
    what: "where a role lands after signing in",
    call: (role) => homeFor(role.key),
    real: (out, role) =>
      out === role.landingPath
        ? null
        : `expected ${JSON.stringify(role.landingPath)}, got ${JSON.stringify(out)}`,
  },
  {
    name: "actionsFor",
    what: "what a role may do by default",
    call: (role) => actionsFor(role.key),
    real: (out, role) =>
      Array.isArray(out) && out.length === role.grants.length
        ? null
        : `expected ${role.grants.length} grants, got ${Array.isArray(out) ? out.length : typeof out}`,
  },
  {
    name: "inviteFieldsFor",
    what: "what creating an account with this role has to ask",
    call: (role) => inviteFieldsFor(role.key),
    /* An empty list is a real answer here: most roles need nothing extra. What
     * is not real is undefined, which would mean the lookup missed. */
    real: (out) => (Array.isArray(out) ? null : `expected an array, got ${typeof out}`),
  },
  {
    name: "portalInvite",
    what: "the invitation email, which leaves the building",
    call: (role) => portalInvite({
      personName: "A Person",
      personEmail: "person@example.com",
      role: role.key,
      setPasswordUrl: "https://example.com/set",
      expiresAt: "in three days",
      invitedBy: "An Administrator",
      signInUrl: "https://example.com/portal/login",
    }),
    /*
     * The email has to NAME THIS ROLE. Checking it merely renders would have
     * passed the version that told four of the seven roles they were field
     * technicians, which is why this looks for the role's own name in the body.
     */
    real: (out, role) => {
      const text = `${out?.text ?? ""} ${out?.html ?? ""}`;
      if (!text.trim()) return "the template rendered nothing";
      if (!text.includes(role.name)) {
        const wrong = DEFAULT_ROLES.filter((r) => r.key !== role.key && text.includes(r.name)).map((r) => r.name);
        return wrong.length
          ? `it does not say ${JSON.stringify(role.name)} and DOES say ${JSON.stringify(wrong.join(", "))}`
          : `it does not name this role at all`;
      }
      return null;
    },
  },
  {
    /*
     * THE SIXTH FUNCTION, AND THE ONE THIS FILE NAMED FOR TWO DAYS WITHOUT
     * CHECKING.
     *
     * Operator ruling, 2026-09-09: "The file that names a defect and does not
     * check it is the defect class; fix the file, not just the comment."
     *
     * The docstring at the top lists `dashboardFor` among the six instances the
     * September sweep found, and the array did not contain it. The reason given
     * was that the other five are pure functions of a role key while this one is
     * async and reads a database. That was true and it was not a reason: it
     * cost a seventh instance of the same defect, which shipped and stayed,
     * because a dispatcher holds `offers.list_own` and that was the field
     * technician's branch.
     *
     * WHAT THE FIXTURE IS, EXACTLY
     * ----------------------------
     * An actor built from the role's shipped grants, carrying a well formed
     * uuid that belongs to nobody. That is the whole fixture and it is enough,
     * for a reason worth stating rather than assuming: this checks WHICH
     * dashboard a role is served, not what is on it. Every builder sets its own
     * `role` field before it reads anything, and returns a dashboard carrying
     * that field even when the database is unreachable, so the property is
     * decided by the capability ladder rather than by data.
     *
     * The uuid has to be well formed even so. Several dashboards scope a count
     * to actor.id, and Postgres answers a non uuid with an error carrying an
     * empty message, which the dashboard logs as "a count could not be read"
     * on every run. The routing assertion passes either way, so the only
     * symptom is a frightening line that trains somebody to ignore it.
     *
     * WHY THE EXPECTED MAPPING IS A LITERAL
     * -------------------------------------
     * CLAUDE.md section 6: an audit never imports its expectation from the
     * thing it audits. Asking `dashboardFor` which dashboard a role should get
     * compares a value to itself and passes on the day the ladder is wrong,
     * which is the only day it matters.
     *
     * read_only maps to the administrator's dashboard on purpose. That role is
     * granted ledger.read_all and billing.read deliberately, for a buyer's
     * accountant or an auditor, and somebody evaluating the business has to see
     * the money.
     */
    name: "dashboardFor",
    what: "which dashboard a role is served",
    call: (role) =>
      dashboardFor({
        id: "00000000-0000-4000-8000-000000000000",
        role: role.key,
        status: "active",
        grants: new Set(role.grants),
      }),
    real: (out, role) => {
      const expected = DASHBOARD_FOR_ROLE[role.key];
      if (!expected) return `no dashboard was ever decided for this role`;
      const got = out?.role ?? "none";
      return got === expected
        ? null
        : `expected the ${expected} dashboard, got ${got}. A role served somebody else's dashboard reads every tile as none, which looks like a quiet day rather than a defect.`;
    },
  },
];

/**
 * Which dashboard each shipped role is served, as a literal.
 *
 * Exported so `dashboards-audit` can assert this registry COVERS dashboardFor
 * rather than keeping a second copy of the mapping. Two copies of a decision
 * are two copies that will disagree, and this file is the one that is supposed
 * to hold it.
 */
export const DASHBOARD_FOR_ROLE = {
  admin: "admin",
  engineer: "engineer",
  field_tech: "field_tech",
  dispatcher: "dispatcher",
  sales: "sales",
  customer_service: "customer_service",
  read_only: "admin",
};
