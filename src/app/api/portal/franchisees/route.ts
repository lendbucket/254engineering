import { NextResponse, type NextRequest } from "next/server";
import { csv, csvHeaders } from "@/lib/csv";
import { auditExportOrRefuse } from "@/lib/export-audit";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { FRANCHISEE_STATUSES, FRANCHISEE_STATUS_LABEL, type FranchiseeStatus } from "@/lib/franchisee-rules";
import {
  createFranchisee,
  listFranchisees,
  saveOffice,
  setFranchiseeMember,
  setFranchiseeStatus,
  setFranchiseeTerritory,
  type FranchiseeListQuery,
} from "@/lib/franchisees";
import { mayExport } from "@/lib/list-exports";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE FRANCHISEE RECORD (0126). Robert's overnight orders of 2026-11-10,
 * platform item X1. franchise.manage, which only admin holds. Staff and admin
 * only: nothing here is public and nothing offers a franchise (FR13). Every act
 * is audited first inside the library; this route reads the request and
 * answers.
 *
 *   GET  ?format=csv   the list as CSV, its audit row written before the file
 *   POST create        a franchisee by legal name, onboarding
 *        office        its office address and phone, whole or cleared
 *        status        onboarding, operating, or ended with a reason
 *        territory     give it a sales territory, or take one off it
 *        member        give it a technician or rep, or take one off it
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v : "");
const NOT_ALLOWED = "Only an administrator keeps the franchisee record.";

function queryFrom(params: URLSearchParams): FranchiseeListQuery {
  const status = params.get("status");
  const sort = params.get("sort");
  return {
    status: (FRANCHISEE_STATUSES as readonly string[]).includes(String(status)) ? (status as FranchiseeStatus) : "all",
    q: params.get("q") ?? undefined,
    sort: sort === "newest" || sort === "oldest" ? sort : "name",
  };
}

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "franchise.manage")) return bad(NOT_ALLOWED, 403);
  const params = request.nextUrl.searchParams;
  if (params.get("format") !== "csv") return bad("Ask for format=csv.");
  if (!mayExport(actor, "franchise.manage")) return bad("Your role cannot export the franchisee record.", 403);
  const list = await listFranchisees(actor, queryFrom(params));
  if (!list.ok) return bad(`${list.error} No file was made.`, 500);

  const refused = await auditExportOrRefuse(actor, "export.franchisees", `Exported ${list.rows.length} franchisees as CSV`);
  if (refused) return bad(refused, 503);
  const body = csv({
    preamble: [["Franchisees", `${list.rows.length} matching`]],
    headers: ["Legal name", "Status", "Added", "Office street", "City", "Postal code", "Office phone", "Territories", "People", "Ended", "Why it ended"],
    rows: list.rows.map((r) => [
      r.legalName,
      FRANCHISEE_STATUS_LABEL[r.status],
      formatInFirmZone(r.createdAt) ?? r.createdAt,
      r.office.street ?? "",
      r.office.city ?? "",
      r.office.postalCode ?? "",
      r.office.phone ?? "",
      r.territories.map((t) => t.name).join("; "),
      r.members,
      r.endedAt ? (formatInFirmZone(r.endedAt) ?? r.endedAt) : "",
      r.endedReason ?? "",
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("franchisees.csv") });
}

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "franchise.manage")) return bad(NOT_ALLOWED, 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("The request could not be read.");
  }
  const action = str(body.action);

  if (action === "create") {
    const result = await createFranchisee(actor, { legalName: str(body.legalName) });
    return result.ok ? NextResponse.json({ ...result, said: "Added, onboarding. Now give it its office, territories and people." }) : bad(result.error, 422);
  }
  if (action === "office") {
    const result = await saveOffice(actor, {
      id: str(body.id),
      street: str(body.street),
      city: str(body.city),
      postalCode: str(body.postalCode),
      phone: str(body.phone),
    });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "status") {
    const result = await setFranchiseeStatus(actor, { id: str(body.id), to: str(body.to), reason: str(body.reason) || null });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "territory") {
    const result = await setFranchiseeTerritory(actor, { id: str(body.id), territoryId: str(body.territoryId), holds: body.holds === true });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  if (action === "member") {
    const result = await setFranchiseeMember(actor, { id: str(body.id), profileId: str(body.profileId), belongs: body.belongs === true });
    return result.ok ? NextResponse.json(result) : bad(result.error, 422);
  }
  return bad("That is not something the franchisee record does.");
}

export const POST = withSaveOutcome(handlePOST);
