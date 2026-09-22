/**
 * ===========================================================================
 * INTERNAL KEYS BECOME PLAIN LABELS, FROM ONE DECLARATION.
 * Operator ruling, 2026-09-21, from the portal copy sweep.
 * ===========================================================================
 *
 * WHAT THE SWEEP FOUND. `/portal/audit` rendered the raw audit action key in a
 * monospace column, on both the table and the phone card: `customer.signed_in`,
 * `windstorm_inquiry.answered`, `partner.password_set`. That screen is the
 * firm's regulatory memory and it is read by a person reconstructing what
 * happened, which is exactly when an internal identifier is worst: it is
 * readable enough to be quoted and wrong enough to be quoted wrongly.
 *
 * WHY A TRANSFORM RATHER THAN A MAP OF LABELS, and this is the design decision
 * worth keeping. A hand written map of every action key would need an entry per
 * action, would be edited in a different commit from the action it names, and
 * would fall back to the raw key for anything missing. That is a list somebody
 * grows until it covers nothing, and its failure mode is silent: a new action
 * renders as a key and nobody notices, because the screen already looked like
 * that for the ones nobody labelled.
 *
 * The keys are already structured. Every one is `subject.verb` in snake_case,
 * which is a sentence somebody wrote in a machine's shape. Turning it back is
 * deterministic, cannot go stale, and covers an action written tomorrow.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: invent nicer words. `files.transition` does
 * not become "File moved to a new status". Choosing that wording for sixty
 * actions is a wording decision at scale, it belongs to the operator, and
 * guessing it overnight would put sixty sentences nobody approved onto the
 * regulatory record. This reads the key back as English and stops.
 */

/**
 * `windstorm_inquiry.answered` becomes `Windstorm inquiry answered`.
 *
 * THE RAW KEY IS RETURNED UNCHANGED IF IT IS NOT KEY SHAPED, which is the
 * conservative direction: a value this does not understand is shown as it is
 * rather than mangled into something that reads like a sentence and is not.
 */
export function actionLabel(key: string): string {
  const trimmed = (key ?? "").trim();
  if (!/^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/.test(trimmed)) return trimmed;

  const words = trimmed.split(".").join(" ").split("_").join(" ").trim();
  if (!words) return trimmed;
  return words[0].toUpperCase() + words.slice(1);
}

/**
 * The same transform for a role key, for surfaces that have no role record to
 * read from.
 *
 * PREFER THE ROLE'S OWN `name` WHERE ONE IS IN HAND. `DEFAULT_ROLES` in
 * ops-authz.ts declares a name for every system role, and `eng_roles` carries
 * one for every role an owner has created. Those are the operator's words and
 * they beat a transform of the key every time. This is the fallback for a key
 * arriving without its record, and its existence is not a licence to stop
 * reading the record.
 *
 * KNOWN DIVERGENCE, RECORDED RATHER THAN RESOLVED HERE. `DEFAULT_ROLES` names
 * `field_tech` "Field Technician" and `ROLE_LABELS` in
 * src/content/onboarding-checklists.ts names the same key "Field Inspection
 * Technician". Two homes for one label, already disagreed. Which word the firm
 * uses is a wording choice for the operator, so it is in the morning report
 * under Rulings owed rather than settled by this file.
 */
export function roleKeyLabel(key: string): string {
  const trimmed = (key ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(trimmed)) return trimmed;
  const words = trimmed.split("_").join(" ");
  return words[0].toUpperCase() + words.slice(1);
}
