/*
 * THE ROOFER APPLICATION'S CHOICES AND LABELS, WITH NO ZOD.
 *
 * Robert's answer 3 of 2026-11-22 (issue #1, 7080044238), from the byte report
 * 7074090867: the account screen's partner profile imported these from
 * roofer-application.ts, which imports zod, so every signed in customer's
 * /account shipped the validation library to draw a form most of them never
 * see. Moved here whole and re-exported from roofer-application.ts, so no
 * caller changes. The profile now loads the schemas only when a roofer saves.
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

/** The profile's three sections, each saved on its own. */
export const ROOFER_SECTIONS = ["work", "insurance", "references"] as const;
export type RooferSection = (typeof ROOFER_SECTIONS)[number];
export const ROOFER_SECTION_LABEL: Record<RooferSection, string> = {
  work: "Your work",
  insurance: "Insurance",
  references: "Two references",
};
