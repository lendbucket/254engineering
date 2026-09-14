import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { supabaseAdmin } from "@/lib/supabase";
import { money } from "@/lib/ops-money";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { tradePricingBoard, tradePriceHistory } from "@/lib/trade-pricing";
import { TradePricingClient } from "./TradePricingClient";

export const dynamic = "force-dynamic";

/**
 * WHAT ONE ACCOUNT IS CHARGED, AND THE FLOOR IT MAY NOT CROSS.
 *
 * Phase 13 Section 2, under the accounts surface rather than beside it, because
 * a trade price belongs to an account the way its terms and its credit limit
 * do. A separate pricing section would be a second place to go looking for what
 * an account costs.
 *
 * THE SERVICES AWAITING A FLOOR ARE NAMED RATHER THAN HIDDEN.
 *
 * Operator's brief, and it is the decision this screen turns on. A deliverable
 * with no floor cannot be trade priced, and the tempting design is to omit it so
 * the screen shows only what works. That would make eleven pending floors look
 * like a platform with no trade pricing rather than a platform waiting on one
 * person's decisions, and the operator is that person.
 *
 * So they are listed, in their own panel, with the sentence explaining that a
 * floor is the operator's to rule. The screen tells them what it is waiting for.
 *
 * THE FLOOR IS SHOWN BEFORE ANYBODY TYPES.
 *
 * Not after they are refused. A refusal a person meets only after filling in a
 * form reads as the platform being broken, and the number they need was
 * knowable before they started.
 */
export default async function AccountPricingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "pricing.write")) redirect("/portal/accounts");

  const { id } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("id, status, client_id")
    .eq("id", id)
    .maybeSingle();
  if (!account) notFound();

  const { data: client } = await db
    .from("eng_clients")
    .select("name")
    .eq("id", account.client_id as string)
    .maybeSingle();

  const board = tradePricingBoard();
  const history = await tradePriceHistory(id);

  const inForce = new Map(
    history.filter((h) => h.supersededAt === null).map((h) => [`${h.serviceSlug}/${h.tier}`, h]),
  );

  const priceable = board.filter((b) => b.refusal === null);
  const awaiting = board.filter((b) => b.refusal !== null);

  return (
    <>
      <PageHead
        eyebrow="Money"
        title={`Trade pricing: ${(client?.name as string) ?? "this account"}`}
        lede="What this account is charged, per deliverable. A price may never be set below the floor, and a deliverable with no floor cannot be priced at all."
      />

      <p className="mb-4 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
        <Link href="/portal/accounts" className="underline underline-offset-2">
          Back to accounts
        </Link>
      </p>

      {priceable.length === 0 ? (
        <EmptyState
          title="Nothing can be trade priced yet"
          body="Every deliverable is waiting on a floor, and a floor is the operator's decision about money. Until one is ruled, no trade price can be set on anything. The full list is below."
        />
      ) : (
        <Panel
          title="Priced by agreement"
          description="The floor is shown before you type. A price at the floor is allowed; below it is refused, at every role."
        >
          <TradePricingClient
            accountId={id}
            rows={priceable.map((b) => ({
              serviceSlug: b.serviceSlug,
              tier: b.tier,
              name: b.name,
              catalogueCents: b.catalogueCents,
              floorCents: b.floor && b.floor.state === "set" ? b.floor.floorCents : null,
              floorBecause: b.floor && b.floor.state === "set" ? b.floor.because : "",
              floorBy: b.floor && b.floor.state === "set" ? b.floor.by : "",
              floorOn: b.floor && b.floor.state === "set" ? b.floor.on : "",
              current: inForce.get(`${b.serviceSlug}/${b.tier}`)
                ? {
                    priceCents: inForce.get(`${b.serviceSlug}/${b.tier}`)!.priceCents,
                    setByEmail: inForce.get(`${b.serviceSlug}/${b.tier}`)!.setByEmail,
                    createdAt: inForce.get(`${b.serviceSlug}/${b.tier}`)!.createdAt,
                  }
                : null,
            }))}
          />
        </Panel>
      )}

      {awaiting.length > 0 ? (
        <div className="mt-4">
          <Panel
            title={`Awaiting a floor (${awaiting.length})`}
            description="These cannot be trade priced until the operator rules a floor for each. That is a decision about money and the platform will not derive one."
            /*
              AND WHERE, WHICH THE FIRST VERSION DID NOT SAY.
              Reading the screenshot: ten deliverables named as waiting on the
              operator, and nothing telling them where a floor is ruled. It is a
              FILE, deliberately, so that a floor is a considered edit rather
              than a number typed into a form at the end of a call. A screen
              that names what it is waiting for and not where it is given is a
              screen that reads as broken.
            */
          >
            <p className="mb-3 text-[13px] leading-[1.6] text-[var(--secondary)]">
              A floor is ruled in <code className="font-mono">src/config/trade-floors.ts</code>, which is a
              file rather than a form on purpose: it is a decision worth making deliberately, with the
              reason written beside it, rather than a number typed in at the end of a call.
            </p>
            <ul className="divide-y divide-[var(--border)]">
              {awaiting.map((b) => (
                <li key={`${b.serviceSlug}/${b.tier}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[14px] font-semibold text-[var(--navy)]">{b.name}</span>
                    <span className="text-[13px] text-[var(--secondary)]">
                      {b.catalogueCents === null ? "Quoted, no published price" : `Published ${money(b.catalogueCents)}`}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
                    {b.serviceSlug}/{b.tier}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-4">
          <Panel
            title="Every price this account has ever had"
            description="A trade price is superseded, never edited, so the price an order was quoted under is always recoverable."
          >
            <ul className="divide-y divide-[var(--border)]">
              {history.map((h) => (
                <li key={h.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[14px] font-semibold text-[var(--navy)]">
                      {h.serviceSlug}/{h.tier}
                    </span>
                    <span className="text-[14px] font-semibold text-[var(--navy)]">
                      {money(h.priceCents)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
                    Set by {h.setByEmail} on {new Date(h.createdAt).toISOString().slice(0, 10)}, against a
                    floor of {money(h.floorCentsAtTime)}.{" "}
                    {h.supersededAt
                      ? `Superseded ${new Date(h.supersededAt).toISOString().slice(0, 10)}.`
                      : "In force."}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </>
  );
}
