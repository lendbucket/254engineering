import "server-only";
import { randomUUID } from "node:crypto";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import type { PartnerPrincipal } from "./partner-auth";

/*
 * ===========================================================================
 * A PARTNER'S LOGO. Run item 19 of 2026-10-10; migration 0072.
 * ===========================================================================
 *
 * The partner uploads it; the operator approves or refuses it; only an approved
 * logo is ever served. A new upload replaces the old and goes back to pending.
 *
 * THE FILE IS JUDGED BY ITS BYTES, NOT BY WHAT IT SAYS IT IS. The declared
 * content type is the uploader's claim; the first bytes are the file's. PNG,
 * JPEG and WebP only, and never SVG, which can carry script and would be served
 * on a public page. The bucket enforces the same list and a one megabyte limit,
 * so the check here is the one that names the problem in a sentence.
 */
export const BRANDING_BUCKET = "eng-partner-branding";
export const MAX_LOGO_BYTES = 1024 * 1024;

export type LogoStatus = "none" | "pending" | "approved" | "refused";

/** The image type the bytes actually are, or null for anything else. */
export function sniffLogo(bytes: Uint8Array): { type: "image/png" | "image/jpeg" | "image/webp"; ext: string } | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { type: "image/png", ext: "png" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { type: "image/webp", ext: "webp" };
  }
  return null;
}

/** Null when this file may be uploaded, otherwise the sentence the partner sees. */
export function logoRefusal(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "That file is empty.";
  if (bytes.length > MAX_LOGO_BYTES) return "A logo can be up to one megabyte.";
  if (!sniffLogo(bytes)) return "A logo has to be a PNG, JPEG or WebP image. SVG is not accepted.";
  return null;
}

export async function uploadPartnerLogo(
  principal: PartnerPrincipal,
  bytes: Uint8Array,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const refusal = logoRefusal(bytes);
  if (refusal) return { ok: false, error: refusal };
  const kind = sniffLogo(bytes)!;

  /* The partner's own folder, from the session, never from the request. */
  const key = `${principal.partnerId}/${randomUUID()}.${kind.ext}`;
  const stored = await db.storage.from(BRANDING_BUCKET).upload(key, bytes, { contentType: kind.type, upsert: false });
  if (stored.error) return { ok: false, error: "The logo could not be stored, so nothing changed." };

  const { error } = await db
    .from("eng_partners")
    .update({
      brand_logo_key: key,
      brand_logo_status: "pending",
      brand_logo_uploaded_at: DB_NOW,
      brand_logo_decided_by: null,
      brand_logo_decided_at: null,
    })
    .eq("id", principal.partnerId);
  if (error) {
    await db.storage.from(BRANDING_BUCKET).remove([key]);
    return { ok: false, error: "The logo could not be recorded, so nothing changed." };
  }

  await writeAudit({
    actor: { id: null, role: "admin", email: principal.email },
    action: "partner.logo_uploaded",
    entityType: "partner",
    entityId: principal.partnerId,
    summary: `${principal.partner.organisation}: ${principal.displayName} uploaded a logo for approval`,
    ip: context.ip ?? null,
    userAgent: context.userAgent ?? null,
  });
  return { ok: true };
}

export async function decidePartnerLogo(
  actor: Actor & { email?: string },
  partnerId: string,
  decision: "approved" | "refused",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "partners.manage")) return { ok: false, error: "You do not have permission to manage the referral program." };

  const { data: partner } = await db
    .from("eng_partners")
    .select("id, organisation, brand_logo_status")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return { ok: false, error: "That partner does not exist." };
  if (partner.brand_logo_status !== "pending") return { ok: false, error: "There is no logo waiting for a decision." };

  const { error } = await db
    .from("eng_partners")
    .update({ brand_logo_status: decision, brand_logo_decided_by: actor.id, brand_logo_decided_at: DB_NOW })
    .eq("id", partnerId)
    .eq("brand_logo_status", "pending");
  if (error) return { ok: false, error: "The decision could not be recorded." };

  await writeAudit({
    actor,
    action: decision === "approved" ? "partner.logo_approved" : "partner.logo_refused",
    entityType: "partner",
    entityId: partnerId,
    summary: `${partner.organisation as string}: logo ${decision}`,
  });
  return { ok: true };
}

/** The partner's logo state and, when there is a file, a short-lived link for whoever is looking. */
export async function partnerLogo(
  partnerId: string,
  options: { approvedOnly: boolean },
): Promise<{ status: LogoStatus; url: string | null }> {
  const db = supabaseAdmin();
  if (!db) return { status: "none", url: null };
  const { data } = await db
    .from("eng_partners")
    .select("brand_logo_key, brand_logo_status")
    .eq("id", partnerId)
    .maybeSingle();
  const status = ((data?.brand_logo_status as LogoStatus | undefined) ?? "none");
  const key = (data?.brand_logo_key as string | null) ?? null;
  /* A public page asks with approvedOnly, and gets nothing for any other state. */
  if (!key || (options.approvedOnly && status !== "approved")) return { status, url: null };
  const signed = await db.storage.from(BRANDING_BUCKET).createSignedUrl(key, 60 * 60);
  return { status, url: signed.data?.signedUrl ?? null };
}
