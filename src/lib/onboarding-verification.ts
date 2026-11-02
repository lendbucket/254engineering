/**
 * ===========================================================================
 * IDENTITY AND I-9: WHAT WAS SEEN, WHO SAW IT AND WHEN. NEVER THE DOCUMENT.
 * Robert's ruling P1, 2026-11-01 evening: "Identity and I-9 verification
 * restored as an administrator step on that screen: the admin records
 * 'verified', the document type seen, who and when. No copy of any ID or I-9
 * is stored; credentials hold facts, never documents."
 * ===========================================================================
 *
 * Pure, so a proof can hand it rows. The columns are 0105's, and the two
 * vocabularies below are the same lists that migration's check constraints
 * accept; the P1 proof reads both files and fails if they disagree.
 *
 * ONE HOME FOR "IS THIS CHECKED". The two operator items on the checklist,
 * identity_verified_video and i9_documents_examined, are not accepted by the
 * item decision at all. Their state is DERIVED from the onboarding's columns
 * (verificationItemStatus), so the item row and the verification record can
 * never disagree about whether a person was seen: there is only one record.
 */

export type VerificationCheck = "identity" | "i9";

export const IDENTITY_DOCUMENT_TYPES = [
  { value: "drivers_license", label: "Driver license" },
  { value: "state_id", label: "State ID card" },
  { value: "us_passport", label: "U.S. passport" },
  { value: "us_passport_card", label: "U.S. passport card" },
  { value: "military_id", label: "Military ID" },
  { value: "permanent_resident_card", label: "Permanent resident card" },
  { value: "other_government_photo_id", label: "Other government photo ID" },
] as const;

/*
 * The I-9 Section 2 examination: one List A document, or a List B document
 * with a List C document. Recorded at the list level with the common
 * combinations named; the form itself, with its document numbers, is in
 * Gusto (ruling of 2026-10-02) and never here.
 */
export const I9_DOCUMENT_TYPES = [
  { value: "list_a_us_passport", label: "List A: U.S. passport or passport card" },
  { value: "list_a_permanent_resident_card", label: "List A: permanent resident card" },
  { value: "list_a_employment_authorization_document", label: "List A: employment authorization document" },
  { value: "list_a_foreign_passport", label: "List A: foreign passport with its I-94 or I-551 stamp" },
  { value: "lists_b_c_license_and_social_security_card", label: "Lists B and C: driver license or state ID, with a Social Security card" },
  { value: "lists_b_c_license_and_birth_certificate", label: "Lists B and C: driver license or state ID, with a U.S. birth certificate" },
  { value: "lists_b_c_other_combination", label: "Lists B and C: another combination the form accepts" },
] as const;

export const DOCUMENT_TYPES: Record<VerificationCheck, readonly { value: string; label: string }[]> = {
  identity: IDENTITY_DOCUMENT_TYPES,
  i9: I9_DOCUMENT_TYPES,
};

/** The checklist item each check stands for. Neither is decided as an item. */
export const VERIFICATION_ITEM: Record<VerificationCheck, string> = {
  identity: "identity_verified_video",
  i9: "i9_documents_examined",
};

/** The columns each check writes, all three together or none. */
export const VERIFICATION_COLUMNS: Record<VerificationCheck, { at: string; type: string; by: string }> = {
  identity: { at: "identity_verified_at", type: "identity_document_type", by: "identity_verified_by" },
  i9: { at: "i9_examined_at", type: "i9_document_type", by: "i9_examined_by" },
};

export type VerificationRecord = { at: string | null; type: string | null; by: string | null };

export function documentTypeLabel(check: VerificationCheck, value: string | null): string | null {
  if (!value) return null;
  return DOCUMENT_TYPES[check].find((d) => d.value === value)?.label ?? null;
}

export function isKnownDocumentType(check: VerificationCheck, value: string): boolean {
  return DOCUMENT_TYPES[check].some((d) => d.value === value);
}

/** Which check, if any, an item key stands for. */
export function checkForItem(itemKey: string): VerificationCheck | null {
  return (Object.keys(VERIFICATION_ITEM) as VerificationCheck[]).find((c) => VERIFICATION_ITEM[c] === itemKey) ?? null;
}

/**
 * An operator verification item's status, from the record and nothing else.
 * Accepted only when all three facts are there; a half record, which 0105
 * refuses to store, would read as not done rather than done.
 */
export function verificationItemStatus(record: VerificationRecord | null): "accepted" | "pending" {
  return record && record.at && record.type && record.by ? "accepted" : "pending";
}
