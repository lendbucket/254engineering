/**
 * ===========================================================================
 * THE OWNER OVERRIDE. TWO USER IDS, NAMED, AND NOTHING ELSE CAN REACH IT.
 * Operator ruling, 2026-10-19, made on purpose and in these terms:
 * ===========================================================================
 *
 *   1. The owner's ADMIN account is exempt from the fresh authenticator code on
 *      a job at no charge. In its place his password is re-entered in the same
 *      step, so the act is never one click.
 *   2. The owner's FIELD TECHNICIAN profile is exempt from the driver licence
 *      and vehicle insurance check at dispatch, the way it is already exempt
 *      from the W-9 and contractor agreement (OWNER_EXEMPTIONS, 2026-10-06).
 *
 * WHY IT IS AN ID AND NOT A ROLE, A FLAG OR A SETTING. A role is held by
 * anybody granted it; a flag or a setting is changed by anybody who can edit
 * it. An id is one person. Matching by email was refused for the same reason:
 * an email is a column somebody can update. Both ids were read from production
 * by the operator's counterpart on 2026-10-19 and do not exist in development,
 * so there the override is inert and every proof uses probe accounts.
 *
 * WHAT IT NEVER REACHES. verifyFreshCode is also asked by sealing a letter,
 * signing a protocol and uploading the seal. Those are the engineer's acts, and
 * CLAUDE.md section 1 says no administrator path exists for them, the
 * operator's included. Nothing here is read by those three files, and
 * scripts/proofs/the-owner-override-is-two-ids.mjs asserts that from source.
 *
 * WHAT IT COSTS, STATED SO IT IS A DECISION RATHER THAN A DISCOVERY. On the
 * no-charge act the second factor becomes the password, so whoever holds the
 * owner's password can authorise a job at no charge. Every use writes an audit
 * row through writeAuditOrRefuse, naming the override, the act and the time,
 * and refuses if the row cannot be written. /portal/launch shows both as
 * active, so neither is hidden.
 *
 * Changing either id, or adding a third, costs this file, the proof's pinned
 * literals, and the launch screen's line, each edited on purpose.
 */
export const OWNER_OVERRIDE = {
  /** ceo@36west.org, role admin. Read from production 2026-10-19. */
  adminUserId: "fd2dceac-cb9e-4471-89d5-1b00ab9f25f9",
  /** robertreyna88@yahoo.com, role field_tech. Read from production 2026-10-19. */
  fieldTechUserId: "c9d46cd2-9ee3-4479-9768-2b27e13c0044",
  ruledOn: "2026-10-19",
} as const;

/** The audit action every use writes. */
export const OWNER_OVERRIDE_ACTION = "owner_override.used";

/** The two overrides by name, for the audit row and the launch screen. */
export const OWNER_OVERRIDES = [
  {
    key: "no_charge_password",
    label: "No-charge job: password re-entered in place of the authenticator code",
    holder: "The owner's administrator account, by user id",
  },
  {
    key: "dispatch_credentials",
    label: "Dispatch: driver license and vehicle insurance not required",
    holder: "The owner's field technician profile, by user id",
  },
] as const;

export type OwnerOverrideKey = (typeof OWNER_OVERRIDES)[number]["key"];

/** True for the owner's administrator account and nobody else. */
export function isOwnerAdmin(userId: string | null | undefined): boolean {
  return typeof userId === "string" && userId === OWNER_OVERRIDE.adminUserId;
}

/** True for the owner's field technician profile and nobody else. */
export function isOwnerFieldTech(userId: string | null | undefined): boolean {
  return typeof userId === "string" && userId === OWNER_OVERRIDE.fieldTechUserId;
}
