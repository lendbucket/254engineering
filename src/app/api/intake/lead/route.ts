import { NextResponse, type NextRequest } from "next/server";
import { notify } from "@/lib/notify";
import { leadNotification } from "@/lib/email-templates";
import { business } from "@/config/business";
import {
  SISTER_KEY_HEADER,
  acceptSisterLead,
  intakeConfigured,
  siteForKey,
  type SisterLead,
} from "@/lib/sister-intake";

export const dynamic = "force-dynamic";

/**
 * Where a sister brand posts a lead.
 *
 * The reasoning for the endpoint's existence, its key model and its refusals is
 * at the top of src/lib/sister-intake.ts. This file is the door: it reads the
 * key, refuses what it must, and answers honestly about what actually happened
 * to the submission.
 *
 * WHY IT IS NOT UNDER /api/account OR /api/portal
 * -----------------------------------------------
 * Both prefixes are gated by a session cookie in src/proxy.ts. A sister has a
 * key and no cookie, so a route under either would be refused by the proxy
 * before it saw the key. Same reasoning as /api/v1/orders, which is the other
 * route on this platform that authenticates itself.
 *
 * WHAT IT ANSWERS WHEN THE DATABASE IS DOWN, AND WHY IT IS NOT A LIE
 * ------------------------------------------------------------------
 * The same three cases /api/lead answers for this site's own forms, for the
 * same reason and with one difference that matters.
 *
 * The caller here is a server, not a person. A person told "we have it" when
 * nothing was saved is being reassured; a SERVER told that will stop retrying
 * and drop the enquiry it is holding. So a failed write is answered with a
 * failure the sister can act on, AND the mail is sent directly anyway, because
 * the operator reading the enquiry in their inbox is what the person on the
 * other end actually needed. The response says which of the two happened.
 *
 * The direct send is deliberate and is the third exception to "all mail goes
 * through the queue", after the outage alert and the queue alert. The queue is
 * a table in the same Postgres: when the write fails, the enqueue fails for the
 * same reason, so it cannot be the second path for this.
 */

function readLead(body: Record<string, unknown> | null): SisterLead {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  return {
    form: str(body?.form) === "waitlist" ? "waitlist" : "contact",
    name: str(body?.name),
    email: str(body?.email),
    phone: str(body?.phone),
    company: str(body?.company),
    city: str(body?.city),
    service: str(body?.service),
    message: str(body?.message),
    landingPath: str(body?.landingPath),
    referrer: str(body?.referrer),
    userAgent: str(body?.userAgent),
    utmSource: str(body?.utmSource),
    utmMedium: str(body?.utmMedium),
    utmCampaign: str(body?.utmCampaign),
  };
}

export async function POST(request: NextRequest) {
  /*
   * Nothing configured is a 404, not a 401. An unconfigured endpoint and a
   * missing one should look identical to whoever is probing, which is the same
   * shape /api/cron/health-watch and /api/portal/unlock already use.
   */
  if (!intakeConfigured()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const site = siteForKey(request.headers.get(SISTER_KEY_HEADER) ?? "");
  if (!site) {
    return NextResponse.json(
      { ok: false, error: "That key is not one." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const lead = readLead(body);

  const outcome = await acceptSisterLead(site, lead);

  if (outcome.ok) {
    /*
     * The notification is sent for a saved lead as well, because the operator
     * works from their inbox and the portal's list is the record rather than
     * the alert. A duplicate does not send a second one: the point of the
     * dedupe window is that the operator hears about the enquiry once.
     */
    if (!outcome.duplicate) {
      await notify(
        leadNotification({
          form: lead.form,
          brand: site,
          name: lead.name ?? "",
          email: lead.email ?? "",
          phone: lead.phone ?? "",
          city: lead.city ?? "",
          service: lead.service ?? "",
          message: lead.message ?? "",
        }),
      ).catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      id: outcome.id,
      duplicate: outcome.duplicate,
      site,
    });
  }

  /*
   * A refused write still tries the mail, and the answer says whether it left.
   * A sister holding an enquiry needs to know whether to retry it or whether a
   * person already has it.
   */
  if (outcome.status === 503) {
    const sent = await notify(
      leadNotification({
        form: lead.form,
        brand: site,
        name: lead.name ?? "",
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        city: lead.city ?? "",
        service: lead.service ?? "",
        message: lead.message ?? "",
      }),
    ).catch(() => ({ sent: false }) as { sent: boolean });

    return NextResponse.json(
      {
        ok: false,
        error: outcome.error,
        emailed: Boolean(sent?.sent),
        retry: !sent?.sent,
        contact: business.email,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status });
}

/**
 * Everything else is refused, and says so.
 *
 * A GET that returned anything would make the endpoint discoverable by anybody
 * who found the path in a sister's source, and this is a write endpoint with no
 * read half at all.
 */
export async function GET() {
  return NextResponse.json({ ok: false, error: "POST a lead with a key." }, { status: 405 });
}
