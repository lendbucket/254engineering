import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const actor = await currentActor();
  if (!can(actor, "clients.list")) notFound();

  return (
    <>
      <PageHead eyebrow="Relationships" title="Clients" lede="Organizations and individuals, with every file they have ever had." />
      <Panel>
        <EmptyState title="No clients yet" body="Leads captured on the public sites convert into clients and files in one action, carrying their original attribution with them. Clients arrive in Phase 1." />
      </Panel>
    </>
  );
}
