import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-data";
import { setVerification } from "@/lib/admin-onboarding";
import {
  createOnboarding,
  regenerateInvite,
  setItemDecision,
  setStatus,
} from "@/lib/onboarding";
import { inviteUrl } from "@/lib/onboarding-tokens";
import { onboardingInvite } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { business } from "@/config/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every admin mutation on an onboarding, behind one endpoint.
 *
 * WHY ONE ROUTE AND A DISCRIMINATED ACTION
 * ----------------------------------------
 * Six verbs against the same record, each needing the same session check, the
 * same shape of error, and the same audit line. Six files would be six places to
 * forget one of them. The action union is validated by zod, so an unknown verb
 * is a 400 rather than a fall through to whatever the last branch happened to
 * do.
 *
 * THE SESSION IS CHECKED HERE TOO
 * -------------------------------
 * The middleware already refuses an unauthenticated request to /api/admin. This
 * is the second lock, and the reasoning is in src/middleware.ts: a matcher is a
 * pattern and a pattern can be wrong silently. `requireAdmin` throws, and the
 * catch turns that into 401 rather than 500.
 *
 * NO ACTION HERE RETURNS A DOCUMENT OR A TOKEN TO THE BROWSER EXCEPT THE INVITE
 * -----------------------------------------------------------------------------
 * The invite URL is the one credential that has to travel, because emailing it
 * is the entire point of the action. It is returned so the operator can copy it
 * if the mail does not arrive, and that is a deliberate trade rather than an
 * oversight: the alternative is an operator with no way to help somebody whose
 * email is bouncing.
 */

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    personName: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional(),
    role: z.enum(["engineer", "field_tech"]),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({ action: z.literal("resend"), onboardingId: z.string().uuid() }),
  z.object({
    action: z.literal("item"),
    onboardingId: z.string().uuid(),
    itemKey: z.string().trim().min(1).max(120),
    decision: z.enum(["accepted", "rejected"]),
    reason: z.string().trim().max(600).optional(),
  }),
  z.object({
    action: z.literal("verification"),
    onboardingId: z.string().uuid(),
    field: z.enum(["identity_verified_at", "i9_examined_at"]),
    value: z.boolean(),
  }),
  z.object({
    action: z.literal("status"),
    onboardingId: z.string().uuid(),
    status: z.enum(["invited", "in_progress", "submitted", "verified", "complete"]),
  }),
]);

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "That request is not valid." }, { status: 400 });
  }
  const input = parsed.data;

  if (input.action === "create") {
    const created = await createOnboarding({
      personName: input.personName,
      email: input.email,
      phone: input.phone,
      role: input.role,
      notes: input.notes,
    });
    if (!created.ok) return NextResponse.json({ ok: false, error: created.error }, { status: 500 });

    const url = inviteUrl(business.url, created.data.token);
    // Sent explicitly rather than on creation, so a link is never in flight
    // before the operator meant it to be. That decision is the branch's, and it
    // is kept: creating and sending are one operator action here, but the send
    // is still a separate call whose outcome is reported.
    const sent = await notify(
      onboardingInvite({
        personName: created.data.onboarding.person_name,
        personEmail: created.data.onboarding.email,
        role: input.role,
        inviteUrl: url,
        expiresAt: new Date(created.data.onboarding.invite_expires_at).toDateString(),
      }),
    );
    return NextResponse.json({
      ok: true,
      id: created.data.onboarding.id,
      inviteUrl: url,
      emailed: sent.outcome === "ok",
      emailOutcome: sent.outcome,
    });
  }

  if (input.action === "resend") {
    const fresh = await regenerateInvite(input.onboardingId);
    if (!fresh.ok) return NextResponse.json({ ok: false, error: fresh.error }, { status: 500 });
    return NextResponse.json({
      ok: true,
      inviteUrl: inviteUrl(business.url, fresh.data.token),
    });
  }

  if (input.action === "item") {
    const done = await setItemDecision({
      onboardingId: input.onboardingId,
      itemKey: input.itemKey,
      decision: input.decision,
      reason: input.reason,
    });
    if (!done.ok) return NextResponse.json({ ok: false, error: done.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (input.action === "verification") {
    const done = await setVerification(input.onboardingId, input.field, input.value);
    if (!done.ok) return NextResponse.json({ ok: false, error: done.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const done = await setStatus(input.onboardingId, input.status);
  if (!done.ok) return NextResponse.json({ ok: false, error: done.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
