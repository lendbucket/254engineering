import { NextResponse } from "next/server";
import { windstormInquirySchema, fieldErrors } from "@/lib/forms";
import { insertWindstormInquiry } from "@/lib/intake";

/**
 * The windstorm brief intake, for an existing building.
 *
 * ITS OWN ROUTE AND ITS OWN TABLE, for the reason the design route gives about
 * itself: a lead is a contact and this is a brief. The design route is not
 * reused either, because the questions are different questions and 0054 holds
 * them in `eng_windstorm_inquiries`.
 *
 * THE HONEYPOT ANSWERS SUCCESS, the same as the other two intake routes and
 * for the same reason: a bot told it failed learns, and one told it succeeded
 * goes away. It is checked before anything is written.
 *
 * NO PRICE IN THE RESPONSE, AND NO CERTIFICATION PROMISED. Whether an existing
 * building can be certified turns on what is covered up, what can be opened to
 * verify it, and whether the openings meet the standard. Nothing a form
 * collects settles any of that, so the response scopes a conversation and never
 * a job.
 *
 * WHAT IT DOES SAY is which side of the statutory line the work falls on,
 * because that much IS knowable from the answers and is worth knowing before
 * anybody picks up a telephone. Tex. Ins. Code 2210.251 turns on the date of
 * the WORK, so a 1975 house with a 2021 reroof is in scope and is told so.
 *
 * AND NO TASK IS RAISED, on the operator's 2026-09-18 ruling: a public route
 * minting a staff task is an unauthenticated request acting as a privileged
 * principal. The row carries `respond_by`; an operator raises the task from it,
 * exactly as the design brief does.
 *
 * ===========================================================================
 * IT USED TO VALIDATE AND REFUSE, AND THE REFUSAL WAS NOT A PLACEHOLDER.
 * ===========================================================================
 *
 * Until 0054 landed this route answered 503 saying nothing had been saved,
 * because the table did not exist and a migration on `main` is never pending.
 * That was deliberate: what it must never do is answer 200 and drop a person's
 * name, telephone number and property address, which is the
 * `customer_link.issued` defect and cost a paying customer a telephone call to
 * find out nothing had been sent. The insert below replaces the refusal; the
 * reasoning is kept because the next person to build a form before its table
 * should reach for the same shape.
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

  const result = await insertWindstormInquiry({
    name: data.name,
    email: data.email,
    phone: data.phone,
    askingAs: data.askingAs,
    propertyAddress: data.propertyAddress,
    county: data.county,
    yearBuilt: data.yearBuilt,
    mostRecentWorkYear: data.workYearUnknown ? undefined : data.mostRecentWorkYear,
    workDone: data.workDone,
    whatIsCovered: data.whatIsCovered,
    openingsRated: data.openingsRated,
    willOpenUp: data.willOpenUp,
    deadline: data.deadline,
    openInsuranceClaim: data.openInsuranceClaim,
    activeLitigation: data.activeLitigation,
    priorAdverseReport: data.priorAdverseReport,
    landingPath: data.landingPath,
    referrer: data.referrer,
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    /*
     * A WRITE THAT FAILED SAYS SO. The alternative is answering 200 on a brief
     * nobody holds, which is the defect this route was built around.
     */
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your brief could not be saved, so nothing has been recorded and nobody has been notified. Please ring or email the firm with these details rather than trying again.",
      },
      { status: 503 },
    );
  }

  /*
   * NO SCOPE VERDICT IN THE RESPONSE, AND THAT IS A DECISION RATHER THAN AN
   * OMISSION. The rule can say whether the work is in scope under 2210.251, and
   * the row carries the year it would decide on, but telling a member of the
   * public that from a form is close to an opinion arriving from the wrong
   * place. The determination is shown to STAFF on /portal/windstorm-inquiries,
   * where somebody can act on it, and it reaches the enquirer in a reply
   * written by a person.
   */
  return NextResponse.json({ ok: true });
}
