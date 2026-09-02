import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const actor = await currentActor();
  if (!can(actor, "review.queue")) notFound();

  return (
    <>
      <PageHead eyebrow="Engineering" title="Review queue" lede="Files with evidence submitted, oldest due date first." />
      <Panel>
        <EmptyState title="Nothing waiting for review" body="When a technician submits an evidence package, the file appears here with the photographs, measurements, and county flags alongside the client request. Review arrives in Phase 4." />
      </Panel>
    </>
  );
}
