import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, ALL_ACTIONS } from "@/lib/ops-authz";
import { rolesView, licensedCapabilities } from "@/lib/ops-roles";
import { PageHead } from "@/components/portal/surfaces";
import { RolesClient } from "./RolesClient";

export const dynamic = "force-dynamic";

/**
 * Who may do what, and who is who.
 *
 * Phase 10 Section 2. A buyer of this business needs to see that access is
 * governed rather than assumed, and the operator needs to hire a coordinator
 * without giving them the keys to the money.
 *
 * WHY THE LICENSED CAPABILITIES ARE ON THIS SCREEN WITH NO CHECKBOX
 * -----------------------------------------------------------------
 * Operator ruling. Sealing, the review decisions and protocol authoring are not
 * grantable and cannot be represented as grants, so the easy thing would be to
 * leave them off entirely. That would be wrong: somebody looking for sealing
 * would find an absence, and an absence looks like an oversight somebody should
 * fix by adding a checkbox.
 *
 * So they are shown, named, and explained, with nothing to toggle.
 */
export default async function RolesPage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "roles.manage")) notFound();

  const roles = await rolesView();

  /*
   * Grouped by their module prefix, which is how somebody reads a matrix of
   * forty one things. The prefix is already the grouping the action names use.
   */
  const groups = new Map<string, string[]>();
  for (const action of ALL_ACTIONS) {
    const group = action.split(".")[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(action);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="The firm"
        title="Roles and permissions"
        lede="What each role may do, who holds it, and what no role can be given. Every change here is recorded with who made it and when."
      />

      <RolesClient
        roles={roles}
        groups={[...groups.entries()].map(([name, actions]) => ({ name, actions }))}
        licensed={licensedCapabilities()}
        selfId={actor.id}
      />
    </div>
  );
}
