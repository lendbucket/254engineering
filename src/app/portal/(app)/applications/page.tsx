import { notFound, redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listApplications } from "@/lib/admin-data";
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

export default async function PortalApplicationsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "profiles.create")) notFound();

  const raw = await listApplications();

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
        new Date(r.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
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
                <span key={d.label} className="text-[13px] text-[var(--secondary)]">
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

      <Panel>
        <DataTable
          caption="Applications for the two open positions"
          columns={columns}
          rows={rows}
          total={rows.length}
          empty={
            <EmptyState
              title="No applications"
              body="One appears here when somebody completes the flow on the careers pages. Nothing is filtered out, including applications that did not finish uploading."
            />
          }
        />
      </Panel>
    </>
  );
}
