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
    /*
     * A superseded account takes no new price. Its existing prices stay
     * readable, because they are the record of what somebody was charged; what
     * it cannot do is acquire another.
     */
    .is("superseded_at", null)
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

  /*
   * THREE GROUPS RATHER THAN TWO, SINCE 2026-09-20.
   *
   * A refused deliverable used to mean one thing, so one panel headed "Awaiting
   * a floor" was honest. It now means two: a floor nobody has ruled yet, and a
   * deliverable that is not sold at a fixed price and is owed no floor at all.
   *
   * Folding the second into the first would put three design deliverables under
   * a heading saying they are waiting on the operator, which is the exact
   * sentence the new state was added to stop anybody writing. Somebody reading
   * that list would go looking for a ruling that has already been made.
   */
  const awaiting = board.filter((b) => b.refusal !== null && b.floor?.state === "pending");
  const noFloorOwed = board.filter((b) => b.refusal !== null && b.floor?.state === "minimum-engagement");

  /*
   * AND ANYTHING REFUSED FOR A REASON THAT IS NEITHER. A deliverable the
   * register has never heard of, or one whose refund terms cannot be stated,
   * is a DRIFT rather than a pricing state, and it must not disappear between
   * two filters that do not cover it. It gets its own group saying so.
   */
  const refusedForDrift = board.filter(
    (b) => b.refusal !== null && b.floor?.state !== "pending" && b.floor?.state !== "minimum-engagement",
  );

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
          body="No deliverable currently carries a floor it can be priced against. A floor is the operator's decision about money, and some deliverables are owed no floor at all because they are not sold at a fixed price. The full list, grouped by which of those it is, is below."
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
                  <p className="mt-1 font-mono text-[12px] leading-[1.55] text-[var(--secondary)]">
                    {b.serviceSlug}/{b.tier}
                  </p>
                  {/*
                    AND WHY IT IS HELD, WHICH THE FIRST VERSION DID NOT SHOW.
                    Every entry carried the same sentence while nothing was
                    ruled, so there was nothing to show. Two are now held for a
                    stated reason computed from the price and the cost, and a
                    list that names them without it sends the reader to the file
                    to find out something the screen already knows.
                  */}
                  {b.refusal ? (
                    <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">{b.refusal}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      {noFloorOwed.length > 0 ? (
        <div className="mt-4">
          <Panel
            title={`Not sold at a fixed price (${noFloorOwed.length})`}
            description="No floor is owed on these and none is coming. They are quoted from an estimate of the hours, and the minimum engagement is the protection rather than a floor."
          >
            <ul className="divide-y divide-[var(--border)]">
              {noFloorOwed.map((b) => (
                <li key={`${b.serviceSlug}/${b.tier}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[14px] font-semibold text-[var(--navy)]">{b.name}</span>
                    <span className="text-[13px] text-[var(--secondary)]">Quoted from hours</span>
                  </div>
                  <p className="mt-1 font-mono text-[12px] leading-[1.55] text-[var(--secondary)]">
                    {b.serviceSlug}/{b.tier}
                  </p>
                  {b.refusal ? (
                    <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">{b.refusal}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      {refusedForDrift.length > 0 ? (
        <div className="mt-4">
          <Panel
            title={`Refused for a reason that is not a floor (${refusedForDrift.length})`}
            description="These are refused by something other than the floor register, which is a drift rather than a pricing state. The board fails on it."
          >
            <ul className="divide-y divide-[var(--border)]">
              {refusedForDrift.map((b) => (
                <li key={`${b.serviceSlug}/${b.tier}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[14px] font-semibold text-[var(--navy)]">{b.name}</span>
                  </div>
                  <p className="mt-1 font-mono text-[12px] leading-[1.55] text-[var(--secondary)]">
                    {b.serviceSlug}/{b.tier}
                  </p>
                  {b.refusal ? (
                    <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">{b.refusal}</p>
                  ) : null}
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
