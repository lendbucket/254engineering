import { NextResponse } from "next/server";
import { contactSchema, fieldErrors, waitlistSchema } from "@/lib/forms";
import { insertLead } from "@/lib/intake";
import { notify } from "@/lib/notify";
import { leadNotification } from "@/lib/email-templates";

/**
 * Contact and waitlist intake.
 *
 * One route for both because they are the same record with a different reason
 * for existing, and the `form` column is what tells them apart in the table. The
 * schemas differ only in whether the message is required.
 *
 * THE HONEYPOT RESPONDS WITH SUCCESS
 * ----------------------------------
 * A submission carrying a value in `company` is dropped and answered 200. A bot
 * that is told it failed learns; one that is told it succeeded goes away. The
 * cost of being wrong is one lost submission from someone who somehow filled in
 * an off-screen field, which has not been observed and would be visible in the
 * logs if it were.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const isWaitlist = (payload as { form?: string })?.form === "waitlist";
  const schema = isWaitlist ? waitlistSchema : contactSchema;
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const data = parsed.data;
  if (data.company) {
    return NextResponse.json({ ok: true });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const form = isWaitlist ? "waitlist" : "contact";

  const write = await insertLead({
    form,
    name: data.name,
    email: data.email,
    phone: data.phone,
    city: data.city,
    service: data.service,
    message: data.message,
    landingPath: data.landingPath,
    referrer: data.referrer,
    userAgent,
  });

  const mail = await notify(
    leadNotification({
      form,
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      service: data.service,
      message: data.message,
      landingPath: data.landingPath,
      referrer: data.referrer,
    }),
  );

  // Logged, never surfaced. See the note in src/lib/intake.ts for why a failed
  // write still answers 200.
  if (!write.ok) console.error(`[lead] write failed (${form}): ${write.error}`);
  if (!mail.sent) console.error(`[lead] notification not sent (${form}): ${mail.reason}`);

  return NextResponse.json({ ok: true });
}
