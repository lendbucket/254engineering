import { z } from "zod";

/**
 * The shapes every intake route validates against.
 *
 * Kept out of the server-only modules deliberately: the client forms import the
 * same schemas to validate before they post, so a required field cannot be
 * required in one place and optional in the other. The schemas contain no
 * credentials and no server logic, so shipping them to the browser costs
 * nothing.
 *
 * Server side validation is not skipped because the client validates. The client
 * check exists so a person gets told about a typo without a round trip; the
 * server check exists because a form is an HTTP endpoint and anyone can post to
 * it.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (label: string, max = 200) =>
  trimmed(max).min(1, `Enter ${label}.`);

/**
 * Email is validated loosely on purpose.
 *
 * Strict RFC validation rejects addresses that work, and the only thing a
 * rejection achieves here is losing a real enquiry. Shape checking catches the
 * typo that matters, a missing @ or a missing dot, and delivery proves the rest.
 */
const email = trimmed(200)
  .min(1, "Enter your email address.")
  .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v), "That email address does not look right.");

/**
 * Phone is optional everywhere, and where it is given it only has to contain
 * enough digits to be dialable. Formats vary and a person typing their own
 * number is not the enemy.
 */
const phone = trimmed(40)
  .optional()
  .refine(
    (v) => !v || v.replace(/\D/g, "").length >= 10,
    "That phone number looks short. Ten digits or more, please.",
  );

/**
 * The honeypot.
 *
 * Named `company` because that is a field a naive bot fills in without
 * hesitating. It is rendered off screen and out of the tab order, so a human
 * never sees it. A submission carrying a value is accepted with a normal success
 * response and silently dropped rather than rejected, because a bot that is told
 * it failed learns to try again differently.
 */
const honeypot = trimmed(200).optional();

export const contactSchema = z.object({
  name: requiredText("your name"),
  email,
  phone,
  city: trimmed(120).optional(),
  service: trimmed(120).optional(),
  message: requiredText("a short description of what you need", 4000),
  company: honeypot,
  landingPath: trimmed(300).optional(),
  referrer: trimmed(500).optional(),
});

/**
 * THE DESIGN INQUIRY. Eleven defined answers, three of which decide whether the
 * firm takes the work at all.
 *
 * THE FOUR VOCABULARIES ARE THE DATABASE'S, TYPED OUT RATHER THAN IMPORTED, and
 * that duplication is the mechanism rather than an oversight. 0050 constrains
 * `asking_as`, `work_kind` and `deliverable` with check constraints. If this
 * schema derived from the same constant, a fifth value added in one place would
 * be accepted in both and nothing would disagree. Written twice, adding one
 * costs two edits made on purpose, and a mismatch is a 422 rather than a
 * constraint violation at the database.
 *
 * THE THREE FLAGS ARE REQUIRED BOOLEANS WITH NO DEFAULT, which is the absent
 * versus zero rule on the three questions that matter most. "Nobody answered"
 * and "they said no" are different facts, and a form that defaulted them to
 * false would record the second when it meant the first, on exactly the
 * questions that decide whether the firm declines the work.
 */
const ASKING_AS = ["owner", "builder", "architect", "engineer"] as const;
const WORK_KIND = ["new_construction", "addition", "repair", "remediation"] as const;
const DELIVERABLE = ["sealed_plans", "sealed_letter", "repair_specification", "design_review"] as const;

export const designInquirySchema = z.object({
  name: requiredText("your name"),
  email,
  phone,
  askingAs: z.enum(ASKING_AS, { message: "Tell us which of these you are." }),
  workKind: z.enum(WORK_KIND, { message: "Tell us what kind of work this is." }),
  deliverable: z.enum(DELIVERABLE, { message: "Tell us what you need produced." }),
  propertyAddress: requiredText("the property address"),
  jurisdiction: trimmed(200).optional(),
  squareFeet: z.coerce.number().int().positive().max(10_000_000).optional(),
  storeys: z.coerce.number().int().positive().max(200).optional(),
  drawings: trimmed(2000).optional(),
  soilReport: z.boolean().optional(),
  permitStatus: trimmed(200).optional(),
  deadline: trimmed(300).optional(),
  /*
   * No .optional() and no .default(). A missing flag fails validation and the
   * message says which, rather than being quietly recorded as "no".
   */
  openInsuranceClaim: z.boolean({ message: "Answer whether there is an open insurance claim." }),
  activeLitigation: z.boolean({ message: "Answer whether there is active or threatened litigation." }),
  priorAdverseReport: z.boolean({ message: "Answer whether a prior adverse report exists." }),
  company: honeypot,
  landingPath: trimmed(300).optional(),
  referrer: trimmed(500).optional(),
});

/*
 * =========================================================================
 * THE WINDSTORM BRIEF, FOR AN EXISTING BUILDING. Operator ruling, 2026-09-20.
 * =========================================================================
 *
 * ITS OWN SCHEMA AND ITS OWN TABLE, not a reuse of the design brief above.
 * The columns overlap and **the questions are not the same questions**. A
 * design brief asks what is being built, what the deliverable is, whether
 * drawings exist and whether there is a soil report. This asks when the
 * building was built, what has been covered up, whether the openings are
 * rated, and whether the owner will open things up to verify. Half of these
 * have no column over there, and forcing them in would mean either windstorm
 * columns null on every design row or a column answering a question it was not
 * named for. Both are the shape this build spends its time removing.
 *
 * EVERY QUESTION HERE IS THE ENGINEER OF RECORD'S, from his reply of
 * 2026-09-20. They are not a guess at what scoping needs.
 *
 * WHY THERE IS NO PRICE AND NO ORDER. Only buildings constructed after 1988
 * can be certified, the construction that needs inspecting is already covered
 * so parts of it must be opened, and the openings may need replacing before a
 * certification is possible at all. Any of the three changes what the work is,
 * so this is scoped one property at a time.
 */
const WINDSTORM_ASKING_AS = ["owner", "buyer", "agent", "builder", "contractor"] as const;
const OPENINGS_RATED = ["yes_documented", "yes_undocumented", "no", "unknown"] as const;
const WILL_OPEN_UP = ["yes", "no", "need_to_discuss"] as const;

export const windstormInquirySchema = z.object({
  name: requiredText("your name"),
  email,
  phone,
  askingAs: z.enum(WINDSTORM_ASKING_AS, { message: "Tell us which of these you are." }),
  propertyAddress: requiredText("the property address"),
  county: trimmed(120).optional(),
  /*
   * ===================================================================
   * THE YEAR BUILT IS CONTEXT. THE DATE OF THE WORK IS THE RULE.
   * Operator ruling, 2026-09-21, reversing the first encoding.
   * ===================================================================
   *
   * Tex. Ins. Code 2210.251, as the firm's own published page reads it, turns
   * on the date of the WORK: "a structure constructed, altered, remodeled,
   * enlarged, or repaired, or to which additions are made, on or after January
   * 1, 1988". A roof replaced last year on a house built in 1975 is in scope.
   *
   * The first version asked for the construction year and compared THAT to
   * 1988, which turned away the commonest legitimate enquiry this form exists
   * to receive.
   *
   * `yearBuilt` stays because it is useful to the engineer, and it is optional
   * and is NOT what the rule reads. Pre-1988 construction with no later work
   * may be eligible without inspection at all, which is a different and better
   * answer than a certification.
   */
  yearBuilt: z.coerce.number().int().min(1800).max(2100).optional(),
  /*
   * THE MOST RECENT WORK IS SUFFICIENT, AND THAT IS EXACT RATHER THAN A
   * SIMPLIFICATION. The rule asks whether ANY work reaches the line. If the
   * most recent piece does, the structure is in scope; if the most recent
   * predates the line, everything earlier does too. One date answers it.
   *
   * `workYearUnknown` carries no default, so a person who does not know says
   * so rather than having a zero recorded for them.
   */
  mostRecentWorkYear: z.coerce.number().int().min(1800).max(2100).optional(),
  workYearUnknown: z.boolean({
    message: "Tell us the year of the most recent work, or that you do not know.",
  }),
  workDone: requiredText("what work has been done"),
  whatIsCovered: requiredText("what is already covered up"),
  openingsRated: z.enum(OPENINGS_RATED, {
    message: "Tell us whether the doors and windows are rated for wind, or that you do not know.",
  }),
  willOpenUp: z.enum(WILL_OPEN_UP, {
    message: "Tell us whether the owner is willing to open up covered work so it can be verified.",
  }),
  deadline: trimmed(300).optional(),
  /*
   * The same three flags as the design brief, with no .optional() and no
   * .default(), for the same reason: a missing flag fails validation and the
   * message says which, rather than being quietly recorded as "no".
   */
  openInsuranceClaim: z.boolean({ message: "Answer whether there is an open insurance claim." }),
  activeLitigation: z.boolean({ message: "Answer whether there is active or threatened litigation." }),
  priorAdverseReport: z.boolean({ message: "Answer whether a prior adverse report exists." }),
  company: honeypot,
  landingPath: trimmed(300).optional(),
  referrer: trimmed(500).optional(),
});

export const waitlistSchema = z.object({
  name: requiredText("your name"),
  email,
  phone,
  city: trimmed(120).optional(),
  service: trimmed(120).optional(),
  message: trimmed(4000).optional(),
  company: honeypot,
  landingPath: trimmed(300).optional(),
  referrer: trimmed(500).optional(),
});

/*
 * The careers application schemas used to live here, one flat object per role.
 * They were replaced by the multi step flows in src/lib/application-schemas.ts
 * and deleted rather than left in place, because a dead schema is one an audit
 * can still drive: scripts/forms-audit.mjs was exercising a form no page
 * rendered, and reporting it green.
 */

export type ContactInput = z.infer<typeof contactSchema>;
export type WaitlistInput = z.infer<typeof waitlistSchema>;

/** Flatten a Zod error into { field: message } for a form to render inline. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
