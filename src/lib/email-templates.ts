import { business } from "@/config/business";

/**
 * Every outbound email this site sends, as pure functions.
 *
 * WHY THE TEMPLATES ARE NOT INSIDE THE ROUTES
 * -------------------------------------------
 * They used to be. Each API route assembled its own subject line and its own
 * list of label and value pairs, which meant the outbound copy lived in the same
 * file as the request handling and could only be read by sending an email.
 * scripts/email-audit.mjs could not reach it, so the one surface with no audit
 * on it was the one a customer receives.
 *
 * These functions take plain data and return a rendered message. No network, no
 * credentials, no server-only import, so the audit can render every template and
 * check it the way the site's own copy is checked.
 *
 * WHY PLAIN TEXT AND NO HTML PART
 * -------------------------------
 * These are operator notifications, not marketing. One person reads them, on a
 * phone, usually from a lock screen preview, and often replies to the sender
 * directly. Plain text is readable in that preview, quotable in a reply, and
 * immune to the image blocking that would hide half of an HTML version. The
 * audit knows there is no HTML part and reports the 375px render check as not
 * applicable rather than silently passing it.
 */

export type RenderedEmail = {
  /** A stable identifier, used by the audit to name a failure. */
  id: string;
  subject: string;
  /** The plain text body. There is deliberately no HTML part. */
  text: string;
  replyTo?: string;
  /**
   * Who receives it. Defaults to the operator when absent.
   *
   * Present because the applicant confirmation is the first template on this
   * site addressed to somebody other than the operator. Without it, notify()
   * would have sent every confirmation to the operator's inbox and the applicant
   * nothing at all, and the only symptom would have been silence on the side
   * nobody is watching.
   */
  to?: string;
  html?: string;
};

type Line = [string, string | null | undefined];

/**
 * Render label and value pairs, dropping the empty ones.
 *
 * A blank value is omitted rather than rendered as an empty line, so the
 * notification reads as what somebody actually submitted rather than as a form
 * with holes in it.
 */
function body(lines: Line[]): string {
  const rendered = lines
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join("\n");

  // The footer carries an absolute URL. A relative path in an email is dead
  // text, and the audit fails on one.
  return `${rendered}\n\nSubmitted through ${business.url}.`;
}

export type LeadEmailInput = {
  form: "contact" | "waitlist";
  name: string;
  email: string;
  phone?: string;
  city?: string;
  service?: string;
  message?: string;
  landingPath?: string;
  referrer?: string;
};

export function leadNotification(input: LeadEmailInput): RenderedEmail {
  const isWaitlist = input.form === "waitlist";
  const where = input.service ? ` (${input.service})` : "";

  return {
    id: isWaitlist ? "lead.waitlist" : "lead.contact",
    subject: `${isWaitlist ? "Waitlist" : "Contact"}: ${input.name}${where}`,
    replyTo: input.email,
    text: body([
      ["Form", isWaitlist ? "Waitlist" : "Contact"],
      ["Name", input.name],
      ["Email", input.email],
      ["Phone", input.phone],
      ["City", input.city],
      ["Service of interest", input.service],
      ["Message", input.message],
      ["Page", input.landingPath],
      ["Referrer", input.referrer],
    ]),
  };
}





/**
 * The operator's application notification, which is the onboarding package.
 *
 * WHY THIS EMAIL CARRIES EVERYTHING
 * ---------------------------------
 * There is no admin portal on this site and there should not be one yet. So this
 * email is the record: it has to contain every answer the applicant gave,
 * organized the way they gave it, with working links to their documents, so that
 * evaluating somebody and starting to onboard them needs nothing but the inbox.
 * An email that says "a new application was received, log in to view it" would
 * be a notification about a thing rather than the thing.
 *
 * Sections mirror the application steps, so reading the email and reading the
 * form are the same experience in the same order.
 */
export type ApplicationEmailInput = {
  /** Short role name. It has to fit a phone notification with a name and a city. */
  roleLabel: string;
  /** The full position title, for the body. */
  positionTitle: string;
  applicationId: string;
  name: string;
  email: string;
  city: string;
  /** Ordered sections of label and value pairs, already formatted. */
  sections: { heading: string; rows: Line[] }[];
  /** Signed, time limited links to whatever was uploaded. */
  documents: { label: string; filename: string; url: string | null }[];
};

export function applicationNotification(input: ApplicationEmailInput): RenderedEmail {
  const parts: string[] = [];

  for (const section of input.sections) {
    const rows = section.rows
      .filter(([, value]) => value != null && String(value).trim() !== "")
      .map(([label, value]) => `  ${label}: ${String(value).trim()}`)
      .join("\n");
    if (rows) parts.push(`${section.heading.toUpperCase()}\n${rows}`);
  }

  if (input.documents.length > 0) {
    const lines = input.documents
      .map((d) =>
        d.url
          ? `  ${d.label}: ${d.filename}\n    ${d.url}`
          : `  ${d.label}: ${d.filename}\n    Link unavailable. The file is in the eng-uploads bucket under ${input.applicationId}.`,
      )
      .join("\n");
    parts.push(`DOCUMENTS\n${lines}\n\n  Document links expire in seven days.`);
  } else {
    parts.push("DOCUMENTS\n  None attached.");
  }

  parts.push(`REFERENCE\n  Application id: ${input.applicationId}`);

  return {
    id: "apply.notification",
    subject: `New application: ${input.roleLabel} | ${input.name} | ${input.city}`,
    replyTo: input.email,
    text: `${parts.join("\n\n")}\n\nSubmitted through ${business.url}.`,
  };
}

/**
 * The applicant's confirmation.
 *
 * Short, in the firm's voice, and it makes exactly one promise: that a person
 * will read it and reply either way. It does not thank them for their interest
 * in joining a team, because there is no team yet, and it does not imply a
 * timeline the firm has not committed to.
 */
export function applicantConfirmation(input: {
  roleLabel: string;
  name: string;
  /** The applicant. This is the one template not addressed to the operator. */
  email: string;
  applicationId: string;
  nextStep: string;
}): RenderedEmail {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;

  return {
    id: "apply.confirmation",
    to: input.email,
    // Replies go to the firm. This is the one template where the recipient is
    // not the operator, so reply-to cannot be the submitter as it is elsewhere.
    replyTo: business.email,
    subject: `We have your application, ${firstName}`,
    text: [
      `${firstName},`,
      "",
      `Your application for ${input.roleLabel} reached us and it is on the list to be read.`,
      "",
      "A person reads every one of these, not a filter. You will get a reply either way, including when the reply is that the firm is not in a position to bring you on yet. That is a real outcome here and it is said plainly rather than left as silence.",
      "",
      input.nextStep,
      "",
      `Your reference is ${input.applicationId.slice(0, 8)}. Quote it if you need to get in touch about this application.`,
      "",
      `254 Engineering Services`,
      `${business.url}`,
    ].join("\n"),
  };
}

/**
 * Every template, rendered with representative data, for the audit.
 *
 * The sample values are deliberately obvious placeholders in the audit's own
 * namespace. They never reach a real send, and the credential shaped ones are
 * exactly the kind of string the placeholder audit is built to reject, which is
 * why they live here and not in any module the site imports at runtime.
 */
export function allTemplatesForAudit(): RenderedEmail[] {

  return [
    leadNotification({
      form: "contact",
      name: "Sample Enquirer",
      email: "sample.enquirer@254engineering.com",
      phone: "Not given",
      city: "Victoria",
      service: "Windstorm WPI-8 Certifications",
      message: "A short description of what the project needs and when.",
      landingPath: "/contact",
      referrer: "https://www.google.com/",
    }),
    leadNotification({
      form: "waitlist",
      name: "Sample Enquirer",
      email: "sample.enquirer@254engineering.com",
      city: "Rockport",
      service: "Roof Inspections and Certifications",
      landingPath: "/waitlist",
    }),
    applicationNotification({
      roleLabel: "Field Technician",
      positionTitle: "Field Inspection Technician",
      applicationId: "00000000-0000-4000-8000-000000000000",
      name: "Sample Applicant",
      email: "sample.applicant@254engineering.com",
      city: "Corpus Christi",
      sections: [
        {
          heading: "Contact",
          rows: [
            ["Full name", "Sample Applicant"],
            ["Email", "sample.applicant@254engineering.com"],
            ["Phone", "Not given"],
            ["City", "Corpus Christi"],
            ["County of residence", "Nueces"],
          ],
        },
        {
          heading: "Coverage",
          rows: [
            ["Counties willing to serve", "Nueces, San Patricio, Aransas, Refugio"],
            ["Reliable vehicle", "Yes"],
            ["Willing to climb roofs", "Yes"],
          ],
        },
        {
          heading: "Experience",
          rows: [
            ["Background", "Roofing, Insurance adjusting"],
            ["Years of relevant experience", "5 to 10 years"],
            ["FAA Part 107 drone license", "Yes"],
            ["General liability insurance", "No"],
          ],
        },
      ],
      documents: [
        {
          label: "Resume",
          filename: "resume.pdf",
          url: "https://254engineering.com/sample-signed-link",
        },
      ],
    }),
    applicantConfirmation({
      roleLabel: "Field Inspection Technician",
      name: "Sample Applicant",
      email: "sample.applicant@254engineering.com",
      applicationId: "00000000-0000-4000-8000-000000000000",
      nextStep:
        "If the fit looks right, the next step is a short call about the counties you would genuinely drive to and what you have inspected before.",
    }),
  ];
}
