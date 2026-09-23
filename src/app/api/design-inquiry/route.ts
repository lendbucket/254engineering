import { NextResponse } from "next/server";
import { designInquirySchema, fieldErrors } from "@/lib/forms";
import { insertDesignInquiry } from "@/lib/intake";

/**
 * The design inquiry intake.
 *
 * ITS OWN ROUTE RATHER THAN A BRANCH ON /api/lead, because it writes a
 * different table for the reason 0050 argues: a lead is a contact and this is a
 * brief. Folding it in would mean one handler with two schemas, two tables and
 * two notification shapes, which is how the honeypot ends up guarding one of
 * them.
 *
 * THE HONEYPOT ANSWERS SUCCESS, the same as the lead route and for the same
 * reason: a bot told it failed learns, and one told it succeeded goes away.
 *
 * NO PRICE IN THE RESPONSE, AND THAT IS THE SPECIFICATION. Design is hourly
 * with a fixed fee quoted from the engineer's estimate and a minimum
 * engagement. Nothing a form collects can be turned into a quote, so the
 * response says when somebody will be in touch and never what it will cost.
 *
 * AND NO TASK IS RAISED. Operator ruling 2026-09-18: a public route minting a
 * staff task is an unauthenticated request acting as a privileged principal.
 * The row carries respond_by; an operator raises the task from it.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = designInquirySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const data = parsed.data;
  if (data.company) {
    return NextResponse.json({ ok: true });
  }

  const result = await insertDesignInquiry({
    name: data.name,
    email: data.email,
    phone: data.phone,
    askingAs: data.askingAs,
    workKind: data.workKind,
    deliverable: data.deliverable,
    propertyAddress: data.propertyAddress,
    jurisdiction: data.jurisdiction,
    squareFeet: data.squareFeet,
    storeys: data.storeys,
    drawings: data.drawings,
    soilReport: data.soilReport,
    permitStatus: data.permitStatus,
    deadline: data.deadline,
    openInsuranceClaim: data.openInsuranceClaim,
    activeLitigation: data.activeLitigation,
    priorAdverseReport: data.priorAdverseReport,
    landingPath: data.landingPath,
    referrer: data.referrer,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  /*
   * A FAILED WRITE IS REPORTED AS A FAILURE. forms-audit exists partly because
   * a form that says "thank you" over a row that was never written is the false
   * success this platform refuses: the person believes they have asked and
   * nobody has been told.
   */
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: "That did not save. Call the office and somebody will take it down." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
