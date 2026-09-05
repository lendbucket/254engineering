import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { TEXAS_COUNTIES } from "@/lib/ops-counties";
import { services } from "@/content/services";
import { CATALOG } from "@data/catalog";
import { isPrelaunch } from "@/lib/launch";
import { PageHead } from "@/components/portal/surfaces";
import { RestrictedMode } from "@/components/portal/design";
import { IntakeClient } from "./IntakeClient";

export const dynamic = "force-dynamic";

/**
 * New job: the telephone call path.
 *
 * WHY ONE LONG FORM AND NOT A WIZARD
 * ----------------------------------
 * Every field is on the screen at once, deliberately. The person filling this in
 * is on the telephone with a customer, and the moment to capture something is
 * while that customer is still talking. A wizard hides step four while somebody
 * volunteers the answer to it, and the operator either interrupts them or loses
 * it. The customer flow is stepped because a member of the public needs to be
 * led; an operator taking a call needs everything reachable.
 *
 * WHY THE PRICE IS COMPUTED IN THE BROWSER
 * ----------------------------------------
 * quoteFor, the catalog, twiaStatus and the intake rules are all pure and carry
 * no server-only import, so the screen calls the SAME functions the server calls
 * when it writes the file. The price cannot drift between what the operator
 * reads out on the call and what lands on the record, because there is only one
 * implementation of it.
 *
 * The server recomputes anyway and refuses a mismatch it did not authorise. This
 * is a live figure for a person, not an input the platform trusts.
 */
export default async function IntakePage() {
  const actor = await currentActor();
  /*
   * files.create, the same permission create_file uses. Taking a job IS opening
   * a file; the difference is how much is known at the time.
   *
   * notFound rather than a 403, which is the standing rule: a refusal that
   * confirms the route exists is a regression against what security-audit
   * enforces.
   */
  if (!actor || !can(actor, "files.create")) notFound();

  /*
   * The catalog, flattened to what the screen needs. Sent whole rather than
   * fetched per selection: it is small, static, and a round trip between
   * choosing a service and seeing its price is a silence on a telephone call.
   */
  const deliverables = CATALOG.map((entry) => ({
    serviceSlug: entry.serviceSlug,
    tier: entry.tier,
    name: entry.name,
    orderType: entry.orderType,
    priceCents: entry.priceCents,
    coastalSurchargeCents: entry.coastalSurchargeCents,
  }));

  const lines = services
    .filter((s) => deliverables.some((d) => d.serviceSlug === s.slug))
    .map((s) => ({ slug: s.slug, name: s.name }));

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="Work"
        title="New job"
        lede="Everything for a job taken by telephone, on one screen. The file, the price and the payment decision are recorded together."
      />

      {isPrelaunch() ? (
        <RestrictedMode
          also="A job can be taken, priced and dispatched. It cannot be charged for: no payment link and no invoice until registration is active. Open it unpaid and the file will say so."
        />
      ) : null}

      <IntakeClient
        lines={lines}
        deliverables={deliverables}
        counties={[...TEXAS_COUNTIES]}
        prelaunch={isPrelaunch()}
      />
    </div>
  );
}
