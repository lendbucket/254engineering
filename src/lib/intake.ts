import "server-only";
import { SITE_KEY, supabaseAdmin } from "./supabase";

/**
 * Writes to the two intake tables.
 *
 * WHAT A FAILED WRITE MEANS HERE
 * ------------------------------
 * These return a result rather than throwing, and the routes above them turn a
 * failure into a logged warning and a normal success response, not a 500. That
 * is a deliberate trade and worth stating: on a database outage the submission
 * is lost and the person is told it was received.
 *
 * The alternative is worse. A visible error at the moment of submission loses
 * the enquiry too, and it loses the person as well, because almost nobody types
 * a message into a form a second time. The notification email is a second,
 * independent path to the same information, and it is exactly why the two are
 * not chained: an intake that reaches the operator's inbox is not lost even when
 * the row is.
 *
 * BACKLOG carries the item that would close this properly, which is a durable
 * queue rather than two best efforts.
 */

type WriteResult = { ok: boolean; error?: string };

export type LeadRow = {
  form: "contact" | "waitlist";
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  service?: string;
  message?: string;
  landingPath?: string;
  referrer?: string;
  userAgent?: string;
};

export async function insertLead(row: LeadRow): Promise<WriteResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase is not configured" };

  const { error } = await db.from("eng_leads").insert({
    site: SITE_KEY,
    form: row.form,
    name: row.name || null,
    email: row.email || null,
    phone: row.phone || null,
    city: row.city || null,
    service: row.service || null,
    message: row.message || null,
    landing_path: row.landingPath || null,
    referrer: row.referrer || null,
    user_agent: row.userAgent || null,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

export type ApplicationRow = {
  role: "professional_engineer" | "field_technician";
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  message?: string;
  licenseNumber?: string;
  disciplines?: string;
  tdiAppointed?: boolean;
  availability?: string;
  counties?: string;
  experience?: string;
  droneLicense?: boolean;
  reliableVehicle?: boolean;
  landingPath?: string;
  referrer?: string;
  userAgent?: string;
};

/**
 * The multi step application write.
 *
 * WHY THE FLAT COLUMNS ARE STILL POPULATED ALONGSIDE THE PAYLOAD
 * --------------------------------------------------------------
 * `payload` holds every structured answer, which is what makes the flow able to
 * grow a question without a migration. The flat columns are still filled for the
 * fields that are common to every brand writing this table, because those are
 * the ones an operator filters and sorts on, and `where name ilike` beats
 * `where payload->>'fullName' ilike` for anybody looking at the table directly.
 *
 * WHY THE ID COMES FROM THE CLIENT
 * --------------------------------
 * The application id is generated at the start of the flow so that uploads can
 * be keyed to it before the row exists. That is the whole reason documents can
 * be attached during step four rather than held in memory until submit. The id
 * is validated as a UUID at both the upload route and here, and a collision with
 * an existing row fails the insert rather than overwriting it.
 */
export type StructuredApplicationRow = {
  applicationId: string;
  role: "professional_engineer" | "field_technician";
  name: string;
  email: string;
  phone?: string;
  city?: string;
  payload: Record<string, unknown>;
  landingPath?: string;
  referrer?: string;
  userAgent?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

export async function insertStructuredApplication(
  row: StructuredApplicationRow,
): Promise<WriteResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase is not configured" };

  const { error } = await db.from("eng_applications").insert({
    id: row.applicationId,
    site: SITE_KEY,
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone || null,
    city: row.city || null,
    payload: row.payload,
    landing_path: row.landingPath || null,
    referrer: row.referrer || null,
    user_agent: row.userAgent || null,
    utm_source: row.utmSource || null,
    utm_medium: row.utmMedium || null,
    utm_campaign: row.utmCampaign || null,
    utm_content: row.utmContent || null,
    utm_term: row.utmTerm || null,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function insertApplication(row: ApplicationRow): Promise<WriteResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase is not configured" };

  const { error } = await db.from("eng_applications").insert({
    site: SITE_KEY,
    role: row.role,
    name: row.name || null,
    email: row.email || null,
    phone: row.phone || null,
    city: row.city || null,
    message: row.message || null,
    license_number: row.licenseNumber || null,
    disciplines: row.disciplines || null,
    // `?? null` rather than `|| null`: false is a real answer to "are you TDI
    // appointed" and `||` would store it as unanswered.
    tdi_appointed: row.tdiAppointed ?? null,
    availability: row.availability || null,
    counties: row.counties || null,
    experience: row.experience || null,
    drone_license: row.droneLicense ?? null,
    reliable_vehicle: row.reliableVehicle ?? null,
    landing_path: row.landingPath || null,
    referrer: row.referrer || null,
    user_agent: row.userAgent || null,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}
