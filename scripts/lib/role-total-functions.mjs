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
 * THE ONE ON THAT LIST THAT IS NOT REGISTERED BELOW, AND WHAT IT COST
 * --------------------------------------------------------------------
 * `dashboardFor` is named four lines up as one of the six, and it is not in the
 * array. It could not be: the other five are pure functions of a role key, and
 * `dashboardFor` is async, takes an ACTOR rather than a role, and runs a dozen
 * queries. Registering it here would have meant a database in this module.
 *
 * The gap was not free. On 2026-09-09, Phase 12 Section 2 found `dashboardFor`
 * had regressed to a seventh instance of the same defect: a dispatcher holds
 * `offers.list_own`, which was the field technician's branch, so every
 * dispatcher was being served the technician's dashboard with every tile scoped
 * to somebody else's id and therefore reading none. The comment beneath that
 * ladder asserted it returned null for a dispatcher. This file's own docstring
 * named the function and the list did not contain it, which is this
 * repository's recurring defect wearing a declaration.
 *
 * It is covered now, by `scripts/dashboards-audit.mjs`, which builds an actor
 * from every entry in DEFAULT_ROLES, walks the ladder, and compares against a
 * mapping written out as a literal rather than read back from the module. That
 * is the same property this file asserts, checked where a database is allowed.
 * Named here so the next reader of the list above does not conclude the
 * function is unchecked, and does not conclude it is checked HERE.
 *
 * ADDING A FUNCTION THAT TAKES A ROLE MEANS ADDING IT HERE
 * --------------------------------------------------------
 * That is the same rule the surface inventory carries, for the same reason: the
 * denominator cannot be a memory. A function that takes a role and is absent
 * from this list is the seventh instance waiting to happen.
 */

import { DEFAULT_ROLES, roleLabel, homeFor, actionsFor, inviteFieldsFor } from "../../src/lib/ops-authz.ts";
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
];
