/**
 * FRANCHISEE ONBOARDING, THE PURE HALF (0128). Robert's overnight orders of
 * 2026-11-10, platform item X4: "agreement signed, insurance certificates on
 * file (Item 7 coverages), owner through the academy, technicians certified by
 * the engineer before dispatch."
 *
 * A franchisee moves from onboarding to operating only when every step below
 * is met. Each step is decided here from facts the server reads, so the proof
 * exercises the same function the status change asks.
 *
 * THE COVERAGES ARE NOT RULED. FR6 lists general liability, auto, and workers
 * compensation or a non-subscriber filing, and Robert has not ruled them into
 * any document (question 12 on issue #1, 2026-11-11). They are the requirement
 * here because they are the only list anybody has written; the limits, the
 * additional insured wording and the certificate process are counsel's, and
 * none of them is checked.
 */

export const CERTIFICATE_KINDS = ["general_liability", "auto", "workers_compensation", "non_subscriber_filing"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export const CERTIFICATE_KIND_LABEL: Record<CertificateKind, string> = {
  general_liability: "General liability",
  auto: "Auto",
  workers_compensation: "Workers compensation",
  non_subscriber_filing: "Non-subscriber filing",
};

/** Each requirement is met by a certificate of any one of its kinds. From FR6, not ruled: see above. */
export const REQUIRED_COVERAGES: readonly { label: string; anyOf: readonly CertificateKind[] }[] = [
  { label: "general liability", anyOf: ["general_liability"] },
  { label: "auto", anyOf: ["auto"] },
  { label: "workers compensation or a non-subscriber filing", anyOf: ["workers_compensation", "non_subscriber_filing"] },
];

export type OnboardingFacts = {
  /** The firm day today, YYYY-MM-DD. */
  today: string;
  agreementSignedOn: string | null;
  certificates: readonly { kind: string; effectiveOn: string; expiresOn: string; withdrawn: boolean }[];
  owners: readonly { name: string; graduated: boolean }[];
  technicians: readonly { name: string; certifiedLines: number }[];
};

export type OnboardingStep = { key: "agreement" | "certificates" | "owner" | "technicians"; label: string; met: boolean; says: string };

/** A certificate is on file today when it is not withdrawn and today lies inside its dates. */
export function onFileToday(c: OnboardingFacts["certificates"][number], today: string): boolean {
  return !c.withdrawn && c.effectiveOn <= today && today <= c.expiresOn;
}

export function onboardingSteps(f: OnboardingFacts): OnboardingStep[] {
  const live = f.certificates.filter((c) => onFileToday(c, f.today));
  const missing = REQUIRED_COVERAGES.filter((r) => !live.some((c) => (r.anyOf as readonly string[]).includes(c.kind))).map((r) => r.label);
  const ungraduated = f.owners.filter((o) => !o.graduated).map((o) => o.name);
  const uncertified = f.technicians.filter((t) => t.certifiedLines < 1).map((t) => t.name);
  return [
    {
      key: "agreement",
      label: "Agreement signed",
      met: f.agreementSignedOn !== null,
      says: f.agreementSignedOn ? `Signed ${f.agreementSignedOn}.` : "Record the day the franchise agreement was signed.",
    },
    {
      key: "certificates",
      label: "Insurance certificates on file",
      met: missing.length === 0,
      says: missing.length === 0 ? "Every coverage has a certificate in force today." : `No certificate in force today for ${missing.join(", ")}.`,
    },
    {
      key: "owner",
      label: "Owner through the academy",
      met: f.owners.length > 0 && ungraduated.length === 0,
      says:
        f.owners.length === 0
          ? "No owner is one of its people yet. Add the owner's account to it."
          : ungraduated.length === 0
            ? "Every owner has graduated from the academy."
            : `Not yet graduated: ${ungraduated.join(", ")}.`,
    },
    {
      key: "technicians",
      label: "Technicians certified by the engineer",
      met: f.technicians.length > 0 && uncertified.length === 0,
      says:
        f.technicians.length === 0
          ? "No technician is one of its people yet."
          : uncertified.length === 0
            ? "Every technician is certified on at least one service line."
            : `Not yet certified on any line: ${uncertified.join(", ")}.`,
    },
  ];
}

/** Null when the franchisee may begin operating; otherwise the sentence that says why not. */
export function operatingRefusal(steps: readonly OnboardingStep[]): string | null {
  const unmet = steps.filter((s) => !s.met);
  if (unmet.length === 0) return null;
  return `It cannot start operating until onboarding is complete: ${unmet.map((s) => `${s.label.toLowerCase()} (${s.says.replace(/\.$/, "")})`).join("; ")}.`;
}
