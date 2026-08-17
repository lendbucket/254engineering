import { NextResponse } from "next/server";
import { engineerApplicationSchema, fieldErrors, technicianApplicationSchema } from "@/lib/forms";
import { insertApplication } from "@/lib/intake";
import { notify } from "@/lib/notify";

/**
 * Careers intake for both tracks.
 *
 * The `role` field on the payload selects the schema, so a technician
 * application is never validated against the engineer's licence requirements and
 * vice versa. An unrecognized role is a 400 rather than a guess: silently
 * defaulting to one track would file half the applications under the wrong one,
 * and nobody would notice until hiring.
 *
 * Same posture as the lead route on failure. A write that does not land is
 * logged and the applicant still gets a success state, because the notification
 * email is the second independent path to the same information and losing the
 * applicant is worse than losing the row.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const role = (payload as { role?: string })?.role;
  if (role !== "professional_engineer" && role !== "field_technician") {
    return NextResponse.json({ ok: false, message: "Unknown application type." }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;

  if (role === "professional_engineer") {
    const parsed = engineerApplicationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 422 });
    }
    const data = parsed.data;
    if (data.company) return NextResponse.json({ ok: true });

    const write = await insertApplication({
      role,
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      licenseNumber: data.licenseNumber,
      disciplines: data.disciplines,
      tdiAppointed: data.tdiAppointed === "yes",
      availability: data.availability,
      message: data.message,
      landingPath: data.landingPath,
      referrer: data.referrer,
      userAgent,
    });

    const mail = await notify({
      subject: `PE application: ${data.name} (${data.city})`,
      replyTo: data.email,
      lines: [
        ["Track", "Professional Engineer"],
        ["Name", data.name],
        ["Email", data.email],
        ["Phone", data.phone],
        ["City", data.city],
        ["Texas PE license", data.licenseNumber],
        ["Disciplines", data.disciplines],
        ["TDI windstorm appointment", data.tdiAppointed === "yes" ? "Yes" : "No"],
        ["Availability", data.availability],
        ["Message", data.message],
        ["Page", data.landingPath],
        ["Referrer", data.referrer],
      ],
    });

    if (!write.ok) console.error(`[apply] write failed (engineer): ${write.error}`);
    if (!mail.sent) console.error(`[apply] notification not sent (engineer): ${mail.reason}`);
    return NextResponse.json({ ok: true });
  }

  const parsed = technicianApplicationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 422 });
  }
  const data = parsed.data;
  if (data.company) return NextResponse.json({ ok: true });

  const write = await insertApplication({
    role,
    name: data.name,
    email: data.email,
    phone: data.phone,
    city: data.city,
    counties: data.counties,
    experience: data.experience,
    droneLicense: data.droneLicense === "yes",
    reliableVehicle: data.reliableVehicle === "yes",
    message: data.message,
    landingPath: data.landingPath,
    referrer: data.referrer,
    userAgent,
  });

  const mail = await notify({
    subject: `Technician application: ${data.name} (${data.city})`,
    replyTo: data.email,
    lines: [
      ["Track", "Field Inspection Technician"],
      ["Name", data.name],
      ["Email", data.email],
      ["Phone", data.phone],
      ["City", data.city],
      ["Counties willing to serve", data.counties],
      ["Background", data.experience],
      ["Part 107 drone license", data.droneLicense === "yes" ? "Yes" : "No"],
      ["Reliable vehicle", data.reliableVehicle === "yes" ? "Yes" : "No"],
      ["Message", data.message],
      ["Page", data.landingPath],
      ["Referrer", data.referrer],
    ],
  });

  if (!write.ok) console.error(`[apply] write failed (technician): ${write.error}`);
  if (!mail.sent) console.error(`[apply] notification not sent (technician): ${mail.reason}`);
  return NextResponse.json({ ok: true });
}
