import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Wordmark } from "@/components/brand/Wordmark";
import { money } from "@/lib/ops-money";
import { CUSTOMER_STATUS } from "@/lib/ops-orders";

export const dynamic = "force-dynamic";

/**
 * One bulk submission, as the customer sees it.
 *
 * SCOPED TO THEIR OWN ACCOUNT, IN THE QUERY
 * -----------------------------------------
 * The account id goes into the where clause rather than being checked after the
 * row is loaded. Filtering after the fact has already fetched the row it is
 * about to hide, and the difference between the two shows up the first time
 * somebody logs the result or returns it in an error.
 *
 * A batch belonging to another account is a 404, not a 403. Telling somebody a
 * reference exists but is not theirs is telling them a reference exists.
 */
export default async function BatchPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  const { reference } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: batch } = await db
    .from("eng_order_batches")
    .select("id, reference, status, service_slug, submitted_count, accepted_count, rejected_count, total_cents, rejections, created_at, paid_at")
    .eq("reference", reference)
    .eq("account_id", me.accountId)
    .maybeSingle();

  if (!batch) notFound();

  const { data: orders } = await db
    .from("eng_service_orders")
    .select("id, reference, property_address, county, status, batch_share_cents")
    .eq("batch_id", batch.id)
    .order("created_at", { ascending: true });

  const rejections = (batch.rejections ?? []) as { ref: string; address: string; reason: string }[];

  return (
    <main className="mx-auto max-w-[820px] px-4 py-10">
      <div className="mb-6">
        <Wordmark height={36} />
      </div>

      <p className="font-mono text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
        {batch.reference}
      </p>
      <h1 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-[1.2] font-semibold text-slate">
        {batch.accepted_count} propert{batch.accepted_count === 1 ? "y" : "ies"} submitted together
      </h1>

      <p className="mt-3 text-[1rem] leading-[1.7] text-slate-muted">
        {batch.status === "awaiting_payment"
          ? "Nothing has been charged yet. This is waiting for payment."
          : batch.status === "accepted"
            ? `Accepted${batch.paid_at ? " and paid" : " on account"}. Each property is now its own file and moves at its own pace.`
            : batch.status === "cancelled"
              ? "This submission was cancelled. Nothing was charged."
              : "This submission is being prepared."}
      </p>

      {batch.total_cents !== null ? (
        <p className="mt-2 text-[1rem] font-semibold text-slate">
          Total {money(Number(batch.total_cents))}
        </p>
      ) : null}

      <h2 className="mt-8 text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">
        The properties
      </h2>
      <ul className="mt-3 divide-y divide-limestone-line border-t border-limestone-line">
        {(orders ?? []).map((o) => (
          <li key={o.id as string} className="py-3">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-mono text-[12.5px] font-semibold text-slate">
                {o.reference as string}
              </span>
              <span className="text-[13.5px] text-slate">{o.property_address as string}</span>
              <span className="ml-auto text-[13.5px] text-slate-muted">
                {o.batch_share_cents === null ? "" : money(Number(o.batch_share_cents))}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-[1.55] text-slate-muted">
              {CUSTOMER_STATUS[o.status as keyof typeof CUSTOMER_STATUS] ?? (o.status as string)}
            </p>
          </li>
        ))}
      </ul>

      {rejections.length > 0 ? (
        <>
          <h2 className="mt-8 text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">
            Not taken, and not charged for
          </h2>
          <ul className="mt-3 space-y-2">
            {rejections.map((r) => (
              <li key={r.ref} className="rounded-[3px] bg-[#fdf3e0] px-3 py-2.5">
                <p className="font-mono text-[12.5px] font-semibold text-[#7a4c05]">
                  {r.ref} {r.address}
                </p>
                <p className="mt-0.5 text-[13px] leading-[1.55] text-[#7a4c05]">{r.reason}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-8 text-[13.5px] text-slate-muted">
        <Link href="/account" className="underline underline-offset-2">
          Back to your account
        </Link>
      </p>
    </main>
  );
}
