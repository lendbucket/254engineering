import { emailIdentity, fromHeader, type SenderPurpose } from "@/config/email-identity";
import {
  renderEmailHtml,
  renderEmailText,
  type EmailBlock,
  type LayoutInput,
} from "./email-layout";

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
 * PLAIN TEXT ONLY IS SUPERSEDED, AND THE REASONING IS KEPT
 * --------------------------------------------------------
 * These were text only, and the argument was good: an operator reads a
 * notification from a lock screen preview, and image blocking hides half of an
 * HTML email. That argument was for plain text OR html.
 *
 * Every template is multipart now, so the preview stays readable, a blocked
 * image costs nothing, and what a candidate opens looks like it came from a
 * firm. The text part is still required by the audit and is generated from the
 * same blocks as the HTML, so the two cannot drift.
 *
 * The layout itself is src/lib/email-layout.ts. Templates below assemble blocks
 * and never write markup, which is what keeps one change to the header or the
 * footer reaching every message this firm sends.
 */

export type RenderedEmail = {
  /** A stable identifier, used by the audit to name a failure. */
  id: string;
  subject: string;
  /** The plain text part. Generated from the same blocks as the HTML. */
  text: string;
  /**
   * Which sender identity this goes out as.
   *
   * "operator" is machine to operator and is not signed. "human" is anything a
   * person outside the firm reads: named From, reply-to a mailbox somebody
   * actually reads, and a signature block. The audit asserts the signature
   * matches src/config/email-identity.ts.
   */
  purpose: SenderPurpose;
  /** The From header, derived from the purpose. */
  from: string;
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
 * Assemble a template from blocks.
 *
 * Every template goes through here, so no template can render its own markup,
 * forget the plaintext part, or pick a From header that disagrees with its
 * signature.
 */
function compose(
  id: string,
  purpose: SenderPurpose,
  subject: string,
  layout: LayoutInput,
  extra: { to?: string; replyTo?: string } = {},
): RenderedEmail {
  /*
   * Reply-to defaults from the sender identity, and that is not a nicety.
   *
   * The human templates went out with no reply-to at all after the layout
   * landed, because the value used to be written into each template by hand and
   * the rewrite dropped it. A candidate hitting reply on a confirmation would
   * have replied to the send-only notifications address.
   *
   * An operator template overrides it with the enquirer's address, which is what
   * makes replying from a phone the whole workflow. A human template that says
   * nothing gets the mailbox somebody actually reads.
   */
  const sender = emailIdentity.senders[purpose];
  const replyTo =
    extra.replyTo ?? ("replyTo" in sender ? (sender.replyTo as string) : undefined);

  return {
    id,
    purpose,
    from: fromHeader(purpose),
    subject,
    html: renderEmailHtml(layout),
    text: renderEmailText(layout),
    ...extra,
    replyTo,
  };
}

/** Label and value pairs with the empty ones dropped, as layout rows. */
function rows(lines: Line[]): [string, string][] {
  return lines
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => [k, String(v).trim()] as [string, string]);
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

  return compose(
    isWaitlist ? "lead.waitlist" : "lead.contact",
    "operator",
    `${isWaitlist ? "Waitlist" : "Contact"}: ${input.name}${where}`,
    {
      preheader: `${isWaitlist ? "Waitlist" : "Contact"} enquiry from ${input.name}${input.city ? " in " + input.city : ""}.`,
      blocks: [
        {
          kind: "p",
          text: `${input.name} submitted the ${isWaitlist ? "waitlist" : "contact"} form.`,
        },
        {
          kind: "details",
          title: isWaitlist ? "Waitlist enquiry" : "Contact enquiry",
          rows: rows([
            ["Name", input.name],
            ["Email", input.email],
            ["Phone", input.phone],
            ["City", input.city],
            ["Service of interest", input.service],
            ["Message", input.message],
          ]),
        },
        {
          kind: "details",
          title: "Where they came from",
          rows: rows([
            ["Page", input.landingPath],
            ["Referrer", input.referrer],
          ]),
        },
      ],
    },
    // Replying to this email replies to the person who submitted it, which is
    // the whole workflow for an operator reading it on a phone.
    { replyTo: input.email },
  );
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
  const blocks: EmailBlock[] = [
    {
      kind: "p",
      text: `${input.name} applied for ${input.positionTitle}, from ${input.city}.`,
    },
  ];

  for (const section of input.sections) {
    const r = rows(section.rows);
    if (r.length > 0) blocks.push({ kind: "details", title: section.heading, rows: r });
  }

  if (input.documents.length > 0) {
    blocks.push({
      kind: "details",
      title: "Documents",
      rows: input.documents.map(
        (d) =>
          [
            d.label,
            d.url
              ? `${d.filename} ${d.url}`
              : `${d.filename}. Link unavailable. The file is in the eng-uploads bucket under ${input.applicationId}.`,
          ] as [string, string],
      ),
    });
    blocks.push({ kind: "note", text: "Document links expire in seven days." });
  } else {
    blocks.push({ kind: "details", title: "Documents", rows: [["Attached", "None"]] });
  }

  blocks.push({
    kind: "details",
    title: "Reference",
    rows: [["Application id", input.applicationId]],
  });

  return compose(
    "apply.notification",
    "operator",
    `New application: ${input.roleLabel} | ${input.name} | ${input.city}`,
    {
      preheader: `${input.name} applied for ${input.roleLabel}. Everything they submitted is in this message.`,
      blocks,
    },
    { replyTo: input.email },
  );
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

  return compose(
    "apply.confirmation",
    // The one template a person outside the firm reads, so it is named and
    // signed rather than arriving from a brand with nobody behind it.
    "human",
    `We have your application, ${firstName}`,
    {
      preheader: `Your application for ${input.roleLabel} reached us and a person will read it.`,
      signed: true,
      blocks: [
        { kind: "p", text: `${firstName},` },
        {
          kind: "p",
          text: `Your application for ${input.roleLabel} reached us and it is on the list to be read.`,
        },
        {
          kind: "p",
          text: "A person reads every one of these, not a filter. You will get a reply either way, including when the reply is that the firm is not in a position to bring you on yet. That is a real outcome here and it is said plainly rather than left as silence.",
        },
        { kind: "p", text: input.nextStep },
        {
          kind: "note",
          text: `Your reference is ${input.applicationId.slice(0, 8)}. Quote it if you need to get in touch about this application.`,
        },
      ],
    },
    { to: input.email },
  );
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
