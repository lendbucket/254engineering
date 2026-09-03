/**
 * What a technician must hold to be dispatchable, and whether they still hold
 * it.
 *
 * WHY THIS EXISTS AS ITS OWN MODULE
 * ---------------------------------
 * Before Phase 3 the onboarding system collected documents and the dispatch
 * system read certifications, and nothing joined them. eng_credentials had an
 * expires_on column, an index on it, and a comment saying the Phase 2 alerts
 * read it. Nothing wrote a row. The roster's "expiring within 45 days" panel was
 * therefore a panel that could never fire, which is worse than not having it:
 * an operator who sees an empty expiry warning concludes nothing is expiring.
 *
 * THE POINT IS THE FOURTH DISPATCH GATE
 * -------------------------------------
 * Phase 2 gates dispatch on three things: active account, covers the county,
 * certified for the service line. A lapsed insurance certificate is a fourth,
 * and it is not a softer one. Sending an uninsured technician to a property is
 * a different kind of problem from sending an uncertified one, and neither is a
 * preference the ranking should weigh.
 *
 * WHY EXPIRY IS A HARD STOP AND EXPIRING IS NOT
 * ---------------------------------------------
 * Expired blocks. Expiring soon warns, loudly, on the roster and on the
 * technician's own profile, and does not block, because a technician whose
 * insurance renews next Tuesday can work on Monday and a platform that stops
 * them is a platform that costs the firm a job to enforce a date that has not
 * arrived.
 *
 * NOTHING HERE READS A DOCUMENT
 * -----------------------------
 * An expiry date is typed by the person who is looking at the card, or by the
 * operator verifying it. There is no OCR in this system and there will not be:
 * the standing rule is that the firm needs the document, not the data off it,
 * and an expiry date extracted by a machine from a phone photograph is a date
 * nobody checked.
 */

export type CredentialKind =
  | "drivers_license"
  | "gl_insurance"
  | "vehicle_insurance"
  | "drone_license"
  | "w9"
  | "ic_agreement"
  | "direct_deposit"
  | "pe_license"
  | "tdi_appointment"
  | "other";

export type CredentialStatus = "pending" | "verified" | "rejected" | "expired";

export type CredentialRecord = {
  kind: CredentialKind;
  status: CredentialStatus;
  /** ISO date, or null when the document does not expire. */
  expiresOn: string | null;
  label?: string | null;
};

/**
 * What a field technician must hold before they can be offered work.
 *
 * DELIBERATELY SHORT, AND EACH ENTRY HAS A REASON
 * -----------------------------------------------
 * A long list of required documents is a list somebody starts waiving. These
 * four are the ones where the firm carries real exposure if they are missing:
 *
 *   drivers_license   Field work is dispatched by county and involves driving to
 *                     a property. Expires, and a lapsed one is a real problem.
 *   vehicle_insurance Same journey, same exposure. Expires.
 *   w9                A contractor cannot be paid without one. Does not expire.
 *   ic_agreement      The engagement itself. Does not expire.
 *
 * General liability is NOT here. Some technicians carry it and some do not, and
 * the operator decides per person rather than the platform deciding for them.
 * When it is on file and lapsed it still blocks, because a lapsed certificate on
 * file is a worse state than none: it means somebody believed there was cover.
 *
 * Direct deposit is not here either. A technician who has not given bank details
 * can still do the work; they just cannot be paid yet, which the pay ledger
 * shows and which is not a reason to refuse them a job.
 */
export const REQUIRED_FOR_DISPATCH: CredentialKind[] = [
  "drivers_license",
  "vehicle_insurance",
  "w9",
  "ic_agreement",
];

/** Kinds that carry an expiry date, so the flow knows when to ask for one. */
export const EXPIRING_KINDS: CredentialKind[] = [
  "drivers_license",
  "vehicle_insurance",
  "gl_insurance",
  "drone_license",
  "pe_license",
  "tdi_appointment",
];

export const CREDENTIAL_LABEL: Record<CredentialKind, string> = {
  drivers_license: "Driver licence",
  gl_insurance: "General liability insurance",
  vehicle_insurance: "Vehicle insurance",
  drone_license: "Remote pilot certificate",
  w9: "Form W-9",
  ic_agreement: "Independent contractor agreement",
  direct_deposit: "Direct deposit authorization",
  pe_license: "Texas PE licence",
  tdi_appointment: "TDI appointment",
  other: "Other document",
};

/** Days before expiry at which a credential starts warning. */
export const EXPIRY_WARNING_DAYS = 45;

export type ExpiryState = "none" | "current" | "expiring" | "expired";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * How close a credential is to expiring.
 *
 * Compared by calendar day, not by timestamp. A certificate that expires today
 * is valid today: an insurer does not stop covering somebody at nine in the
 * morning because that is when the audit ran.
 */
export function expiryState(expiresOn: string | null | undefined, now: Date = new Date()): ExpiryState {
  if (!expiresOn) return "none";
  const expiry = new Date(`${expiresOn}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return "none";

  const today = startOfDay(now);
  const days = Math.round((startOfDay(expiry).getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return "expired";
  if (days <= EXPIRY_WARNING_DAYS) return "expiring";
  return "current";
}

/** Whole days until expiry. Negative once it has passed. Null when it does not expire. */
export function daysUntilExpiry(expiresOn: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiresOn) return null;
  const expiry = new Date(`${expiresOn}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.round((startOfDay(expiry).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

export type CredentialBlocker = { kind: CredentialKind; reason: string };

/**
 * Why this technician cannot be offered work, on credentials alone.
 *
 * Returns every reason rather than the first, because an operator fixing one
 * and discovering a second is an operator making two phone calls.
 */
export function credentialBlockers(
  credentials: CredentialRecord[],
  now: Date = new Date(),
): CredentialBlocker[] {
  const blockers: CredentialBlocker[] = [];
  const byKind = new Map<CredentialKind, CredentialRecord[]>();
  for (const c of credentials) {
    byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]);
  }

  for (const kind of REQUIRED_FOR_DISPATCH) {
    const held = byKind.get(kind) ?? [];
    const verified = held.filter((c) => c.status === "verified");

    if (verified.length === 0) {
      blockers.push({
        kind,
        reason: held.length
          ? `${CREDENTIAL_LABEL[kind]} is on file but not verified yet.`
          : `No ${CREDENTIAL_LABEL[kind].toLowerCase()} on file.`,
      });
      continue;
    }

    // Current if ANY verified copy is current. A renewal uploaded alongside the
    // old one should not be defeated by the old one still sitting there.
    const anyCurrent = verified.some((c) => expiryState(c.expiresOn, now) !== "expired");
    if (!anyCurrent) {
      blockers.push({
        kind,
        reason: `${CREDENTIAL_LABEL[kind]} expired on ${verified[0].expiresOn}.`,
      });
    }
  }

  /*
   * Anything else on file and lapsed also blocks. A lapsed certificate that
   * somebody uploaded is a worse state than one that was never uploaded,
   * because it means the firm believed there was cover.
   */
  for (const c of credentials) {
    if (REQUIRED_FOR_DISPATCH.includes(c.kind)) continue;
    if (c.status !== "verified") continue;
    if (expiryState(c.expiresOn, now) === "expired") {
      blockers.push({
        kind: c.kind,
        reason: `${CREDENTIAL_LABEL[c.kind]} on file expired on ${c.expiresOn}.`,
      });
    }
  }

  return blockers;
}

/** Credentials worth warning about on the roster, soonest first. */
export function expiringSoon(
  credentials: CredentialRecord[],
  now: Date = new Date(),
): { kind: CredentialKind; expiresOn: string; days: number }[] {
  return credentials
    .filter((c) => c.status === "verified" && expiryState(c.expiresOn, now) === "expiring")
    .map((c) => ({
      kind: c.kind,
      expiresOn: c.expiresOn as string,
      days: daysUntilExpiry(c.expiresOn, now) as number,
    }))
    .sort((a, b) => a.days - b.days);
}

// ------------------------------------------------------- activation readiness

/**
 * Which checklist item becomes which credential when an onboarding is accepted.
 *
 * WHY A MAP AND NOT A COLUMN ON THE ITEM
 * --------------------------------------
 * The checklist in src/content/onboarding-checklists.ts is copied into rows when
 * an onboarding is created, so an item's meaning has to survive the operator
 * adding a bespoke item for one hire. An item that is not in this map is still a
 * document the firm wanted; it just is not one dispatch reads. That is the
 * common case and it must not be an error.
 */
export const CREDENTIAL_OF_ITEM: Record<string, { kind: CredentialKind; expires: boolean }> = {
  drivers_license: { kind: "drivers_license", expires: true },
  vehicle_insurance: { kind: "vehicle_insurance", expires: true },
  general_liability: { kind: "gl_insurance", expires: true },
  drone_license: { kind: "drone_license", expires: true },
  w9: { kind: "w9", expires: false },
  ica_signed: { kind: "ic_agreement", expires: false },
  direct_deposit: { kind: "direct_deposit", expires: false },
  pe_license_card: { kind: "pe_license", expires: true },
};

export type OnboardingItemView = {
  itemKey: string;
  label: string;
  status: "pending" | "uploaded" | "accepted" | "rejected";
  actor: "person" | "admin";
  expiresOn?: string | null;
};

export type Readiness = {
  ready: boolean;
  blockers: string[];
  /** Items accepted but missing an expiry date the credential needs. */
  missingExpiry: string[];
};

/**
 * Whether an onboarding can be turned into a working technician account.
 *
 * ACTIVATION IS THE ONE IRREVERSIBLE STEP IN THIS PHASE
 * ----------------------------------------------------
 * It creates a real account, writes credentials dispatch will read, and puts
 * somebody into the pool of people who can be offered work at a stranger's
 * property. Every check that belongs before that moment belongs here, where it
 * can be asserted, rather than in the button that calls it.
 *
 * Coverage counties are checked because a technician with none is invisible to
 * every dispatch query and would sit in the roster looking available forever.
 */
export function activationReadiness(
  items: OnboardingItemView[],
  coverageCounties: string[],
  now: Date = new Date(),
): Readiness {
  const blockers: string[] = [];
  const missingExpiry: string[] = [];

  const accepted = new Map(items.filter((i) => i.status === "accepted").map((i) => [i.itemKey, i]));

  for (const [itemKey, mapping] of Object.entries(CREDENTIAL_OF_ITEM)) {
    if (!REQUIRED_FOR_DISPATCH.includes(mapping.kind)) continue;
    const item = items.find((i) => i.itemKey === itemKey);
    if (!item) continue; // Not on this person's checklist at all.

    if (!accepted.has(itemKey)) {
      blockers.push(`${item.label} has not been accepted yet.`);
      continue;
    }
    if (mapping.expires && !item.expiresOn) {
      missingExpiry.push(item.label);
      blockers.push(`${item.label} is accepted but has no expiry date recorded.`);
      continue;
    }
    if (mapping.expires && expiryState(item.expiresOn, now) === "expired") {
      blockers.push(`${item.label} expired on ${item.expiresOn}.`);
    }
  }

  const outstanding = items.filter((i) => i.actor === "admin" && i.status !== "accepted");
  for (const item of outstanding) {
    blockers.push(`${item.label} is still outstanding on the operator's side.`);
  }

  if (coverageCounties.length === 0) {
    blockers.push(
      "No coverage counties set. A technician with none is offered nothing and would sit in the roster looking available.",
    );
  }

  return { ready: blockers.length === 0, blockers, missingExpiry };
}
