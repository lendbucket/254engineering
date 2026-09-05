import { business } from "@/config/business";
import { emailIdentity, fromHeader, type SenderPurpose } from "@/config/email-identity";
import {
  OUTCOME_HEADLINE,
  OUTCOME_MEANING,
  type ProbeOutcome,
} from "./health-watch";
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

/**
 * The payment link for a job the customer did not place themselves.
 *
 * Phase 10 Section 1 item 4. Somebody telephoned, the firm wrote the job down,
 * and this is how they pay for it.
 *
 * UNEXERCISED UNTIL LAUNCH, and deliberately so: the compliance gate refuses
 * every payment while registration is pending, so this template is composed,
 * audited for voice and layout like every other, and has never been sent.
 *
 * The tone assumes a conversation already happened. Somebody agreed to this on
 * a call, so the email confirms rather than sells, and the price is stated as
 * the figure they were told rather than introduced as news.
 */
export function jobPaymentLink(input: {
  customerName: string;
  customerEmail: string;
  reference: string;
  propertyAddress: string;
  deliverableName: string;
  amount: string;
  payUrl: string;
  /** Who took the call, so the customer knows who to reply to. */
  takenBy: string;
}): RenderedEmail {
  return compose(
    "job.payment_link",
    "human",
    `Your ${input.deliverableName} for ${input.propertyAddress}`,
    {
      preheader: `Reference ${input.reference}. Nothing is charged until you complete the payment page.`,
      signed: true,
      blocks: [
        { kind: "p", text: `${input.customerName},` },
        {
          kind: "p",
          text: `This is the ${input.deliverableName} for ${input.propertyAddress} that you arranged with ${input.takenBy}. The reference is ${input.reference}.`,
        },
        { kind: "p", text: `The agreed price is ${input.amount}.` },
        {
          kind: "note",
          text: "Card details are entered on the payment provider's page and never reach this firm. Nothing is charged until you complete it.",
        },
        {
          kind: "p",
          text: `If anything here is wrong, reply to this email before paying and it will be corrected.`,
        },
      ],
      button: { label: "Pay for this job", url: input.payUrl },
    },
    { to: input.customerEmail },
  );
}

/**
 * Asking a customer for the things the job is still missing.
 *
 * Phase 10 Section 1.5 Section C item 4. Chasing by hand is the thing that
 * exercise exists to prevent, and a chase that lists everything the firm will
 * ever want is a chase nobody answers. This names exactly what is outstanding
 * at the stage that is blocked, in the customer's own words from the
 * definition, and says what it is holding up.
 */
export function outstandingInformation(input: {
  customerName: string;
  customerEmail: string;
  fileNumber: string;
  propertyAddress: string;
  /**
   * What is outstanding, each with when it is needed.
   *
   * The labels come from data/intake-fields.ts so the email and the screen say
   * the same words, and the "when" is what turns a list into something a person
   * can prioritise: a gate code before a visit is more urgent than an addressee
   * before sealing, and a chase that flattens the two gets answered late.
   */
  items: { label: string; when: string }[];
  /** What it is holding up, in a customer's terms. */
  holdingUp: string;
  supplyUrl: string;
}): RenderedEmail {
  return compose(
    "job.outstanding_information",
    "human",
    `A few things needed for ${input.propertyAddress}`,
    {
      preheader: `${input.items.length} item${input.items.length === 1 ? "" : "s"} outstanding on ${input.fileNumber}.`,
      signed: true,
      blocks: [
        { kind: "p", text: `${input.customerName},` },
        {
          kind: "p",
          text: `The firm has ${input.fileNumber} for ${input.propertyAddress} open and needs a few things before ${input.holdingUp}.`,
        },
        { kind: "details", title: "What is outstanding", rows: input.items.map((i) => [i.label, i.when]) },
        {
          kind: "note",
          text: "Nothing here is a delay on your side alone. The work carries on where it can, and this is what it needs from you to finish.",
        },
      ],
      button: { label: "Send these to the firm", url: input.supplyUrl },
    },
    { to: input.customerEmail },
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


export type OutageAlertInput = {
  /**
   * Which fault this is. Three of the four outcomes send the operator to three
   * different places, and one generic "the site is down" would send them to the
   * wrong one two times out of three.
   */
  outcome: Exclude<ProbeOutcome, "healthy">;
  /** The host that was probed, as a customer would reach it. */
  host: string;
  /** What the probe answered. */
  status: number | null;
  /** Its body, or the fetch error. Truncated by the caller. */
  detail: string;
  checkedAt: string;
  /** How often this will arrive again while it stays down. */
  everyMinutes: number;
};

/**
 * The portal is not answering.
 *
 * WHY THIS EMAIL EXISTS
 * ---------------------
 * On 2026-09-03 production ran for about two hours unable to reach its
 * database, and the way it was discovered was the operator trying to sign in
 * and failing. The platform had no way to tell anybody it was broken.
 *
 * WHY IT REPEATS RATHER THAN SENDING ONCE
 * ---------------------------------------
 * Alerting once would need the watcher to remember it had already alerted, and
 * the only durable place to remember anything is the database that is down. A
 * flag that lives in the thing being watched is not a flag.
 *
 * So it repeats on every check, and the email says so, and the operator can
 * infer the duration from the number of these in the thread. Noisy while
 * broken is the right failure direction for an outage nobody noticed for two
 * hours.
 */
export function outageAlert(input: OutageAlertInput): RenderedEmail {
  return compose(
    "ops.outage",
    "operator",
    `${OUTCOME_HEADLINE[input.outcome]} at ${input.host}`,
    {
      preheader: `${OUTCOME_HEADLINE[input.outcome]}. Checked at ${input.checkedAt}.`,
      blocks: [
        { kind: "p", text: OUTCOME_MEANING[input.outcome] },
        {
          kind: "details",
          title: "What the check saw",
          rows: rows([
            ["Host", input.host],
            ["Health check", `${input.host}/api/portal/health`],
            ["What this is", OUTCOME_HEADLINE[input.outcome]],
            ["Answered", input.status === null ? "nothing, the request itself failed" : String(input.status)],
            ["Detail", input.detail],
            ["Checked at", input.checkedAt],
          ]),
        },
        {
          kind: "p",
          text: "The probe itself is deliberately not told what went wrong, so it can say one bit and nothing more. The cause is in the deployment's runtime log rather than in this email.",
        },
        {
          kind: "note",
          text: `This will arrive again every ${input.everyMinutes} minutes until the check passes. There is no reminder to switch off and no state to reset: the watcher keeps nothing, because the only place it could keep anything is the database it is watching.`,
        },
      ],
    },
    // A reply reaches the firm mailbox rather than the send-only notifications
    // address. Replying to a machine alert is unlikely and a dead end is worse.
    { replyTo: business.email },
  );
}


export type ErrorAlertInput = {
  /**
   * Which piece of news this is.
   *
   * "new" and "rate" are genuinely different messages and they get different
   * subjects. A fault appearing for the first time asks "what changed"; a fault
   * suddenly firing eleven times in fifteen minutes asks "what is happening
   * right now". A single generic subject would send the operator to the wrong
   * question half the time, which is the same reasoning the outage alert's four
   * outcomes are built on.
   */
  kind: "new" | "rate";
  /** The readable fingerprint, so it can be searched for on the status page. */
  fingerprint: string;
  /** The message, already scrubbed. */
  title: string;
  /** Total occurrences ever recorded for this fault. */
  occurrences: number;
  /** How many landed inside the rate window. */
  inWindow: number;
  windowMinutes: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** How many other faults were eligible and cut by the per sweep cap. */
  suppressed: number;
  release: string;
  environment: string;
  statusUrl: string;
  cooldownMinutes: number;
};

/**
 * A fault is new, or a fault has become frequent.
 *
 * WHY THE BODY SAYS WHAT WILL HAPPEN NEXT
 * ---------------------------------------
 * The same reason the outage alert says it will arrive every five minutes. An
 * alert that does not tell you its own cadence leaves the reader unable to tell
 * silence from "it is fixed", and this one is quieter than the outage watcher:
 * one email per fault per hour, with a cap of three per sweep. Somebody who does
 * not know about the cap will read three alerts as three faults.
 */
export function errorAlert(input: ErrorAlertInput): RenderedEmail {
  const headline =
    input.kind === "rate"
      ? `A fault is repeating: ${input.inWindow} times in ${input.windowMinutes} minutes`
      : "A fault that has not happened before";

  return compose(
    "ops.error_alert",
    "operator",
    `${headline} on ${input.environment}`,
    {
      preheader: `${input.title.slice(0, 90)} (last seen ${input.lastSeenAt})`,
      blocks: [
        {
          kind: "p",
          text:
            input.kind === "rate"
              ? "This fault has crossed the rate threshold, which means it is happening often enough to be affecting somebody rather than being a one off. The release and route below are where to start."
              : "This is the first time this particular fault has been recorded. It may be harmless and it may be the first symptom of a deploy that went wrong; either way it was not happening before, which is the only thing this email claims.",
        },
        {
          kind: "details",
          title: "The fault",
          rows: rows([
            ["What it says", input.title],
            ["Fingerprint", input.fingerprint],
            ["In the last " + input.windowMinutes + " minutes", String(input.inWindow)],
            ["Recorded in total", String(input.occurrences)],
            ["First seen", input.firstSeenAt],
            ["Last seen", input.lastSeenAt],
            ["Release", input.release],
            ["Environment", input.environment],
          ]),
        },
        {
          kind: "p",
          text: `The status page has the full list, the queue depth and the last run of every scheduled job: ${input.statusUrl}`,
        },
        {
          kind: "note",
          text:
            `One email per fault per ${input.cooldownMinutes} minutes, and at most three faults per sweep` +
            (input.suppressed > 0
              ? `. ${input.suppressed} other fault${input.suppressed === 1 ? " was" : "s were"} eligible and held back by that cap, so this is not the whole picture. The status page is.`
              : ". A fault that keeps firing will send again after the cooldown rather than going quiet."),
        },
      ],
    },
    { replyTo: business.email },
  );
}

export function allTemplatesForAudit(): RenderedEmail[] {

  return [
    outstandingInformation({
      customerName: "Sample Customer",
      customerEmail: "sample@example.com",
      fileNumber: "254-2026-0001",
      propertyAddress: "100 Sample Street, Corpus Christi",
      items: [
        { label: "Who should the document be addressed to", when: "Before it can be sealed" },
        { label: "Gate or lockbox code", when: "Before a technician is sent" },
      ],
      holdingUp: "a technician can be sent",
      supplyUrl: "https://254engineering.com/order/SAMPLE",
    }),
    jobPaymentLink({
      customerName: "Sample Customer",
      customerEmail: "sample@example.com",
      reference: "254-O2026-ABCDEF",
      propertyAddress: "100 Sample Street, Corpus Christi",
      deliverableName: "WPI-8E windstorm evaluation",
      amount: "$925.00",
      payUrl: "https://254engineering.com/pay/sample",
      takenBy: "the firm",
    }),
    errorAlert({
      kind: "rate",
      fingerprint: "/api/order-flow | route | the payment provider refused the session",
      title: "The payment provider refused the session",
      occurrences: 41,
      inWindow: 14,
      windowMinutes: 15,
      firstSeenAt: "4 September 2026 at 09:12 UTC",
      lastSeenAt: "4 September 2026 at 10:31 UTC",
      suppressed: 2,
      release: "1ca47ffb21c0",
      environment: "production",
      statusUrl: "https://254engineering.com/portal/status",
      cooldownMinutes: 60,
    }),
    outageAlert({
      outcome: "unhealthy",
      host: "https://254engineering.com",
      status: 503,
      detail: '{"ok":false}',
      checkedAt: "3 September 2026 at 13:29 UTC",
      everyMinutes: 5,
    }),
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
