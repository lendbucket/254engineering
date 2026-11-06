import { z } from "zod";

/**
 * ===========================================================================
 * THE ROOFER PARTNER APPLICATION: WHAT IS ASKED, AND THE RULES IT IS READ BY.
 * Robert's request and rulings of 2026-11-05 (issue #1, 6665440881 and the
 * answers recorded on ops/day the same afternoon).
 * ===========================================================================
 *
 * Texas roofing companies apply to work with the firm as a partner. A person at
 * the firm reads every application and approves or declines it. Nothing
 * approves automatically, nothing is drafted, scored or reviewed by a model,
 * and there is no cap of any kind: every application is read against three
 * things a person checks, a Texas office, general liability cover with a
 * certificate, and two references.
 *
 * WHAT AN APPROVAL IS (ruling 1). A B2B account through door 2, the operator
 * door in account-doors.ts, converted from the application's prospect. The
 * copy calls it a partner. It is NOT the referral partner program: a roofer is
 * paid nothing for sending work, 22 TAC 137.63(c)(4), and no attribution,
 * code, commission, rebate or credit touches an approved roofer.
 *
 * NO MARK (ruling 2). The firm approves the roofer. The roofer gets no badge,
 * logo or 254 mark to sell with, and nothing here produces one.
 *
 * Client safe: the form validates as the roofer types with the same schema the
 * route parses with, so the two cannot disagree about what is required.
 */

export const ROOFER_SERVICES = ["inspections", "roof_certifications", "windstorm", "repair_specifications"] as const;
export type RooferService = (typeof ROOFER_SERVICES)[number];
export const ROOFER_SERVICE_LABEL: Record<RooferService, string> = {
  inspections: "Roof inspections",
  roof_certifications: "Roof certification letters",
  windstorm: "Windstorm (WPI-8)",
  repair_specifications: "Repair specifications",
};

export const ROOFER_WORK_MIX = ["residential", "commercial", "both"] as const;
export type RooferWorkMix = (typeof ROOFER_WORK_MIX)[number];
export const ROOFER_WORK_MIX_LABEL: Record<RooferWorkMix, string> = {
  residential: "Residential",
  commercial: "Commercial",
  both: "Both",
};

/** Bands rather than a number, because a roofer estimating next month's orders is giving a range either way. */
export const ROOFER_MONTHLY_VOLUME = ["1_5", "6_15", "16_40", "over_40"] as const;
export type RooferMonthlyVolume = (typeof ROOFER_MONTHLY_VOLUME)[number];
export const ROOFER_MONTHLY_VOLUME_LABEL: Record<RooferMonthlyVolume, string> = {
  "1_5": "1 to 5 a month",
  "6_15": "6 to 15 a month",
  "16_40": "16 to 40 a month",
  over_40: "More than 40 a month",
};

/** The decisions a person makes, and the statuses an application can hold. */
export const ROOFER_APPLICATION_STATUSES = ["received", "approved", "declined"] as const;
export type RooferApplicationStatus = (typeof ROOFER_APPLICATION_STATUSES)[number];

/** The certificate: one file, a PDF or a photo of it, at most 10MB. */
export const CERTIFICATE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"] as const;
export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

/** The progress a roofer leaves is kept in this browser under this key, and nowhere else. */
export const ROOFER_DRAFT_KEY = "254-roofer-application-draft-v1";

/*
 * WHICH COUNTIES EXIST IS CHECKED ON THE SERVER, against allCounties in
 * src/content/regions.ts (the route does it). This module is imported by the
 * form, and importing the regions here would ship every region's copy to the
 * roofer's phone to check a list the form already offers from.
 */
export function unknownCounties(list: readonly string[], known: readonly string[]): string[] {
  const set = new Set(known);
  return list.filter((c) => !set.has(c));
}

const trimmed = (max: number) => z.string().trim().max(max);
const required = (what: string, max = 200) =>
  trimmed(max).min(1, { message: `Enter ${what}.` });

const phoneDigits = (v: string) => v.replace(/\D/g, "");

/*
 * A BLANK NUMBER IS NO ANSWER, NOT ZERO. z.coerce.number turns "" into 0, so a
 * roofer who typed a figure and deleted it would be recorded as zero years in
 * business. The blank is made undefined first, which the number refuses.
 */
const blankIsMissing = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const rooferApplicationSchema = z.object({
  legalName: required("the company's legal name"),
  dba: trimmed(200).optional(),
  ownerName: required("the owner's name", 120),
  ownerTitle: required("the owner's title", 80),
  email: trimmed(200)
    .min(1, { message: "Enter an email address." })
    .email({ message: "That email address does not look complete." }),
  phone: trimmed(40).refine((v) => {
    const d = phoneDigits(v);
    return d.length === 10 || (d.length === 11 && d.startsWith("1"));
  }, { message: "Enter a ten digit phone number." }),
  officeCity: required("the city of your office", 80),
  counties: z
    .array(z.string())
    .min(1, { message: "Choose at least one county you work in." })
    .max(254)
    .refine((list) => new Set(list).size === list.length, { message: "A county is listed twice." }),
  yearsInBusiness: z.preprocess(
    blankIsMissing,
    z.coerce
      .number({ message: "Enter the years in business as a number." })
      .int({ message: "Enter whole years." })
      .min(0, { message: "Enter zero or more years." })
      .max(150, { message: "Check the years in business." }),
  ),
  crewCount: z.preprocess(
    blankIsMissing,
    z.coerce
      .number({ message: "Enter the number of crews as a number." })
      .int({ message: "Enter a whole number of crews." })
      .min(1, { message: "Enter at least one crew." })
      .max(500, { message: "Check the number of crews." }),
  ),
  workMix: z.enum(ROOFER_WORK_MIX, { message: "Choose residential, commercial or both." }),
  roofsPerYear: z.preprocess(
    blankIsMissing,
    z.coerce
      .number({ message: "Enter roofs a year as a number." })
      .int({ message: "Enter a whole number of roofs." })
      .min(0, { message: "Enter zero or more roofs." })
      .max(100000, { message: "Check the roofs a year." }),
  ),
  services: z
    .array(z.enum(ROOFER_SERVICES))
    .min(1, { message: "Choose at least one service you expect to order." })
    .refine((list) => new Set(list).size === list.length, { message: "A service is listed twice." }),
  monthlyVolume: z.enum(ROOFER_MONTHLY_VOLUME, { message: "Choose roughly how many a month." }),
  insuranceCarrier: required("your general liability carrier", 120),
  glPerOccurrence: required("the per occurrence limit", 40),
  glAggregate: required("the aggregate limit", 40),
  reference1Name: required("the first reference's name", 120),
  reference1Company: trimmed(120).optional(),
  reference1Phone: trimmed(40).refine((v) => phoneDigits(v).length >= 10, { message: "Enter the first reference's phone number." }),
  reference2Name: required("the second reference's name", 120),
  reference2Company: trimmed(120).optional(),
  reference2Phone: trimmed(40).refine((v) => phoneDigits(v).length >= 10, { message: "Enter the second reference's phone number." }),
  /** Set by the route that signed the upload, checked against this application's own prefix before it is stored. */
  certificatePath: trimmed(400).optional(),
  /** The id the browser was given for this application, so the certificate and the row share one key. */
  applicationId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: "Malformed application reference." }),
  /** The honeypot. A person never sees it. */
  website: trimmed(200).optional(),
  landingPath: trimmed(300).optional(),
  referrer: trimmed(500).optional(),
});

export type RooferApplicationInput = z.infer<typeof rooferApplicationSchema>;

/** The form's three steps, and which fields each one owns, so a step validates only its own answers. */
export const ROOFER_STEPS = [
  {
    key: "company",
    title: "Your company",
    fields: ["legalName", "dba", "ownerName", "ownerTitle", "email", "phone", "officeCity"],
  },
  {
    key: "work",
    title: "Your work",
    fields: ["counties", "yearsInBusiness", "crewCount", "workMix", "roofsPerYear", "services", "monthlyVolume"],
  },
  {
    key: "cover",
    title: "Insurance and references",
    fields: [
      "insuranceCarrier",
      "glPerOccurrence",
      "glAggregate",
      "certificatePath",
      "reference1Name",
      "reference1Company",
      "reference1Phone",
      "reference2Name",
      "reference2Company",
      "reference2Phone",
    ],
  },
] as const;

/*
 * ===========================================================================
 * ACCOUNT FIRST, THEN THE PROFILE. Robert's rework of 2026-11-06 (0117).
 * ===========================================================================
 *
 * Step one asks who they are and opens their account; the work, insurance and
 * references are three sections of "Finish your profile" inside the account,
 * each saved on its own, none of them blocking a sign in. The decision is
 * still a person's, made once, as above.
 */

/** Step one: who they are. The account opens on submit (door 1), and the email link sets the password. */
export const rooferSignUpSchema = z.object({
  legalName: required("your company's name"),
  ownerName: required("the owner's name", 120),
  email: trimmed(200)
    .min(1, { message: "Enter an email address." })
    .email({ message: "That email address does not look complete." }),
  phone: trimmed(40).refine((v) => {
    const d = phoneDigits(v);
    return d.length === 10 || (d.length === 11 && d.startsWith("1"));
  }, { message: "Enter a ten digit phone number." }),
  /** The honeypot. A person never sees it. */
  website: trimmed(200).optional(),
  landingPath: trimmed(300).optional(),
  referrer: trimmed(500).optional(),
});
export type RooferSignUpInput = z.infer<typeof rooferSignUpSchema>;

/** The profile's three sections, each saved on its own. */
export const ROOFER_SECTIONS = ["work", "insurance", "references"] as const;
export type RooferSection = (typeof ROOFER_SECTIONS)[number];
export const ROOFER_SECTION_LABEL: Record<RooferSection, string> = {
  work: "Your work",
  insurance: "Insurance",
  references: "Two references",
};

export const rooferWorkSchema = rooferApplicationSchema.pick({
  officeCity: true,
  counties: true,
  yearsInBusiness: true,
  crewCount: true,
  workMix: true,
  roofsPerYear: true,
  services: true,
  monthlyVolume: true,
});
export const rooferInsuranceSchema = rooferApplicationSchema
  .pick({ insuranceCarrier: true, glPerOccurrence: true, glAggregate: true })
  .extend({ certificatePath: trimmed(400).min(1, { message: "Upload the certificate of insurance." }) });
export const rooferReferencesSchema = rooferApplicationSchema.pick({
  reference1Name: true,
  reference1Company: true,
  reference1Phone: true,
  reference2Name: true,
  reference2Company: true,
  reference2Phone: true,
});

export type RooferWorkInput = z.infer<typeof rooferWorkSchema>;
export type RooferInsuranceInput = z.infer<typeof rooferInsuranceSchema>;
export type RooferReferencesInput = z.infer<typeof rooferReferencesSchema>;

export const ROOFER_SECTION_SCHEMA = {
  work: rooferWorkSchema,
  insurance: rooferInsuranceSchema,
  references: rooferReferencesSchema,
} as const;

/** How complete a profile is, from the three done times; the review screen and the account both say it. */
export function profileCompleteness(done: Record<RooferSection, string | null | undefined>): { done: number; of: number; sentence: string } {
  const n = ROOFER_SECTIONS.filter((s) => Boolean(done[s])).length;
  return {
    done: n,
    of: ROOFER_SECTIONS.length,
    sentence: n === ROOFER_SECTIONS.length ? "Profile complete" : `${n} of ${ROOFER_SECTIONS.length} profile sections done`,
  };
}

/** The first error for each field, keyed by field name, the shape every form here shows. */
export function rooferFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

/** The certificate's storage key prefix for one application. The site key is prepended on the server. */
export function certificatePrefix(siteKey: string, applicationId: string): string {
  return `${siteKey}/roofer/${applicationId}/`;
}

/** True only for a certificate key this application's own upload could have produced. */
export function isOwnCertificatePath(path: unknown, siteKey: string, applicationId: string): boolean {
  if (typeof path !== "string") return false;
  const prefix = certificatePrefix(siteKey, applicationId);
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return /^certificate-[0-9a-f]{8}-[A-Za-z0-9._-]+$/.test(rest) && !rest.includes("..");
}
