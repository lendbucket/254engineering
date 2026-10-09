import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import {
  activateTechnician,
  inviteFromApplication,
  recordCredential,
  setItemDates,
  setOnboardingCoverage,
  setTechCoverage,
} from "@/lib/ops-onboarding";
import { recordTraining } from "@/lib/certification-record";
import { rejectCredential, submitCredential, verifyCredential } from "@/lib/ops-credential-submissions";
import {
  addProtocolQuestion,
  removeProtocolQuestion,
  restoreCertification,
  revokeCertification,
  submitAttempt,
} from "@/lib/ops-field";

/**
 * The applicant to dispatchable path, and the protocol check.
 *
 * Separate from /api/portal/field for one reason worth stating: the actions here
 * create accounts and write credentials that dispatch reads, and the ones there
 * move work around. Keeping them apart means the audit trail reads as two
 * different kinds of act, and a future rate limit or extra guard can be put on
 * account creation without also putting it on a technician taking a photograph.
 *
 * WHAT THIS ENDPOINT NEVER ACCEPTS
 * --------------------------------
 * A social security number, a date of birth, or a bank account number. Not
 * because it filters them, but because there is no branch that stores one. The
 * W-9 and I-9 arrive as uploaded documents into a private bucket and are never
 * read, parsed, extracted, or indexed. forms-audit asserts mechanically that no
 * input on any onboarding surface is named or labelled anything like an SSN.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const context = await requestContext();

  // ---------------------------------------------------------- onboarding

  if (action === "invite_from_application") {
    const role = body?.role === "engineer" ? "engineer" : "field_tech";
    const result = await inviteFromApplication(
      actor,
      String(body?.applicationId ?? ""),
      { role, notes: body?.notes ? String(body.notes) : null },
      context,
    );
    /*
     * The token is returned exactly once, here, and is never stored in
     * plaintext. There is no "resend the same link" anywhere in this system for
     * that reason; a new link is issued instead.
     */
    return result.ok
      ? NextResponse.json({ ok: true, onboardingId: result.onboardingId, token: result.token })
      : bad(result.error);
  }

  if (action === "set_item_dates") {
    const result = await setItemDates(
      actor,
      String(body?.onboardingId ?? ""),
      String(body?.itemKey ?? ""),
      {
        issuedOn: body?.issuedOn ? String(body.issuedOn) : null,
        expiresOn: body?.expiresOn ? String(body.expiresOn) : null,
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "set_coverage") {
    const counties = Array.isArray(body?.counties) ? body.counties.map(String) : [];
    const result = await setOnboardingCoverage(
      actor,
      String(body?.onboardingId ?? ""),
      {
        counties,
        baseCity: body?.baseCity ? String(body.baseCity) : null,
        baseCounty: body?.baseCounty ? String(body.baseCounty) : null,
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, counties: result.counties }) : bad(result.error);
  }

  if (action === "activate") {
    const result = await activateTechnician(actor, String(body?.onboardingId ?? ""), context);
    return result.ok
      ? NextResponse.json({
          ok: true,
          profileId: result.profileId,
          token: result.token,
          linked: result.linked,
          credentials: result.credentials,
        })
      : NextResponse.json(
          { ok: false, error: result.error, blockers: result.blockers ?? [] },
          { status: 400 },
        );
  }

  /*
   * A credential recorded on a technician's page, verified by the administrator
   * recording it. Append only (operator ruling, 2026-10-07): there is no id to
   * pass and no status to choose, so nothing here can rewrite a record.
   */
  if (action === "record_credential") {
    const result = await recordCredential(
      actor,
      String(body?.profileId ?? ""),
      {
        kind: String(body?.kind ?? ""),
        label: body?.label ? String(body.label) : null,
        issuedOn: body?.issuedOn ? String(body.issuedOn) : null,
        expiresOn: body?.expiresOn ? String(body.expiresOn) : null,
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  /*
   * THE TECHNICIAN'S OWN SUBMISSION, AND THE OPERATOR'S DECISION ON IT. Operator
   * ruling of 2026-10-09. The submission carries the type, the issuing state and
   * the expiry only, and is always the signed in technician's own: there is no
   * profile id to pass. Verify and reject take only the submission's id; every
   * rule lives in ops-credential-submissions.ts.
   */
  if (action === "submit_credential") {
    const result = await submitCredential(
      actor,
      {
        kind: String(body?.kind ?? ""),
        issuingState: body?.issuingState ? String(body.issuingState) : null,
        expiresOn: body?.expiresOn ? String(body.expiresOn) : null,
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }
  if (action === "verify_credential") {
    const result = await verifyCredential(actor, String(body?.credentialId ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }
  if (action === "reject_credential") {
    const result = await rejectCredential(actor, String(body?.credentialId ?? ""), String(body?.reason ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  /*
   * Supervised training recorded by an administrator, operator ruling of
   * 2026-10-07. It counts for nothing until the engineer of record approves it.
   */
  if (action === "record_training") {
    const result = await recordTraining(
      actor,
      String(body?.profileId ?? ""),
      {
        serviceSlug: String(body?.serviceSlug ?? ""),
        trainedOn: String(body?.trainedOn ?? ""),
        supervisedBy: String(body?.supervisedBy ?? ""),
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true, id: result.id }) : bad(result.error);
  }

  /* A working technician's coverage counties, from the same page. setTechCoverage refuses unknown names. */
  if (action === "set_coverage") {
    const counties = Array.isArray(body?.counties) ? body.counties.map(String) : [];
    const result = await setTechCoverage(actor, String(body?.profileId ?? ""), counties, context);
    return result.ok ? NextResponse.json({ ok: true, counties: result.counties }) : bad(result.error);
  }

  // -------------------------------------------------------- certification

  if (action === "add_question") {
    const options = Array.isArray(body?.options) ? body.options.map(String) : [];
    const result = await addProtocolQuestion(
      actor,
      String(body?.templateId ?? ""),
      {
        prompt: String(body?.prompt ?? ""),
        options,
        correctIndex: Number(body?.correctIndex ?? -1),
        rationale: String(body?.rationale ?? ""),
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "remove_question") {
    const result = await removeProtocolQuestion(
      actor,
      String(body?.templateId ?? ""),
      String(body?.questionId ?? ""),
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "submit_attempt") {
    const answers = Array.isArray(body?.answers)
      ? body.answers
          .map((a) => a as { questionId?: unknown; optionIndex?: unknown })
          .filter((a) => a && typeof a.questionId === "string" && Number.isInteger(Number(a.optionIndex)))
          .map((a) => ({ questionId: String(a.questionId), optionIndex: Number(a.optionIndex) }))
      : [];
    const result = await submitAttempt(actor, String(body?.serviceSlug ?? ""), answers, context);
    /*
     * The verdict comes back with the reasoning for every wrong answer, which
     * is the only thing the technician receives and the whole point of the
     * check. It never carries the correct option index: knowing WHY is what
     * makes the retake worth taking, and knowing WHICH would make it a memory
     * test of a list they just saw.
     */
    return result.ok ? NextResponse.json({ ok: true, result: result.result }) : bad(result.error);
  }

  if (action === "revoke_certification") {
    const result = await revokeCertification(
      actor,
      String(body?.profileId ?? ""),
      String(body?.serviceSlug ?? ""),
      String(body?.reason ?? ""),
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  if (action === "restore_certification") {
    const result = await restoreCertification(
      actor,
      String(body?.profileId ?? ""),
      String(body?.serviceSlug ?? ""),
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  return bad("Unknown action.");
}
