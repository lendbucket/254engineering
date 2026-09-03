import { business } from "@/config/business";
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

/**
 * The operator's notification that an onboarding has been submitted.
 *
 * WHAT IS DELIBERATELY NOT IN IT
 * ------------------------------
 * No invite token, no signed URL, and no document. An email is the least
 * controlled place a credential can end up: it sits in an inbox indefinitely, it
 * is forwarded, and it is indexed by whatever the operator's mail provider does.
 * Putting a working link to somebody's passport in one would undo the ten minute
 * signed URL ceiling in src/lib/onboarding-uploads.ts.
 *
 * So this says what happened and where to go. The operator follows a plain admin
 * URL, signs in, and mints a signed URL there when they actually need to look at
 * a document. That is one more click and it is the difference between a link
 * that lives for ten minutes and one that lives forever.
 */
export function onboardingSubmitted(input: {
  personName: string;
  personEmail: string;
  role: "engineer" | "field_tech";
  onboardingId: string;
  itemCount: number;
}): RenderedEmail {
  const roleLabel =
    input.role === "engineer" ? "Professional Engineer" : "Field Inspection Technician";

  return compose(
    "onboarding.submitted",
    "operator",
    `Onboarding submitted: ${input.personName}`,
    {
      preheader: `${input.personName} finished their onboarding checklist and it is ready to review.`,
      blocks: [
        { kind: "p", text: `${input.personName} has submitted their onboarding.` },
        {
          kind: "details",
          title: "Who",
          rows: [
            ["Name", input.personName],
            ["Email", input.personEmail],
            ["Role", roleLabel],
          ],
        },
        {
          kind: "details",
          title: "What is waiting",
          rows: [
            ["Checklist items complete", String(input.itemCount)],
            [
              "Still needs you",
              "Identity confirmed on the video call, and I-9 Section 2 document examination, which federal procedure requires be done live.",
            ],
          ],
        },
        {
          kind: "note",
          text: "Documents are not attached and no link in this message opens one. Sign in to the admin portal and open them there, where each link lasts ten minutes.",
        },
      ],
      // The button goes to the portal, not to a document. See the note above on
      // why a signed URL never travels in an email.
      button: {
        label: "Open in the admin portal",
        url: `${business.url}/admin/onboarding/${input.onboardingId}`,
      },
    },
    { replyTo: input.personEmail },
  );
}

/**
 * The invite, sent to the person being onboarded.
 *
 * This one DOES carry a token, because the token is the entire point of it and
 * there is no other way to reach the flow. That is a considered trade rather
 * than an oversight: the link is single purpose, it expires in fourteen days, it
 * is regenerable, and generating a new one invalidates the old.
 *
 * Sent by the operator from the admin portal rather than automatically on
 * creation, so a link is never in flight before the operator meant it to be.
 */
export function onboardingInvite(input: {
  personName: string;
  personEmail: string;
  role: "engineer" | "field_tech";
  inviteUrl: string;
  expiresAt: string;
}): RenderedEmail {
  const roleLabel =
    input.role === "engineer" ? "Professional Engineer" : "Field Inspection Technician";

  return compose(
    "onboarding.invite",
    // A person outside the firm reads this one, so it is named and signed.
    "human",
    `Your onboarding for ${business.name}`,
    {
      preheader: `Your onboarding link for the ${roleLabel} role, and what to have ready.`,
      signed: true,
      blocks: [
        { kind: "p", text: `${input.personName},` },
        {
          kind: "p",
          text: `Welcome to ${business.name}. Before your first assignment there are a few documents to collect for the ${roleLabel} role.`,
        },
        {
          kind: "p",
          text: `The link below works until ${input.expiresAt} and it is yours alone. Your progress saves as you go, so you can stop and come back to the same link.`,
        },
        { kind: "heading", text: "What you will need" },
        {
          kind: "p",
          text: "A government issued photo ID, and the forms named in the flow. Each step says what it wants and links the form where one is needed.",
        },
        {
          kind: "note",
          text: "You are never asked to type a social security, account, or routing number into this site. Where a form involves one, you upload the completed document and nothing is read out of it.",
        },
        {
          kind: "p",
          text: `If something is wrong, reply to this message or write to ${business.email} and a new link will be issued.`,
        },
      ],
      button: { label: "Open your onboarding", url: input.inviteUrl },
    },
    { to: input.personEmail },
  );
}

/**
 * The portal invitation.
 *
 * NO PASSWORD IN THIS EMAIL, AND THAT IS THE POINT
 * ------------------------------------------------
 * The admin does not choose a password and the platform does not generate one to
 * send. A temporary password in an email is a working credential sitting in two
 * mailboxes for as long as either of them exists, and it is still valid after
 * the person has changed it if they never actually did.
 *
 * What goes out is a one time link. The person chooses their own password behind
 * it, the link dies on use, and it expires on its own if they never open it.
 */
export function portalInvite(input: {
  personName: string;
  personEmail: string;
  role: "admin" | "engineer" | "field_tech";
  /** Absent when the address already had credentials on this project. */
  setPasswordUrl: string | null;
  expiresAt: string | null;
  invitedBy: string;
  signInUrl: string;
}): RenderedEmail {
  const roleLabel =
    input.role === "admin"
      ? "Administrator"
      : input.role === "engineer"
        ? "Professional Engineer"
        : "Field Technician";

  return compose(
    "portal.invite",
    "human",
    `Your ${business.shortName} portal account`,
    {
      preheader: `Set your password and sign in as ${roleLabel}.`,
      signed: true,
      blocks: [
        { kind: "p", text: `${input.personName},` },
        {
          kind: "p",
          text: `An account has been created for you on the ${business.name} portal with the ${roleLabel} role. ${input.invitedBy} set it up.`,
        },
        {
          kind: "p",
          text: input.setPasswordUrl
            ? `Your sign in address is ${input.personEmail}. Use the button below to choose a password, and you are in.`
            : `Your sign in address is ${input.personEmail}, and you already have a password for it. Use the button below and sign in with the password you already use.`,
        },
        {
          kind: "note",
          text: input.setPasswordUrl
            ? `The link works once and expires ${input.expiresAt}. Nobody at the firm knows or can see your password, including whoever created the account.`
            : "Your existing password was not changed and nobody at the firm can see it. If you have forgotten it, ask an administrator to send a reset link.",
        },
        {
          kind: "p",
          text: `If you were not expecting this, write to ${business.email} and it will be cancelled.`,
        },
      ],
      button: input.setPasswordUrl
        ? { label: "Choose your password", url: input.setPasswordUrl }
        : { label: "Sign in to the portal", url: input.signInUrl },
    },
    { to: input.personEmail },
  );
}

/** An administrator forcing a reset, or a person who has lost their password. */
export function portalPasswordReset(input: {
  personName: string;
  personEmail: string;
  setPasswordUrl: string;
  expiresAt: string;
  forcedByAdmin: boolean;
}): RenderedEmail {
  return compose(
    "portal.password_reset",
    "human",
    `Reset your ${business.shortName} portal password`,
    {
      preheader: "A one time link to choose a new password.",
      signed: true,
      blocks: [
        { kind: "p", text: `${input.personName},` },
        {
          kind: "p",
          text: input.forcedByAdmin
            ? "An administrator has reset your portal password. Your previous password no longer works and any open sessions have ended."
            : "A password reset was requested for your portal account.",
        },
        {
          kind: "note",
          text: `The link works once and expires ${input.expiresAt}.`,
        },
        {
          kind: "p",
          text: `If you did not expect this, write to ${business.email} straight away.`,
        },
      ],
      button: { label: "Choose a new password", url: input.setPasswordUrl },
    },
    { to: input.personEmail },
  );
}

/**
 * The one email every portal notification goes out as.
 *
 * WHY ONE TEMPLATE AND NOT ONE PER KIND
 * -------------------------------------
 * Thirteen notification kinds would be thirteen templates, thirteen entries in
 * the email audit, and thirteen places for the voice to drift. They all say the
 * same shape of thing: something happened, here is what, here is where to look.
 * The kind decides the words, which are composed where the event happens and
 * where the context actually is; this decides how they are dressed.
 *
 * It is "human" rather than "operator" because a field technician reading that
 * a job was offered to them is a person outside the office, not a machine to
 * machine log line, and the audit holds human mail to a named sender and a real
 * reply address.
 */
export function opsNotification(input: {
  to: string;
  title: string;
  body: string | null;
  href: string | null;
}): RenderedEmail {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://254engineering.com").replace(/\/$/, "");
  const url = input.href ? (input.href.startsWith("http") ? input.href : `${base}${input.href}`) : null;

  return compose(
    "ops.notification",
    "human",
    input.title,
    {
      preheader: input.body ?? input.title,
      signed: true,
      blocks: [
        { kind: "p", text: input.title },
        ...(input.body ? [{ kind: "p" as const, text: input.body }] : []),
        {
          kind: "note",
          text: "You can change which of these reach you by email, on your profile in the portal. A few cannot be turned off: a document of yours expiring, and a certification being withdrawn. Both stop you being offered work, so you are told even if you have muted everything else.",
        },
      ],
      button: url ? { label: "Open it in the portal", url } : undefined,
    },
    { to: input.to },
  );
}


export function allTemplatesForAudit(): RenderedEmail[] {

  return [
    /*
     * Every portal notification goes out as this one template, so the audit
     * holds one thing rather than thirteen near copies of it.
     */
    opsNotification({
      to: "sample.tech@254engineering.com",
      title: "A job in Nueces County is offered to you",
      body: "1400 Sample Street, Corpus Christi. Windstorm evidence, flat rate $185.00.",
      href: "/portal/jobs",
    }),
    portalInvite({
      personName: "Sample Engineer",
      personEmail: "sample.engineer@254engineering.com",
      role: "engineer",
      setPasswordUrl: "https://254engineering.com/portal/set-password?token=sample",
      expiresAt: "in three days",
      invitedBy: "Sample Administrator",
      signInUrl: "https://254engineering.com/portal/login",
    }),
    portalPasswordReset({
      personName: "Sample Technician",
      personEmail: "sample.tech@254engineering.com",
      setPasswordUrl: "https://254engineering.com/portal/set-password?token=sample",
      expiresAt: "in three days",
      forcedByAdmin: true,
    }),
    onboardingSubmitted({
      personName: "Sample Engineer",
      personEmail: "sample.engineer@254engineering.com",
      role: "engineer",
      onboardingId: "00000000-0000-4000-8000-000000000000",
      itemCount: 8,
    }),
    onboardingInvite({
      personName: "Sample Engineer",
      personEmail: "sample.engineer@254engineering.com",
      role: "engineer",
      inviteUrl: "https://254engineering.com/onboarding/sample-token-not-a-real-invite-abcdefghij",
      expiresAt: "7 September 2026",
    }),
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
