import { NextResponse, type NextRequest } from "next/server";
import { createAccount, currentActor, issueSetPasswordToken, requestContext } from "@/lib/ops-auth";
import { can, type Role } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";
import { supabaseAdmin } from "@/lib/supabase";
import { notify } from "@/lib/notify";
import { portalInvite, portalPasswordReset } from "@/lib/email-templates";
import { business } from "@/config/business";

/**
 * Account administration: create, resend an invite, suspend, restore, force a
 * reset.
 *
 * EVERY BRANCH CHECKS can() BEFORE IT DOES ANYTHING
 * -------------------------------------------------
 * The proxy keeps signed out requests away and the layout keeps them off the
 * page, and neither of those is what protects this endpoint. A technician with a
 * valid session can POST here as easily as an admin can. So the action check is
 * first, every time, and it uses the same matrix the navigation is derived from.
 *
 * The role is read from the DATABASE by currentActor, never from the cookie, so
 * a suspension five minutes ago is in force now.
 */

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["admin", "engineer", "field_tech"];

function inviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
  return `${base.replace(/\/$/, "")}/portal/set-password?token=${encodeURIComponent(token)}`;
}

function signInUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
  return `${base.replace(/\/$/, "")}/portal/login`;
}

function expiryPhrase(at: Date): string {
  return at.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const { ip, userAgent } = await requestContext();
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "The database is not configured." }, { status: 503 });

  // ---------------------------------------------------------------- create
  if (action === "create") {
    if (!can(actor, "profiles.create")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }

    const role = String(body?.role ?? "");
    if (!ROLES.includes(role as Role)) {
      return NextResponse.json({ ok: false, error: "Choose a role." }, { status: 400 });
    }
    const displayName = String(body?.displayName ?? "").trim();
    const email = String(body?.email ?? "").trim();
    if (!displayName || !email) {
      return NextResponse.json({ ok: false, error: "A name and an email are both required." }, { status: 400 });
    }

    const counties = Array.isArray(body?.coverageCounties)
      ? (body.coverageCounties as unknown[]).map((c) => String(c)).filter(Boolean)
      : [];

    const created = await createAccount({
      email,
      displayName,
      role: role as Role,
      phone: body?.phone ? String(body.phone) : null,
      licenseNumber: body?.licenseNumber ? String(body.licenseNumber) : null,
      tdiAppointment: body?.tdiAppointment ? String(body.tdiAppointment) : null,
      coverageCounties: counties,
      baseCity: body?.baseCity ? String(body.baseCity) : null,
      baseCounty: body?.baseCounty ? String(body.baseCounty) : null,
    });

    if (!created.ok) return NextResponse.json({ ok: false, error: created.error }, { status: 400 });

    const sent = await notify(
      portalInvite({
        personName: displayName,
        personEmail: email,
        role: role as Role,
        setPasswordUrl: created.linked ? null : inviteUrl(created.token),
        expiresAt: created.linked ? null : expiryPhrase(created.expiresAt),
        invitedBy: actor.display_name,
        signInUrl: signInUrl(),
      }),
    );

    await writeAudit({
      actor: { id: actor.id, role: actor.role, email: actor.email },
      action: "profile.create",
      entityType: "profile",
      entityId: created.profileId,
      summary: created.linked
        ? `Linked the existing account ${email} to a ${role} profile`
        : `Created ${displayName} (${email}) as ${role}`,
      diff: { role: { from: null, to: role }, status: { from: null, to: "invited" } },
      ip,
      userAgent,
    });

    /*
     * The account exists whether or not the email left. Saying so is the
     * difference between an operator who resends the invite and an operator who
     * creates the account a second time and hits "already has an account".
     */
    return NextResponse.json({
      ok: true,
      profileId: created.profileId,
      linked: created.linked,
      emailSent: sent.sent,
      emailError: sent.sent
        ? null
        : "The account was created but the invite email did not send. Resend it from the roster.",
    });
  }

  // ---------------------------------------------------------------- resend
  if (action === "resend_invite" || action === "force_reset") {
    const permitted = action === "resend_invite" ? "profiles.create" : "profiles.force_reset";
    if (!can(actor, permitted)) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }

    const profileId = String(body?.profileId ?? "");
    const { data: target } = await db
      .from("eng_profiles")
      .select("id, email, display_name, role, status")
      .eq("id", profileId)
      .maybeSingle();
    if (!target) return NextResponse.json({ ok: false, error: "No such person." }, { status: 404 });

    const issued = await issueSetPasswordToken(
      profileId,
      action === "resend_invite" ? "set_password" : "reset_password",
      actor.id,
    );
    if (!issued) return NextResponse.json({ ok: false, error: "The link could not be issued." }, { status: 500 });

    const sent = await notify(
      action === "resend_invite"
        ? portalInvite({
            personName: target.display_name as string,
            personEmail: target.email as string,
            role: target.role as Role,
            setPasswordUrl: inviteUrl(issued.token),
            expiresAt: expiryPhrase(issued.expiresAt),
            invitedBy: actor.display_name,
            signInUrl: signInUrl(),
          })
        : portalPasswordReset({
            personName: target.display_name as string,
            personEmail: target.email as string,
            setPasswordUrl: inviteUrl(issued.token),
            expiresAt: expiryPhrase(issued.expiresAt),
            forcedByAdmin: true,
          }),
    );

    await writeAudit({
      actor: { id: actor.id, role: actor.role, email: actor.email },
      action: action === "resend_invite" ? "profile.invite_resent" : "profile.force_reset",
      entityType: "profile",
      entityId: profileId,
      summary: `${action === "resend_invite" ? "Resent the invite to" : "Forced a password reset for"} ${target.display_name}`,
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, emailSent: sent.sent });
  }

  // ------------------------------------------------------- suspend/restore
  if (action === "suspend" || action === "restore") {
    if (!can(actor, "profiles.suspend")) {
      return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
    }

    const profileId = String(body?.profileId ?? "");
    if (profileId === actor.id) {
      return NextResponse.json(
        { ok: false, error: "You cannot suspend your own account." },
        { status: 400 },
      );
    }

    const { data: target } = await db
      .from("eng_profiles")
      .select("id, display_name, status")
      .eq("id", profileId)
      .maybeSingle();
    if (!target) return NextResponse.json({ ok: false, error: "No such person." }, { status: 404 });

    const nextStatus = action === "suspend" ? "suspended" : "active";
    const { error } = await db
      .from("eng_profiles")
      .update({
        status: nextStatus,
        suspended_at: action === "suspend" ? new Date().toISOString() : null,
      })
      .eq("id", profileId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await writeAudit({
      actor: { id: actor.id, role: actor.role, email: actor.email },
      action: action === "suspend" ? "profile.suspend" : "profile.restore",
      entityType: "profile",
      entityId: profileId,
      summary: `${action === "suspend" ? "Suspended" : "Restored"} ${target.display_name}`,
      diff: { status: { from: target.status, to: nextStatus } },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
