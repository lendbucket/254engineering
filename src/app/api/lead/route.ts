import { NextResponse } from "next/server";
import { contactSchema, fieldErrors, waitlistSchema } from "@/lib/forms";
import { insertLead, intakeAnswer } from "@/lib/intake";
import { queueEmail } from "@/lib/ops-jobs";
import { notify } from "@/lib/notify";
import { business } from "@/config/business";
import { leadNotification } from "@/lib/email-templates";
import { cookies } from "next/headers";
import { partnerForVisitor, VISITOR_COOKIE } from "@/lib/ops-partners";

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

  /*
   * Read before the row is written, because the answer lives in a cookie that
   * only exists for the length of this request. A lead the firm cannot trace
   * back to the partner who sent it is a partner who will eventually ask why
   * their traffic never shows up.
   */
  const partner = await partnerForVisitor((await cookies()).get(VISITOR_COOKIE)?.value);

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
    partnerId: partner?.partnerId ?? null,
    partnerCode: partner?.code ?? null,
  });

  /*
   * The email leaves on the queue. The row above is the record and it is
   * already written; a person filling in a form must not wait on Resend, and a
   * Resend outage must not decide whether their enquiry was captured.
   */
  const mail = await queueEmail(
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

  if (!write.ok) console.error(`[lead] write failed (${form}): ${write.error}`);
  if (!mail.ok) console.error(`[lead] notification not queued (${form}): ${mail.error}`);

  /*
   * A SUBMISSION THAT REACHED NOTHING IS NOT ANSWERED WITH SUCCESS.
   *
   * Operator ruling, 2026-09-06. This route used to return 200 whatever
   * happened, on the reasoning that losing the enquiry AND the person is worse
   * than losing the enquiry, because almost nobody types a message into a form
   * twice. That reasoning is right about the person and wrong about the answer.
   *
   * WHAT THE QUEUE CAN AND CANNOT DO HERE, WHICH IS THE PART WORTH READING.
   *
   * The ruling was to move intake onto the durable queue. The notification
   * already goes there. Moving the ROW there fixes nothing, because the queue
   * is a table in the same Postgres: when the database is unreachable, the
   * write fails and the enqueue fails for the same reason, and a queue that
   * cannot be written to is not a durable store.
   *
   * So the second path is a DIRECT send, deliberately bypassing the queue,
   * attempted only when the write failed. It is the one route to a human that
   * does not pass through the database at all. If it lands, the enquiry exists:
   * somebody will read it, and 200 is true.
   *
   * If both fail, the submission exists nowhere, and the person is told that
   * and given the address to write to instead. That is worse for the firm than
   * a silent 200 and better for the person, which is the correct direction: the
   * firm can survive knowing it lost an enquiry, and cannot survive a customer
   * who believes they made contact and did not.
   */
  if (write.ok) return NextResponse.json({ ok: true });

  /*
   * Only reached when the row did not land. The answer itself is decided by
   * intakeAnswer, which is pure and exercised by forms-audit across all three
   * cases, because a branch this important should not be provable only by
   * taking the database away.
   */

  const direct = await notify(
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

  /*
   * `sent`, not `outcome === "ok"`. notify returns skipped when Resend is not
   * configured, which is a send that did not happen, and treating it as success
   * here would put the silent 200 straight back with an extra step.
   */
  const answer = intakeAnswer({ written: false, sent: direct.sent }, business.email);

  console.error(
    direct.sent
      ? `[lead] write failed and the direct send carried it (${form})`
      : `[lead] LOST: neither the write nor the direct send landed (${form})`,
  );

  return NextResponse.json(
    answer.message ? { ok: answer.ok, message: answer.message } : { ok: answer.ok },
    { status: answer.status },
  );
}
