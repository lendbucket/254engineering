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
