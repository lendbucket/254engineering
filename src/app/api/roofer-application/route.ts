import { NextResponse, after } from "next/server";
import { business } from "@/config/business";
import { rooferApplicationNotice, rooferApplicationReceived } from "@/lib/email-templates";
import { queueEmail } from "@/lib/ops-jobs";
import { takeRooferApplication } from "@/lib/ops-roofer-applications";
import { PUBLIC_FORM_REFUSAL, takeAcknowledgement, takePublicFormAttempt } from "@/lib/public-form-limits";
import {
  ROOFER_MONTHLY_VOLUME_LABEL,
  ROOFER_SERVICE_LABEL,
  ROOFER_WORK_MIX_LABEL,
  rooferApplicationSchema,
  rooferFieldErrors,
  unknownCounties,
} from "@/lib/roofer-application";
import { allCounties } from "@/content/regions";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * THE ROOFER PARTNER APPLICATION. Robert's request and rulings of 2026-11-05.
 *
 * The windstorm brief's shape, which this platform already proves: parse with
 * the schema the form validates with, answer a bot success at the honeypot,
 * count the post on Q11's limiter before anything is written, and write in one
 * transaction (eng_take_roofer_application) or say plainly that nothing was
 * saved. The emails go after the answer, through after(), and neither can
 * change it.
 *
 * NOTHING HERE DECIDES ANYTHING. The application lands as received, on the
 * review screen and as a due now review on a roofer prospect. A person reads
 * it and approves or declines it on /portal/roofer-applications.
 */
async function handlePOST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = rooferApplicationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: rooferFieldErrors(parsed.error) }, { status: 422 });
  }
  const data = parsed.data;
  if (data.website) return NextResponse.json({ ok: true });
  if (unknownCounties(data.counties, allCounties).length > 0) {
    return NextResponse.json({ ok: false, errors: { counties: "Choose counties from the list." } }, { status: 422 });
  }

  if (!(await takePublicFormAttempt("roofer", request.headers, data.email)).allowed) {
    return NextResponse.json({ ok: false, message: PUBLIC_FORM_REFUSAL }, { status: 429 });
  }

  const saved = await takeRooferApplication(data, { userAgent: request.headers.get("user-agent") });
  if (!saved.ok) {
    if (saved.status === 409) return NextResponse.json({ ok: true, already: true });
    if (saved.status === 422) {
      return NextResponse.json({ ok: false, errors: { certificatePath: saved.error } }, { status: 422 });
    }
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your application could not be saved, so nothing has been recorded and nobody has been notified. Your answers are still on this page. Please try again in a few minutes, or email the firm.",
      },
      { status: 503 },
    );
  }

  const headers = request.headers;
  after(async () => {
    const notice = await queueEmail(
      rooferApplicationNotice({
        legalName: data.legalName,
        ownerName: data.ownerName,
        rows: [
          ["DBA", data.dba || undefined],
          ["Owner", `${data.ownerName}, ${data.ownerTitle}`],
          ["Email", data.email],
          ["Phone", data.phone],
          ["Office", data.officeCity],
          ["Counties", data.counties.join(", ")],
          ["Years in business", String(data.yearsInBusiness)],
          ["Crews", String(data.crewCount)],
          ["Work", ROOFER_WORK_MIX_LABEL[data.workMix]],
          ["Roofs a year", String(data.roofsPerYear)],
          ["Expects to order", data.services.map((s) => ROOFER_SERVICE_LABEL[s]).join(", ")],
          ["Roughly", ROOFER_MONTHLY_VOLUME_LABEL[data.monthlyVolume]],
          ["Carrier", data.insuranceCarrier],
          ["General liability", `${data.glPerOccurrence} per occurrence, ${data.glAggregate} aggregate`],
          ["Certificate", data.certificatePath ? "Attached" : "Not attached"],
        ],
        reviewUrl: `${business.url}/portal/roofer-applications?id=${saved.applicationId}`,
      }),
    );
    if (!notice.ok) console.error(`[roofer-application] firm notice not queued: ${notice.error}`);
    if (!(await takeAcknowledgement("roofer", headers, data.email))) return;
    const ack = await queueEmail(rooferApplicationReceived({ email: data.email }));
    if (!ack.ok) console.error(`[roofer-application] acknowledgement not queued: ${ack.error}`);
  });

  return NextResponse.json({ ok: true, applicationId: saved.applicationId });
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
