import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { jobView } from "./ops-field";
import { services } from "@/content/services";
import { BINDER_HEADERS, binderRows, limitationsFor, type Binder } from "./ops-binder";
import { csv } from "./csv";
import { marginOf, moneyCell, periodTotals, type Cents, type FileMoney } from "./ops-money";

/**
 * Documents, billing, and the numbers the dashboards read.
 *
 * WHY BILLING IS READ ONLY HERE
 * -----------------------------
 * There is no invoicing in this phase and no payment provider. What exists is
 * the ability to SEE margin per file and per period from figures already on the
 * file, which is the thing an operator cannot currently get without a
 * spreadsheet and an evening.
 *
 * Writing invoices is Phase 7 territory and depends on the order engine. Building
 * half of it now would mean a second billing model to reconcile later.
 */

type Context = { ip?: string | null; userAgent?: string | null };

// ----------------------------------------------------------------- documents

export type DocumentRow = {
  id: string;
  created_at: string;
  file_id: string | null;
  kind: string;
  title: string;
  bucket: string;
  storage_key: string;
  content_type: string | null;
  byte_size: number | null;
  version: number;
  sealed_at: string | null;
  sealed_by: string | null;
  expires_on: string | null;
  visibility: string;
};

const DOCUMENT_COLUMNS =
  "id, created_at, file_id, kind, title, bucket, storage_key, content_type, byte_size, version, sealed_at, sealed_by, expires_on, visibility";

/**
 * The document centre.
 *
 * Visibility is enforced in the query rather than after it. `admin_only` is the
 * one that matters: a document marked that way is one somebody deliberately kept
 * from the field and the engineering side, and filtering it out in JavaScript
 * after loading it would mean it had already been serialized into a response.
 */
export async function listDocuments(
  actor: Actor | null,
  filters: { fileId?: string; kind?: string } = {},
): Promise<DocumentRow[]> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "documents.read")) return [];

  let query = db.from("eng_documents").select(DOCUMENT_COLUMNS);
  if (actor!.role !== "admin") query = query.neq("visibility", "admin_only");
  if (filters.fileId) query = query.eq("file_id", filters.fileId);
  if (filters.kind) query = query.eq("kind", filters.kind);

  const { data } = await query.order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as DocumentRow[];
}

/** A time limited link to a stored document. The buckets stay private. */
export async function documentUrl(actor: Actor | null, documentId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "documents.read")) return null;

  const { data } = await db
    .from("eng_documents")
    .select("bucket, storage_key, visibility")
    .eq("id", documentId)
    .maybeSingle();
  if (!data) return null;
  if (data.visibility === "admin_only" && actor!.role !== "admin") return null;

  const signed = await db.storage
    .from(data.bucket as string)
    .createSignedUrl(data.storage_key as string, 60 * 60);
  return signed.data?.signedUrl ?? null;
}

// -------------------------------------------------------------- the binder

/**
 * Assemble a file's evidence binder.
 *
 * Reuses jobView, so the binder sees exactly what the reviewing engineer saw:
 * the same protocol, the same captures, the same completeness rule. A binder
 * assembled from its own query would be a second opinion about what the evidence
 * was, and the two would eventually disagree.
 */
export async function binderFor(actor: Actor | null, fileId: string): Promise<Binder | null> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "files.list")) return null;

  const view = await jobView(actor, fileId);
  if (!view) return null;

  const { data: file } = await db
    .from("eng_files")
    .select("file_number, property_address, city, county, service_slug, twia_county, status, assigned_tech_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return null;

  const { data: technician } = file.assigned_tech_id
    ? await db.from("eng_profiles").select("display_name").eq("id", file.assigned_tech_id).maybeSingle()
    : { data: null };

  const { data: sessions } = await db
    .from("eng_review_sessions")
    .select("id, decision, ended_at, minutes, engineer_id")
    .eq("file_id", fileId)
    .not("decision", "is", null)
    .order("ended_at", { ascending: true });

  const engineerIds = [...new Set((sessions ?? []).map((s) => s.engineer_id as string))];
  const { data: engineers } = engineerIds.length
    ? await db.from("eng_profiles").select("id, display_name, license_number").in("id", engineerIds)
    : { data: [] };
  const engineerById = new Map((engineers ?? []).map((e) => [e.id as string, e]));

  /*
   * The reason a file went back lives on the charge log rather than the session,
   * and review_session_id is what joins them. Matching on a timestamp instead
   * would file one engineer's reasoning under another engineer's decision the
   * first time two reviews landed in the same minute.
   */
  const { data: chargeRows } = await db
    .from("eng_responsible_charge_log")
    .select("refusal_reason, review_session_id")
    .eq("file_id", fileId);
  const reasonBySession = new Map(
    (chargeRows ?? [])
      .filter((r) => r.review_session_id)
      .map((r) => [r.review_session_id as string, (r.refusal_reason as string | null) ?? null]),
  );

  const items = view.state.items.map((status) => ({
    itemKey: status.item.itemKey,
    label: status.item.label,
    kind: status.item.kind,
    required: status.item.required,
    satisfied: status.satisfied,
    shortfall: status.problem,
    captures: view.captures
      .filter((c) => c.item_key === status.item.itemKey)
      .map((c) => ({
        id: c.id,
        valueText: c.value_text,
        valueNumber: c.value_number === null ? null : Number(c.value_number),
        unit: c.unit,
        storageKey: c.storage_key,
        capturedAt: c.captured_at,
        lat: c.captured_lat === null ? null : Number(c.captured_lat),
        lng: c.captured_lng === null ? null : Number(c.captured_lng),
      })),
  }));

  const missingCount = items.filter((i) => i.required && !i.satisfied).length;
  const photographCount = items.reduce(
    (n, i) => n + i.captures.filter((c) => c.storageKey).length,
    0,
  );
  const sealed = file.status === "sealed" || file.status === "delivered" || file.status === "closed";

  return {
    fileNumber: file.file_number as string,
    propertyAddress: file.property_address as string,
    city: (file.city as string | null) ?? null,
    county: file.county as string,
    serviceName: services.find((s) => s.slug === file.service_slug)?.name ?? (file.service_slug as string),
    twiaCounty: Boolean(file.twia_county),
    protocolName: view.protocol?.name ?? null,
    protocolVersion: view.protocol?.version ?? null,
    technicianName: (technician?.display_name as string | undefined) ?? null,
    items,
    decisions: (sessions ?? []).map((s) => {
      const engineer = engineerById.get(s.engineer_id as string);
      return {
        decision: s.decision as Binder["decisions"][number]["decision"],
        at: s.ended_at as string,
        engineerName: (engineer?.display_name as string) ?? "An engineer who has left",
        licenseNumber: (engineer?.license_number as string | null) ?? null,
        minutes: (s.minutes as number | null) ?? null,
        reason: reasonBySession.get(s.id as string) ?? null,
      };
    }),
    complete: missingCount === 0,
    missingCount,
    generatedAt: new Date().toISOString(),
    limitations: limitationsFor({ complete: missingCount === 0, missingCount, sealed, photographCount }),
  };
}

/** The binder as a file somebody can keep. */
export function binderCsv(binder: Binder): string {
  return csv({
    preamble: [
      ["Evidence binder", binder.fileNumber],
      ["Property", binder.propertyAddress],
      ["City", binder.city ?? ""],
      ["County", binder.county],
      ["Service", binder.serviceName],
      ["Windstorm designated county", binder.twiaCounty ? "yes" : "no"],
      ["Protocol", binder.protocolName ? `${binder.protocolName} v${binder.protocolVersion}` : "none attached"],
      ["Captured by", binder.technicianName ?? "not recorded"],
      ["Required items missing", binder.missingCount],
      ["Generated", binder.generatedAt],
      ...binder.decisions.map(
        (d, i) =>
          [
            `Review ${i + 1}`,
            `${d.decision} by ${d.engineerName}${d.licenseNumber ? ` (${d.licenseNumber})` : ""} at ${d.at}${
              d.minutes === null ? "" : `, ${d.minutes} minutes`
            }${d.reason ? `. ${d.reason}` : ""}`,
          ] as [string, unknown],
      ),
      ...binder.limitations.map((l, i) => [`Limitation ${i + 1}`, l] as [string, unknown]),
    ],
    headers: BINDER_HEADERS,
    rows: binderRows(binder),
  });
}

// --------------------------------------------------------------- billing

export type FileMargin = FileMoney & {
  id: string;
  file_number: string;
  property_address: string;
  county: string;
  status: string;
  service_slug: string;
  period: string | null;
};

const num = (v: number | string | null | undefined): Cents =>
  v === null || v === undefined || v === "" ? null : Number(v);

/**
 * Every file's money, for the billing screen and the dashboards.
 *
 * The period is the month the file was DELIVERED where that is known, and the
 * month it was opened otherwise. Recorded because it is a judgment: revenue
 * belongs to the month the work was handed over rather than the month somebody
 * first typed the address, and a file still in flight has no delivery month yet.
 */
export async function fileMargins(actor: Actor | null): Promise<FileMargin[]> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "billing.read")) return [];

  const { data } = await db
    .from("eng_files")
    .select(
      "id, file_number, property_address, county, status, service_slug, client_price_cents, tech_cost_cents, engineer_cost_cents, delivered_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (data ?? []).map((f) => ({
    id: f.id as string,
    file_number: f.file_number as string,
    property_address: f.property_address as string,
    county: f.county as string,
    status: f.status as string,
    service_slug: f.service_slug as string,
    clientPriceCents: num(f.client_price_cents as number | null),
    techCostCents: num(f.tech_cost_cents as number | null),
    engineerCostCents: num(f.engineer_cost_cents as number | null),
    period: String((f.delivered_at as string | null) ?? (f.created_at as string)).slice(0, 7),
  }));
}

export function marginByPeriod(files: FileMargin[]) {
  const byPeriod = new Map<string, FileMargin[]>();
  for (const file of files) {
    const key = file.period ?? "unknown";
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), file]);
  }
  return [...byPeriod.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, rows]) => periodTotals(period, rows));
}

export function marginCsv(files: FileMargin[]): string {
  return csv({
    preamble: [
      ["Margin by file", new Date().toISOString().slice(0, 10)],
      ["Files", files.length],
      [
        "Note",
        "An empty money cell means the figure has not been entered. It is not a zero, and a column summed with empty cells is a total about the files that have figures rather than about all of them.",
      ],
    ],
    headers: [
      "File",
      "Property",
      "County",
      "Status",
      "Period",
      "Client price",
      "Technician cost",
      "Engineer production",
      "Margin",
      "Margin percent",
      "Missing",
    ],
    rows: files.map((f) => {
      const m = marginOf(f);
      return [
        f.file_number,
        f.property_address,
        f.county,
        f.status,
        f.period ?? "",
        moneyCell(f.clientPriceCents),
        moneyCell(f.techCostCents),
        moneyCell(f.engineerCostCents),
        moneyCell(m.margin),
        m.marginPercent === null ? "" : m.marginPercent,
        m.missing.join("; "),
      ];
    }),
  });
}

export function periodCsv(files: FileMargin[]): string {
  return csv({
    preamble: [
      ["Margin by period", new Date().toISOString().slice(0, 10)],
      [
        "Note",
        "Totals cover only files where all three figures are present. Files missing a figure are excluded rather than counted as nothing, so a total is the truth about what is known rather than a flattering guess.",
      ],
    ],
    headers: ["Period", "Files", "Files with every figure", "Revenue", "Cost", "Margin", "Margin percent", "Coverage"],
    rows: marginByPeriod(files).map((p) => [
      p.period,
      p.files,
      p.complete,
      moneyCell(p.revenue),
      moneyCell(p.cost),
      moneyCell(p.margin),
      p.marginPercent === null ? "" : p.marginPercent,
      p.coverage,
    ]),
  });
}

/** Record a document that was produced outside the platform. */
export async function recordDocument(
  actor: Actor & { email: string },
  input: {
    fileId?: string | null;
    kind: string;
    title: string;
    bucket: string;
    storageKey: string;
    visibility?: string;
    expiresOn?: string | null;
  },
  context: Context = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "files.update")) return { ok: false, error: "Your role cannot file documents." };
  if (!input.title.trim()) return { ok: false, error: "A document needs a title." };

  const { data, error } = await db
    .from("eng_documents")
    .insert({
      file_id: input.fileId || null,
      kind: input.kind,
      title: input.title.trim(),
      bucket: input.bucket,
      storage_key: input.storageKey,
      visibility: input.visibility ?? "internal",
      expires_on: input.expiresOn || null,
      uploaded_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not file that document." };

  await writeAudit({
    actor,
    action: "document.record",
    entityType: "document",
    entityId: data.id,
    summary: `Filed ${input.title.trim()}`,
    ...context,
  });
  return { ok: true, id: data.id as string };
}
