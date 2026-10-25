import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listApplicationsPage } from "@/lib/admin-data";
import { ListControls, listHref } from "@/components/portal/ListControls";
import { LIST_NOT_LOADED } from "@/lib/outcome-copy";
import { RetryButton } from "@/components/portal/Unreachable";
import { signedDownloadUrl } from "@/lib/uploads";
import {
  DataTable,
  EmptyState,
  Panel,
  RestrictedMode,
  StatusPill,
  type Column,
} from "@/components/portal/design";
import { PageHead } from "@/components/portal/surfaces";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * Applications for the two open positions.
 *
 * WHY THIS SCREEN EXISTS NOW
 * --------------------------
 * It is the last thing the legacy `/admin` surface did that the portal did not.
 * Leads were absorbed by the clients screen and onboarding by the portal's own,
 * and deleting `/admin` without this would have removed the firm's only view of
 * its hiring pipeline. Ported rather than rewritten: same query, same signed
 * link behaviour, portal chrome and portal permissions.
 *
 * GATED ON profiles.create, AND THAT IS A JUDGMENT
 * ------------------------------------------------
 * There is no `applications.read` action, and adding one means a migration and
 * a grant seed for a screen two people will ever open. The person who reads an
 * application is the person who invites the successful one, and inviting is
 * exactly what `profiles.create` gates, so the permission already names this
 * job. If the operator ever wants a recruiter who can read applications and not
 * create accounts, that is one action and one migration and this line changes.
 *
 * THE DOCUMENT LINKS ARE MINTED AT RENDER AND NEVER STORED
 * --------------------------------------------------------
 * Carried over verbatim from the screen this replaces, because the reasoning is
 * unchanged. `eng-uploads` is private. A stored URL is either permanent, which
 * is a document readable forever by anybody who ever saw the link, or expired,
 * which is a dead link in a table. Minting on render gives a link that works
 * for the person looking now and stops working shortly after they leave, and it
 * is why this page is force-dynamic: a cached render would serve one operator's
 * signed URLs to the next request.
 */

type Row = {
  id: string;
  createdAt: string;
  role: string;
  name: string;
  email: string;
  city: string;
  documents: { label: string; filename: string; url: string | null }[];
};

const ROLE_LABEL: Record<string, string> = {
  professional_engineer: "Professional Engineer",
  field_technician: "Field Technician",
};

export default async function PortalApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "profiles.create")) notFound();
  const params = await searchParams;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);

  const read = await listApplicationsPage({ q: params.q, role: params.role, page });
  const raw = read.ok ? read.rows : [];
  const searching = Boolean(params.q || params.role);

  const rows: Row[] = await Promise.all(
    raw.map(async (r) => {
      const payload = (r.payload ?? {}) as Record<string, { path?: string; filename?: string }>;
      const documents: Row["documents"] = [];
      for (const [key, label] of [
        ["resume", "Resume"],
        ["licenseDocument", "Licence"],
        ["certifications", "Certifications"],
      ] as const) {
        const file = payload[key];
        if (file?.path) {
          documents.push({
            label,
            filename: file.filename ?? label,
            url: await signedDownloadUrl(file.path),
          });
        }
      }
      return {
        id: r.id,
        createdAt: r.created_at,
        role: r.role,
        name: r.name ?? "not given",
        email: r.email ?? "not given",
        city: r.city ?? "not given",
        documents,
      };
    }),
  );

  const columns: Column<Row>[] = [
    { key: "name", header: "Applicant", cell: (r) => <span className="font-semibold">{r.name}</span> },
    {
      key: "role",
      header: "Position",
      cell: (r) => (
        <StatusPill tone={r.role === "professional_engineer" ? "good" : "inert"}>
          {ROLE_LABEL[r.role] ?? r.role}
        </StatusPill>
      ),
    },
    { key: "email", header: "Email", cell: (r) => r.email },
    { key: "city", header: "City", cell: (r) => r.city },
    {
      key: "when",
      header: "Applied",
      cell: (r) =>
        (formatInFirmZone(r.createdAt, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }) ?? ""),
    },
    {
      key: "docs",
      header: "Documents",
      cell: (r) =>
        r.documents.length === 0 ? (
          "none"
        ) : (
          <span className="flex flex-wrap gap-2">
            {r.documents.map((d) =>
              d.url ? (
                <a
                  key={d.label}
                  href={d.url}
                  className="inline-flex min-h-[var(--tap-target)] items-center text-[13.5px] font-semibold text-[var(--navy)] underline"
                >
                  {d.label}
                </a>
              ) : (
                <span key={d.label} className="text-[13.5px] text-[var(--secondary)]">
                  {d.label} unavailable
                </span>
              ),
            )}
          </span>
        ),
    },
  ];

  return (
    <>
      <RestrictedMode />

      <PageHead
        eyebrow="Hiring"
        title="Applications"
        lede="Both open positions. Document links last about ten minutes and are minted when this page renders, so they cannot be forwarded usefully."
      />

      <ListControls
        action="/portal/applications"
        search={params.q ?? ""}
        searchLabel="Search name, email or city"
        filters={[
          {
            name: "role",
            label: "Position",
            value: params.role ?? "",
            options: [
              { value: "", label: "Both" },
              { value: "professional_engineer", label: ROLE_LABEL.professional_engineer },
              { value: "field_technician", label: ROLE_LABEL.field_technician },
            ],
          },
        ]}
        sorts={[{ value: "applied", label: "Applied" }]}
        sort="applied"
        direction="desc"
      />
      {!read.ok ? (
        <div role="alert" data-list-not-loaded className="py-6">
          <p className="text-[15px] font-semibold text-[var(--ink)]">{LIST_NOT_LOADED}</p>
          <p className="mt-1 text-[13.5px] text-[var(--secondary)]">The applications could not be read, so this is not an empty list.</p>
          <div className="mt-4 flex">
            <RetryButton />
          </div>
        </div>
      ) : (
        <Panel>
          <DataTable
            caption="Applications for the two open positions"
            columns={columns}
            rows={rows}
            total={rows.length}
            empty={
              searching ? (
                <EmptyState title="No application matches that search" body="Clear the search or show both positions." />
              ) : (
                <EmptyState
                  title="No applications"
                  body="One appears here when somebody completes the flow on the careers pages. Nothing is filtered out, including applications that did not finish uploading."
                />
              )
            }
          />
          {page > 1 || read.more ? (
            <nav aria-label="Pages of applications" className="mt-4 flex gap-3 print:hidden">
              {page > 1 ? (
                <a href={listHref("/portal/applications", params, { page: page - 1 > 1 ? String(page - 1) : "" })} className="inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline">
                  Previous page
                </a>
              ) : null}
              {read.more ? (
                <a href={listHref("/portal/applications", params, { page: String(page + 1) })} className="inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline">
                  Next page
                </a>
              ) : null}
            </nav>
          ) : null}
        </Panel>
      )}
    </>
  );
}
