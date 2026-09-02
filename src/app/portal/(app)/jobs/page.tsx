import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const actor = await currentActor();
  if (!can(actor, "offers.list_own")) notFound();

  return (
    <>
      <PageHead eyebrow="Field" title="My jobs" lede="Offers waiting on you, and work you have accepted." />
      <Panel>
        <EmptyState title="No offers right now" body="Job offers reach you when a file needs evidence in one of your coverage counties and you are certified for that service line. You will see the flat rate before you accept. Dispatch arrives in Phase 2." />
      </Panel>
    </>
  );
}
