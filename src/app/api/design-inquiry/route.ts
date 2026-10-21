import { NextResponse } from "next/server";
import { designInquirySchema, fieldErrors } from "@/lib/forms";
import { insertDesignInquiry } from "@/lib/intake";
import { withSaveOutcome } from "@/lib/save-outcome";
import { queueEmail } from "@/lib/ops-jobs";
import { inquiryAcknowledged, inquiryNotification } from "@/lib/email-templates";
import { business } from "@/config/business";

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
async function handlePOST(request: Request) {
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

  /*
   * THE FIRM IS EMAILED AND THE PERSON IS ACKNOWLEDGED (ruling Q6 of
   * 2026-10-19, addition d of 2026-10-20). Both leave on the queue after the
   * row is written, and neither failure changes the answer: the brief is held
   * and /portal/inquiries shows it either way. The firm's copy is an operator
   * email, not a task, so the 2026-09-18 ruling above still holds.
   */
  const show = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
  const firm = await queueEmail(
    inquiryNotification({
      kind: "design",
      name: data.name,
      email: data.email,
      rows: [
        ["Phone", show(data.phone)],
        ["Asking as", show(data.askingAs)],
        ["Kind of work", show(data.workKind)],
        ["Deliverable", show(data.deliverable)],
        ["Property address", show(data.propertyAddress)],
        ["Jurisdiction", show(data.jurisdiction)],
        ["Square feet", show(data.squareFeet)],
        ["Storeys", show(data.storeys)],
        ["Drawings", show(data.drawings)],
        ["Soil report", show(data.soilReport)],
        ["Permit status", show(data.permitStatus)],
        ["Deadline", show(data.deadline)],
        ["Open insurance claim", show(data.openInsuranceClaim)],
        ["Active litigation", show(data.activeLitigation)],
        ["Earlier adverse report", show(data.priorAdverseReport)],
      ],
      portalUrl: `${business.url}/portal/inquiries`,
    }),
  );
  if (!firm.ok) console.error(`[design-inquiry] firm notification not queued: ${firm.error}`);
  const ack = await queueEmail(inquiryAcknowledged({ kind: "design", email: data.email }));
  if (!ack.ok) console.error(`[design-inquiry] acknowledgement not queued: ${ack.error}`);

  return NextResponse.json({ ok: true });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
