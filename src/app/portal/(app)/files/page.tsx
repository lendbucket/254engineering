import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const actor = await currentActor();
  if (!can(actor, "files.list")) notFound();

  return (
    <>
      <PageHead eyebrow="Work" title="Files" lede="One file per deliverable request, from intake to delivered." />
      <Panel>
        <EmptyState title="No files yet" body="A file is created from a lead or from scratch, carries the property and the client, and moves through a status pipeline the platform enforces. Files arrive in Phase 1." />
      </Panel>
    </>
  );
}
