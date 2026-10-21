import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import {
  convertProspect,
  createProspect,
  importProspects,
  listProspects,
  updateProspect,
  type ProspectQuery,
} from "@/lib/ops-prospects";
import { PROSPECT_TYPE_LABEL } from "@/lib/prospect-import";
import { accountWelcome } from "@/lib/email-templates";
import { queueEmail } from "@/lib/ops-jobs";
import { VERIFICATION_TTL_WORDS } from "@/lib/account-doors";
import { business } from "@/config/business";
import { csv, csvHeaders } from "@/lib/csv";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE SALES LIST. crm.use, 2026-10-20. Every act is audited inside the library
 * through writeAuditOrRefuse; this route only reads the request and answers.
 *
 * GET is the CSV of everything matching the filter, not one page.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

function queryFrom(params: URLSearchParams): ProspectQuery {
  return {
    search: params.get("q") ?? undefined,
    status: (params.get("status") as ProspectQuery["status"]) ?? "open",
    type: (params.get("type") as ProspectQuery["type"]) ?? "all",
    city: params.get("city") ?? undefined,
    owner: params.get("owner") ?? "all",
    sort: (params.get("sort") as ProspectQuery["sort"]) ?? "follow_up",
    direction: params.get("dir") === "desc" ? "desc" : "asc",
    page: 1,
    pageSize: 200,
  };
}

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "crm.use")) return bad("Not permitted.", 403);

  const params = request.nextUrl.searchParams;
  const q = queryFrom(params);
  const rows = [];
  for (let page = 1; ; page += 1) {
    const read = await listProspects(actor, { ...q, page });
    if (!read.ok) return bad(read.error, 500);
    rows.push(...read.rows);
    if (page * read.pageSize >= read.total) break;
  }
  const body = csv({
    preamble: [
      ["Sales list", `${rows.length} prospects matching the filter`],
    ],
    headers: ["Company", "Contact", "Phone", "Email", "City", "Type", "Status", "Follow up on", "Last contact", "Owner"],
    rows: rows.map((r) => [
      r.company,
      r.contactName,
      r.phone,
      r.email,
      r.city,
      PROSPECT_TYPE_LABEL[r.prospectType],
      r.status.replace(/_/g, " "),
      r.followUpOn,
      r.lastContactAt,
      r.ownerName,
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("sales-list.csv") });
}

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "crm.use")) return bad("Not permitted.", 403);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const str = (k: string) => (typeof body?.[k] === "string" ? (body[k] as string) : null);

  if (action === "create") {
    const result = await createProspect(actor, {
      company: str("company") ?? "",
      contactName: str("contactName"),
      phone: str("phone"),
      email: str("email"),
      city: str("city"),
      prospectType: str("prospectType") ?? "",
      followUpOn: str("followUpOn"),
    });
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "update") {
    const id = str("id") ?? "";
    const change: Parameters<typeof updateProspect>[2] = {};
    if (body && "followUpOn" in body) change.followUpOn = str("followUpOn");
    if (body && "ownerId" in body) change.ownerId = str("ownerId");
    if (body && "status" in body) change.status = str("status") as "open" | "not_interested";
    if (body && typeof body.details === "object" && body.details) {
      const d = body.details as Record<string, unknown>;
      change.details = {
        company: String(d.company ?? ""),
        contactName: (d.contactName as string | null) ?? null,
        phone: (d.phone as string | null) ?? null,
        email: (d.email as string | null) ?? null,
        city: (d.city as string | null) ?? null,
        prospectType: String(d.prospectType ?? ""),
        followUpOn: (d.followUpOn as string | null) ?? null,
      };
    }
    const result = await updateProspect(actor, id, change);
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "import") {
    const result = await importProspects(actor, {
      csv: str("csv") ?? "",
      defaultType: str("defaultType"),
      dryRun: body?.dryRun !== false,
    });
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "convert") {
    const result = await convertProspect(actor, str("id") ?? "");
    if (!result.ok) return bad(result.error);
    /*
     * The same welcome the operator door sends (api/portal/accounts/create):
     * a set password link, never a password. From development this only ever
     * reaches an @audit-probe.invalid address.
     */
    if (result.link) {
      const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
      await queueEmail(
        accountWelcome({
          customerName: result.displayName,
          customerEmail: result.email,
          origin: "operator_created",
          link: `${base.replace(/\/$/, "")}/account/set-password?token=${encodeURIComponent(result.link.token)}`,
          expiresIn: result.link.expiresIn ?? VERIFICATION_TTL_WORDS,
        }),
      );
    }
    return NextResponse.json({ ok: true, accountId: result.accountId, clientId: result.clientId });
  }

  return bad("Unknown action.");
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
