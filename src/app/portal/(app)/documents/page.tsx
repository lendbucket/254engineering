import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listDocuments } from "@/lib/ops-docs";
import { listFiles } from "@/lib/ops-crm";
import { STATUS_LABEL, STATUS_TONE, type FileStatus } from "@/lib/ops-files";
import { Chip, EmptyState, PageHead, Panel, RecordTable } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

/**
 * The document centre.
 *
 * TWO KINDS OF DOCUMENT, AND THEY ARE NOT THE SAME THING
 * ------------------------------------------------------
 * A filed document is a stored artifact: a sealed deliverable, a signed
 * agreement, a certificate somebody uploaded. It exists as bytes in a private
 * bucket and this screen hands out a link that expires.
 *
 * An evidence binder is not stored at all. It is assembled from the file's
 * evidence every time somebody asks for it, so it always reflects what is
 * actually on the file rather than what was on it the day a copy was made. A
 * stale binder that looked authoritative is exactly the document a board or a
 * court should never be handed.
 *
 * WHAT IS NOT HERE
 * ----------------
 * Uploading from this screen. Documents reach the platform through the surfaces
 * that produce them: onboarding for credentials, review for deliverables. A
 * general uploader here would be a second path into the same table with none of
 * the checks those surfaces run.
 */

const KIND_LABEL: Record<string, string> = {
  deliverable: "Sealed deliverable",
  evidence_binder: "Evidence binder",
  responsible_charge_export: "Responsible charge export",
  firm_document: "Firm document",
  protocol_export: "Protocol export",
  other: "Other",
};

const VISIBILITY_LABEL: Record<string, string> = {
  internal: "Internal",
  client: "Released to client",
  admin_only: "Administrators only",
};

function bytes(size: number | null): string {
  if (size === null || !Number.isFinite(size)) return "size not recorded";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "documents.read")) redirect("/portal");

  const [documents, files] = await Promise.all([listDocuments(actor), listFiles(actor)]);

  return (
    <>
      <PageHead
        eyebrow="Records"
        title="Documents"
        lede="What the platform holds, and what it can assemble on demand. A binder is built when you ask for it, so it is never out of date with the file."
      />

      <Panel
        title="Evidence binders"
        description="Every item the protocol asked for, what was captured against it, every review decision, and what the binder does not contain. Assembled fresh each time."
      >
        <RecordTable
          rows={files}
          rowHref={(f) => `/portal/files?file=${f.id}`}
          columns={[
            { key: "file", head: "File", cell: (f) => <span className="font-semibold">{f.file_number}</span> },
            { key: "address", head: "Property", cell: (f) => f.property_address },
            { key: "county", head: "County", cell: (f) => f.county, wide: true },
            {
              key: "status",
              head: "Status",
              cell: (f) => (
                <Chip
                  label={STATUS_LABEL[f.status as FileStatus] ?? f.status}
                  tone={STATUS_TONE[f.status as FileStatus] ?? "neutral"}
                />
              ),
            },
            {
              key: "binder",
              head: "Binder",
              /*
                READ IT, OR TAKE IT AWAY. Two different jobs.
                The sheet is for looking at the binder; the CSV is for handing it
                to somebody else's system. The export was the only option, which
                meant answering "what did we capture on that file" involved
                downloading a spreadsheet.
              */
              cell: (f) => (
                <span className="flex flex-wrap gap-x-3">
                  <a
                    href={`/portal/documents/binder/${f.id}`}
                    className="font-semibold text-[var(--navy)] underline decoration-[var(--gold)] decoration-2 underline-offset-4"
                  >
                    Read
                  </a>
                  <a
                    href={`/api/portal/exports?report=binder&fileId=${f.id}`}
                    className="font-semibold text-[var(--secondary)] underline decoration-[var(--border-strong)] decoration-2 underline-offset-4"
                  >
                    CSV
                  </a>
                </span>
              ),
            },
          ]}
          card={(f) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-bold text-[var(--navy)]">{f.file_number}</p>
                <Chip
                  label={STATUS_LABEL[f.status as FileStatus] ?? f.status}
                  tone={STATUS_TONE[f.status as FileStatus] ?? "neutral"}
                />
              </div>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-[var(--secondary)]">
                {f.property_address}, {f.county} County
              </p>
              <a
                href={`/portal/documents/binder/${f.id}`}
                className="mt-3 inline-flex min-h-[var(--tap-target)] items-center text-[13.5px] font-bold text-[var(--navy)] underline decoration-[var(--gold)] decoration-2 underline-offset-4"
              >
                Read the binder
              </a>
            </div>
          )}
          empty={
            <EmptyState
              title="No files you can see"
              body="A binder is assembled from a file's evidence. When a file exists and you are allowed to see it, it appears here."
            />
          }
        />
      </Panel>

      <Panel
        className="mt-4"
        title="Filed documents"
        description="Stored artifacts. A download link is signed and expires in an hour, because these buckets are private and stay that way."
      >
        <RecordTable
          rows={documents}
          columns={[
            { key: "title", head: "Title", cell: (d) => <span className="font-semibold">{d.title}</span> },
            { key: "kind", head: "Kind", cell: (d) => KIND_LABEL[d.kind] ?? d.kind },
            {
              key: "version",
              head: "Version",
              cell: (d) => (d.version > 1 ? `v${d.version}` : "v1"),
              wide: true,
            },
            {
              key: "sealed",
              head: "Sealed",
              cell: (d) =>
                d.sealed_at ? (
                  <Chip label="Sealed" tone="good" />
                ) : (
                  <span className="text-[var(--secondary)]">Not sealed</span>
                ),
            },
            {
              key: "visibility",
              head: "Visibility",
              cell: (d) => VISIBILITY_LABEL[d.visibility] ?? d.visibility,
              wide: true,
            },
            {
              key: "download",
              head: "File",
              cell: (d) => (
                <a
                  href={`/api/portal/documents?id=${d.id}`}
                  className="font-semibold text-[var(--navy)] underline decoration-brass decoration-2 underline-offset-4"
                >
                  Open
                </a>
              ),
            },
          ]}
          card={(d) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-bold text-[var(--navy)]">{d.title}</p>
                {d.sealed_at ? <Chip label="Sealed" tone="good" /> : null}
              </div>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-[var(--secondary)]">
                {KIND_LABEL[d.kind] ?? d.kind}, {VISIBILITY_LABEL[d.visibility] ?? d.visibility},{" "}
                {bytes(d.byte_size)}
              </p>
              <a
                href={`/api/portal/documents?id=${d.id}`}
                className="mt-3 inline-flex min-h-[44px] items-center text-[13.5px] font-bold text-[var(--navy)] underline decoration-brass decoration-2 underline-offset-4"
              >
                Open the file
              </a>
            </div>
          )}
          empty={
            <EmptyState
              title="Nothing has been filed yet"
              body="Sealed deliverables land here when the compliance gate lifts and a Professional Engineer seals one. Credentials and agreements are filed from onboarding."
            />
          }
        />
      </Panel>

      <p className="mt-4 max-w-[74ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
        Every export is written to the{" "}
        <Link href="/portal/audit" className="font-semibold text-[var(--navy)] underline underline-offset-2">
          audit trail
        </Link>{" "}
        with who took it and when. That is the point of the trail, and it applies to administrators
        too.
      </p>
    </>
  );
}
