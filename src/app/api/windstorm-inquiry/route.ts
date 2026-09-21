import { NextResponse } from "next/server";
import { windstormInquirySchema, fieldErrors } from "@/lib/forms";
import { windstormAgeVerdict, windstormBriefReply } from "@/lib/windstorm-inquiry";

/**
 * The windstorm brief intake, for an existing building.
 *
 * ITS OWN ROUTE AND ITS OWN TABLE, for the reason the design route gives about
 * itself: a lead is a contact and this is a brief. The design route is not
 * reused either, because the questions are different questions and the table
 * that holds them is `eng_windstorm_inquiries` rather than the design one.
 *
 * ===========================================================================
 * IT VALIDATES COMPLETELY AND THEN REFUSES TO ACCEPT. THAT IS DELIBERATE.
 * ===========================================================================
 *
 * `eng_windstorm_inquiries` does not exist yet. A migration on `main` is never
 * pending, so the table waits for a sitting with the operator at a keyboard,
 * and the split was ruled on purpose: the questions are settled and the
 * persistence is not.
 *
 * **WHAT IT MUST NOT DO IS ANSWER 200 AND DROP THE BRIEF.** A form that takes
 * somebody's name, telephone number and property address and silently discards
 * them is the `customer_link.issued` defect: a path that looks like contact and
 * is a write that never happened. That one cost a paying customer a telephone
 * call to find out nothing had been sent.
 *
 * So it answers 503 with a sentence naming what to do instead. The person is
 * told, in the same breath, what their answers already establish about the
 * building's age, because that much IS knowable and is worth knowing before
 * anybody picks up a telephone.
 *
 * THE HONEYPOT STILL ANSWERS SUCCESS, the same as the other two routes and for
 * the same reason: a bot told it failed learns, and one told it succeeded goes
 * away. It is checked BEFORE the refusal so a bot is not handed the sentence
 * explaining that the table is missing.
 *
 * NO PRICE IN THE RESPONSE, AND NO CERTIFICATION PROMISED. Only buildings after
 * 1988 can be certified, the work is covered so it must be opened to verify,
 * and the openings may need replacing first. Nothing a form collects settles
 * any of that, so the response scopes a conversation and never a job.
 *
 * AND NO TASK IS RAISED, on the operator's 2026-09-18 ruling: a public route
 * minting a staff task is an unauthenticated request acting as a privileged
 * principal. The row will carry `respond_by`; an operator raises the task from
 * it, exactly as the design brief does.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = windstormInquirySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const data = parsed.data;
  if (data.company) {
    return NextResponse.json({ ok: true });
  }

  const verdict = windstormAgeVerdict({
    yearBuilt: data.yearBuilt,
    yearBuiltUnknown: data.yearBuiltUnknown,
  });

  return NextResponse.json(
    {
      ok: false,
      accepted: false,
      message:
        "This form is not able to record your brief yet, so nothing has been saved and nobody has been notified. Please ring or email the firm with these details and they will be picked up straight away. " +
        windstormBriefReply(verdict),
      ageVerdict: verdict.state,
    },
    { status: 503 },
  );
}
