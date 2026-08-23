import { z } from "zod";

/**
 * The multi step application schemas, one per role.
 *
 * WHY THE STEPS ARE IN THE SCHEMA
 * -------------------------------
 * Each flow is defined here as an ordered list of steps, and each step names the
 * fields it owns. The client validates a step against exactly those fields
 * before advancing, and the server validates the whole object on submit. One
 * definition, so a field cannot be required on the client and optional on the
 * server, and a step cannot silently stop guarding a field somebody moved.
 *
 * WHAT IS DELIBERATELY NOT COLLECTED
 * ----------------------------------
 * No social security number, no date of birth, no government ID image, no bank
 * details. Those are post offer onboarding items and they are handled directly
 * rather than through a public web form, because a form that collects them is a
 * form that stores them, and storing them creates an obligation this site has no
 * reason to take on.
 *
 * The consent line says a background check may be requested later. It does not
 * collect anything that would enable one, and that distinction is the point.
 */

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * A required text field.
 *
 * The type level message is set as well as the min(1) message, and both say the
 * same thing. Without it an untouched field is `undefined` rather than an empty
 * string, so Zod raises its invalid_type error first and the applicant is told
 * "Invalid input: expected string, received undefined" instead of "Enter your
 * full name." The min(1) message only ever appears for somebody who typed
 * spaces and deleted them.
 *
 * Four of the five failures on the first full run of the careers audit were this
 * one mistake, on four different fields.
 */
const required = (label: string, max = 200) =>
  z
    .string({ error: `Enter ${label}.` })
    .trim()
    .max(max)
    .min(1, `Enter ${label}.`);

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .max(200)
  .min(1, "Enter your email address.")
  .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v), "That email address does not look right.");

const phone = z
  .string({ error: "Enter a phone number." })
  .trim()
  .max(40)
  .min(1, "Enter a phone number.")
  .refine(
    (v) => v.replace(/\D/g, "").length >= 10,
    "That phone number looks short. Ten digits or more, please.",
  );

const yesNo = (message: string) => z.enum(["yes", "no"], { error: message });

/** An uploaded document, as the client records it after a successful PUT. */
export const uploadedFileSchema = z.object({
  path: trimmed(400),
  filename: trimmed(200),
  size: z.number().int().positive(),
  contentType: trimmed(120),
});
export type UploadedFile = z.infer<typeof uploadedFileSchema>;

/** The honeypot. Same field name and same silent handling as the other forms. */
const company = trimmed(200).optional();

const attribution = {
  landingPath: trimmed(300).optional(),
  referrer: trimmed(500).optional(),
  utmSource: trimmed(200).optional(),
  utmMedium: trimmed(200).optional(),
  utmCampaign: trimmed(200).optional(),
  utmContent: trimmed(200).optional(),
  utmTerm: trimmed(200).optional(),
};

/**
 * The consent checkbox.
 *
 * `z.literal(true)` rather than a boolean, so an unchecked box is a validation
 * failure with a message rather than a falsy value that submits.
 */
const consent = z.literal(true, {
  message: "Tick the box to confirm we may contact you about this application.",
});

// ---------------------------------------------------------------- technician

export const technicianApplicationSchema = z.object({
  role: z.literal("field_technician"),
  applicationId: z.string().uuid(),

  // 1. Contact
  fullName: required("your full name"),
  email,
  phone,
  city: required("the city you live in", 120),
  countyOfResidence: required("the county you live in", 120),

  // 2. Coverage
  countiesServed: z
    .array(trimmed(120), { error: "Choose at least one county you are willing to serve." })
    .min(1, "Choose at least one county you are willing to serve."),
  reliableVehicle: yesNo("Answer whether you have a reliable vehicle."),
  willingToClimb: yesNo("Answer whether you are willing to climb roofs."),

  // 3. Experience
  backgrounds: z
    .array(trimmed(120), { error: "Choose at least one background." })
    .min(1, "Choose at least one background."),
  backgroundOther: trimmed(300).optional(),
  yearsExperience: required("your years of relevant experience", 60),
  part107: yesNo("Answer whether you hold an FAA Part 107 drone license."),
  liabilityInsurance: yesNo("Answer whether you hold general liability insurance."),

  // 4. Documents. Both optional for this role, deliberately: a good field
  // technician out of the trades frequently has no resume, and requiring one
  // would filter on paperwork rather than on the work.
  resume: uploadedFileSchema.optional(),
  certifications: uploadedFileSchema.optional(),

  // 5. Review
  consent,
  company,
  ...attribution,
});

// ------------------------------------------------------------------ engineer

export const engineerApplicationSchema = z.object({
  role: z.literal("professional_engineer"),
  applicationId: z.string().uuid(),

  // 1. Contact
  fullName: required("your full name"),
  email,
  phone,
  city: required("the city you are based in", 120),
  state: required("your state", 60),

  // 2. Licensure
  peLicenseNumber: required("your Texas PE license number", 40),
  yearFirstLicensedTexas: trimmed(4)
    .min(4, "Enter the year you were first licensed in Texas.")
    .refine((v) => {
      const year = Number(v);
      return Number.isInteger(year) && year >= 1940 && year <= new Date().getFullYear();
    }, "That year does not look right."),
  otherStateLicenses: trimmed(400).optional(),
  discipline: required("your discipline", 200),
  tdiAppointed: yesNo("Answer whether you hold a TDI windstorm appointment."),
  tdiWilling: yesNo("Answer whether you would be willing to obtain one."),

  // 3. Experience
  yearsStructural: required("your years of structural practice", 60),
  sealedWork: required(
    "a description of the residential and light commercial structural work you have personally sealed",
    4000,
  ),
  employmentStatus: required("your current employment status", 300),
  currentEorRoles: trimmed(600).optional(),

  // 4. Documents. The resume is required for this seat, because a licence
  // number alone does not describe practice.
  resume: uploadedFileSchema,
  licenseDocument: uploadedFileSchema.optional(),

  // 5. Review
  consent,
  company,
  ...attribution,
});

export type TechnicianApplication = z.infer<typeof technicianApplicationSchema>;
export type EngineerApplication = z.infer<typeof engineerApplicationSchema>;

/**
 * The step definitions.
 *
 * `fields` drives the per step validation on the client: the step is checked by
 * picking these keys out of the schema rather than by a second hand written
 * list, which is what stops the two drifting.
 */
export type StepDef = { id: string; title: string; blurb: string; fields: string[] };

export const technicianSteps: StepDef[] = [
  {
    id: "contact",
    title: "Contact",
    blurb: "How to reach you, and where you are.",
    fields: ["fullName", "email", "phone", "city", "countyOfResidence"],
  },
  {
    id: "coverage",
    title: "Coverage",
    blurb: "Which counties you would genuinely drive to. Be honest about the far edge.",
    fields: ["countiesServed", "reliableVehicle", "willingToClimb"],
  },
  {
    id: "experience",
    title: "Experience",
    blurb: "What you have actually done, rather than what you could learn.",
    fields: ["backgrounds", "backgroundOther", "yearsExperience", "part107", "liabilityInsurance"],
  },
  {
    id: "documents",
    title: "Documents",
    blurb: "Optional for this role. Attach them if you have them.",
    fields: ["resume", "certifications"],
  },
  {
    id: "review",
    title: "Review",
    blurb: "Check your answers before you send them.",
    fields: ["consent"],
  },
];

export const engineerSteps: StepDef[] = [
  {
    id: "contact",
    title: "Contact",
    blurb: "How to reach you, and where you are based.",
    fields: ["fullName", "email", "phone", "city", "state"],
  },
  {
    id: "licensure",
    title: "Licensure",
    blurb: "Your Texas licence, and whether you hold a windstorm appointment.",
    fields: [
      "peLicenseNumber",
      "yearFirstLicensedTexas",
      "otherStateLicenses",
      "discipline",
      "tdiAppointed",
      "tdiWilling",
    ],
  },
  {
    id: "experience",
    title: "Experience",
    blurb: "The practice behind the licence.",
    fields: ["yearsStructural", "sealedWork", "employmentStatus", "currentEorRoles"],
  },
  {
    id: "documents",
    title: "Documents",
    blurb: "A resume is required for this seat.",
    fields: ["resume", "licenseDocument"],
  },
  {
    id: "review",
    title: "Review",
    blurb: "Check your answers before you send them.",
    fields: ["consent"],
  },
];

/** Options offered in the flows, kept beside the schema that validates them. */
export const TECHNICIAN_BACKGROUNDS = [
  "Roofing",
  "General construction",
  "Home inspection",
  "Insurance adjusting",
  "Skilled trades",
  "Drone operations",
  "Other",
];

export const YEARS_OPTIONS = [
  "Less than 2 years",
  "2 to 5 years",
  "5 to 10 years",
  "More than 10 years",
];

export const ENGINEER_DISCIPLINES = [
  "Structural",
  "Civil",
  "Structural and civil",
  "Other",
];

/** Flatten a Zod error into { field: message }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
