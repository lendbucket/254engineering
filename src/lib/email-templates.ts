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

export type EngineerEmailInput = {
  name: string;
  email: string;
  phone?: string;
  city: string;
  licenseNumber: string;
  disciplines: string;
  tdiAppointed: boolean;
  availability: string;
  message?: string;
  landingPath?: string;
  referrer?: string;
};

export function engineerApplicationNotification(input: EngineerEmailInput): RenderedEmail {
  return {
    id: "apply.engineer",
    subject: `PE application: ${input.name} (${input.city})`,
    replyTo: input.email,
    text: body([
      ["Track", "Professional Engineer"],
      ["Name", input.name],
      ["Email", input.email],
      ["Phone", input.phone],
      ["City", input.city],
      ["Texas PE license", input.licenseNumber],
      ["Disciplines", input.disciplines],
      ["TDI windstorm appointment", input.tdiAppointed ? "Yes" : "No"],
      ["Availability", input.availability],
      ["Message", input.message],
      ["Page", input.landingPath],
      ["Referrer", input.referrer],
    ]),
  };
}

export type TechnicianEmailInput = {
  name: string;
  email: string;
  phone?: string;
  city: string;
  counties: string;
  experience: string;
  droneLicense: boolean;
  reliableVehicle: boolean;
  message?: string;
  landingPath?: string;
  referrer?: string;
};

export function technicianApplicationNotification(input: TechnicianEmailInput): RenderedEmail {
  return {
    id: "apply.technician",
    subject: `Technician application: ${input.name} (${input.city})`,
    replyTo: input.email,
    text: body([
      ["Track", "Field Inspection Technician"],
      ["Name", input.name],
      ["Email", input.email],
      ["Phone", input.phone],
      ["City", input.city],
      ["Counties willing to serve", input.counties],
      ["Background", input.experience],
      ["Part 107 drone license", input.droneLicense ? "Yes" : "No"],
      ["Reliable vehicle", input.reliableVehicle ? "Yes" : "No"],
      ["Message", input.message],
      ["Page", input.landingPath],
      ["Referrer", input.referrer],
    ]),
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
  const common = {
    name: "Sample Applicant",
    email: "sample.applicant@254engineering.com",
    phone: "Not given",
    city: "Corpus Christi",
    landingPath: "/careers",
    referrer: "https://www.google.com/",
  };

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
    engineerApplicationNotification({
      ...common,
      licenseNumber: "Provided by the applicant",
      disciplines: "Structural, civil",
      tdiAppointed: true,
      availability: "Twenty hours a week",
      message: "Anything else the applicant added.",
    }),
    technicianApplicationNotification({
      ...common,
      counties: "Nueces, San Patricio, Aransas, Refugio",
      experience: "Nine years roofing, four years in insurance inspection.",
      droneLicense: true,
      reliableVehicle: true,
    }),
  ];
}
