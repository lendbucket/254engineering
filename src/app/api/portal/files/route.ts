import { takeJob, searchClients, type TakeJobInput } from "@/lib/ops-job-intake";
import { sendPaymentLink, invoiceAccount } from "@/lib/ops-job-billing";
import { dispatchContext } from "@/lib/ops-field";
import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { createFile, transitionFile, convertLead, createClient, getFile } from "@/lib/ops-crm";
import type { FileStatus } from "@/lib/ops-files";

/**
 * Everything that changes a client or a file.
 *
 * One endpoint with an action, rather than five routes, because every branch
 * needs the same three things first: the actor from the database, the
 * authorization check, and the request context for the audit trail. Splitting
 * them would mean four more places to forget one of the three.
 *
 * NO BRANCH TRUSTS THE CLIENT ABOUT WHO IS ASKING
 * -----------------------------------------------
 * currentActor reads the profile, never the cookie's role claim, so a suspension
 * or a role change is in force on this request rather than when a twelve hour
 * session expires.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const context = await requestContext();

  if (action === "create_client") {
    if (!can(actor, "clients.create")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }
    const result = await createClient(
      actor,
      {
        kind: body?.kind === "individual" ? "individual" : "organization",
        name: String(body?.name ?? ""),
        clientType: body?.clientType ? String(body.clientType) : null,
        email: body?.email ? String(body.email) : null,
        phone: body?.phone ? String(body.phone) : null,
        city: body?.city ? String(body.city) : null,
        county: body?.county ? String(body.county) : null,
        notes: body?.notes ? String(body.notes) : null,
      },
      context,
    );
    return result.ok
      ? NextResponse.json({ ok: true, id: result.id })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  /*
   * THE TELEPHONE CALL PATH.
   *
   * Phase 10 Section 1. Everything the operator enters in one action, because
   * the alternative is what the gate 0 walk found: a client screen and a file
   * screen and no price on either, with the person on the telephone in between.
   *
   * The permission is files.create, the same one create_file uses. Taking a job
   * IS opening a file; the difference is how much is known at the time, not who
   * is allowed to do it.
   */
  if (action === "take_job") {
    if (!can(actor, "files.create")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }

    const result = await takeJob(actor, (body ?? {}) as TakeJobInput, context);
    return result.ok
      ? NextResponse.json(result)
      : NextResponse.json(
          { ok: false, error: result.error, field: result.field },
          { status: 400 },
        );
  }

  /*
   * Client search, for the dedupe step inside the intake.
   *
   * Behind the same session as everything else here, and it returns only what
   * the intake needs to tell two clients apart. It is a POST rather than a GET
   * because this route is a POST route; making it a GET would mean a second
   * matcher entry and a second place to check the session.
   */
  if (action === "search_clients") {
    if (!can(actor, "clients.list")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }
    const matches = await searchClients(String(body?.query ?? ""));
    return NextResponse.json({ ok: true, matches });
  }

  /*
   * GETTING PAID FOR A TELEPHONED JOB.
   *
   * Both refuse under the compliance gate and both say why, so this is
   * unexercised code until LAUNCH_MODE flips. That is recorded in the launch
   * sequence rather than left to be discovered on a customer.
   *
   * billing.charge rather than files.create: raising money against a job is a
   * different act from writing the job down, and a coordinator who may do the
   * second should not automatically be able to do the first.
   */
  if (action === "send_payment_link" || action === "invoice_account") {
    if (!can(actor, "payments.charge")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }
    const fileId = String(body?.fileId ?? "");
    const result =
      action === "send_payment_link"
        ? await sendPaymentLink(actor, fileId)
        : await invoiceAccount(actor, fileId);

    return result.ok
      ? NextResponse.json(result)
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  /*
   * The dispatch plan for a file, so the intake can offer the job without
   * sending the operator to another screen first. The same dispatchContext the
   * files screen renders from, so the two cannot disagree about who is
   * eligible.
   */
  if (action === "dispatch_context") {
    if (!can(actor, "offers.dispatch")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }
    const file = await getFile(actor, String(body?.fileId ?? ""));
    if (!file) return NextResponse.json({ ok: false, error: "No such file." }, { status: 404 });

    const context = await dispatchContext(actor, file);
    return NextResponse.json({ ok: true, dispatch: context });
  }

  if (action === "create_file") {
    if (!can(actor, "files.create")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }
    const result = await createFile(
      actor,
      {
        clientId: String(body?.clientId ?? ""),
        serviceSlug: String(body?.serviceSlug ?? ""),
        propertyAddress: String(body?.propertyAddress ?? ""),
        city: body?.city ? String(body.city) : null,
        county: body?.county ? String(body.county) : null,
        postalCode: body?.postalCode ? String(body.postalCode) : null,
        urgency: (body?.urgency as "standard" | "expedited" | "emergency") ?? "standard",
        dueAt: body?.dueAt ? String(body.dueAt) : null,
        notes: body?.notes ? String(body.notes) : null,
        twiaOverride: Boolean(body?.twiaOverride),
        clientPriceCents: body?.clientPriceCents ? Number(body.clientPriceCents) : null,
      },
      context,
    );
    return result.ok
      ? NextResponse.json({ ok: true, id: result.id, fileNumber: result.fileNumber })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (action === "transition") {
    /*
     * No permission check here beyond being signed in, deliberately.
     *
     * transitionFile calls canTransition, which checks the grammar, the
     * compliance gate, AND the role, all in the one place the test suite
     * exercises. A second check here would be a second rule that could disagree
     * with the first, and the refusal it produced would be less informative.
     */
    const result = await transitionFile(
      actor,
      String(body?.fileId ?? ""),
      String(body?.to ?? "") as FileStatus,
      body?.note ? String(body.note) : null,
      context,
    );
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (action === "convert_lead") {
    if (!can(actor, "clients.create") || !can(actor, "files.create")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }
    const result = await convertLead(
      actor,
      String(body?.leadId ?? ""),
      {
        serviceSlug: body?.serviceSlug ? String(body.serviceSlug) : undefined,
        propertyAddress: body?.propertyAddress ? String(body.propertyAddress) : undefined,
        county: body?.county ? String(body.county) : undefined,
      },
      context,
    );
    return result.ok
      ? NextResponse.json({ ok: true, clientId: result.clientId, fileId: result.fileId, fileNumber: result.fileNumber })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
