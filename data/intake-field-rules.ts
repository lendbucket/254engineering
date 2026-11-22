/**
 * WHAT A SCREEN IN THE BROWSER MAY KNOW ABOUT THE INTAKE DEFINITION.
 *
 * Robert's answer 5 of 2026-11-22 (issue #1, 7082475108), from the byte report:
 * derive the intake questions on the server and pass them to the order flow and
 * the operator intake form, so the protocol registry leaves the browser.
 *
 * `fieldsFor` in intake-fields.ts is still the single definition of a complete
 * job, and it still runs: on the server, where the two pages call it for every
 * deliverable they offer and hand the answer to the client as data. What used to
 * ship with it was the whole signed protocol registry, because a protocol's own
 * questions are derived from its document by data/protocol-fields.ts, and a
 * client that imports `fieldsFor` imports that too.
 *
 * So this file holds only what a client needs to work with a list it was GIVEN:
 * the group order and labels, the stage order, and the one rule for what is
 * still missing. It imports nothing but types, and
 * scripts/proofs/a-client-screen-carries-no-server-registry.mjs asserts that no
 * client file reaches the registry by any chain.
 *
 * intake-fields.ts re-exports the constants and computes `missingFor` with
 * `missingAmong`, so the server and the browser judge a missing answer by the
 * same function rather than by two copies of it.
 */
import type { FieldStage, IntakeField } from "./intake-fields";

/**
 * THE GROUPS, IN THE ORDER EVERY SURFACE ASKS THEM, AND WHAT EACH IS CALLED.
 *
 * Moved to intake-fields.ts on 2026-10-01 from a local copy in the portal intake
 * screen, so a customer and an operator taking the same job are asked the same
 * things in the same sequence. Moved here on 2026-11-22 unchanged, for the
 * reason at the top of this file; intake-fields.ts re-exports both.
 *
 * An empty group is skipped by each caller rather than filtered here, because
 * which groups are non empty depends on the service and this list is about all
 * of them.
 */
export const INTAKE_GROUPS = ["document", "parties", "property", "access"] as const;

export const INTAKE_GROUP_LABEL: Record<IntakeField["group"], string> = {
  document: "The document",
  parties: "The people",
  property: "The property",
  access: "Getting in",
};

/** The stages in the order a job reaches them. */
export const FIELD_STAGES: readonly FieldStage[] = ["order", "dispatch", "seal"];

/**
 * A deliverable as a client screen receives it: the catalogue entry, and the
 * questions `fieldsFor` returned for it on the server.
 */
export type WithIntakeFields<T> = T & { intakeFields: IntakeField[] };

/**
 * What is still missing, and when it becomes a problem: the required fields
 * whose stage has been reached and which have no answer.
 */
export function missingAmong(
  fields: readonly IntakeField[],
  answers: Record<string, unknown>,
  upTo: FieldStage,
): IntakeField[] {
  const limit = FIELD_STAGES.indexOf(upTo);
  return fields.filter((f) => {
    if (!f.required) return false;
    if (FIELD_STAGES.indexOf(f.stage) > limit) return false;
    const value = answers[f.id];
    return value === undefined || value === null || value === "";
  });
}
