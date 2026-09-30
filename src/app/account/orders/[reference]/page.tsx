import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Wordmark } from "@/components/brand/Wordmark";
import { money } from "@/lib/ops-money";
import { CUSTOMER_STATUS } from "@/lib/ops-orders";
import { registrationLine } from "@/lib/launch";

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
    /* Restyled to V10, 2026-09-29. Shell and headings; the per property rows
     * keep their existing treatment, recorded in BACKLOG.md with the others. */
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/account" prefetch={false} aria-label="254 Engineering Services, your account">
            {/* v5's header rule as CSS. See the note on /account/login. */}
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" />
          </Link>
          <Link
            href="/account"
            prefetch={false}
            className="text-[14px] font-semibold text-[var(--color-link)]"
          >
            Your account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[820px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className="v10-label">{batch.reference}</p>
        <h1 className="mt-2.5 text-[clamp(1.65rem,3vw,2rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          {batch.accepted_count} propert{batch.accepted_count === 1 ? "y" : "ies"} submitted together
        </h1>

      <p className="mt-3 text-[1rem] leading-[1.7] text-[var(--secondary)]">
        {batch.status === "awaiting_payment"
          ? "Nothing has been charged yet. This is waiting for payment."
          : batch.status === "accepted"
            ? `Accepted${batch.paid_at ? " and paid" : " on account"}. Each property is now its own file and moves at its own pace.`
            : batch.status === "cancelled"
              ? "This submission was canceled. Nothing was charged."
              : "This submission is being prepared."}
      </p>

      {batch.total_cents !== null ? (
        <p className="mt-2 text-[1rem] font-semibold text-[var(--navy)]">
          Total {money(Number(batch.total_cents))}
        </p>
      ) : null}

      <h2 className="mt-8 portal-kicker text-[var(--gold-deep)]">
        The properties
      </h2>
      <ul className="mt-3 divide-y divide-limestone-line border-t border-[var(--border)]">
        {(orders ?? []).map((o) => (
          <li key={o.id as string} className="py-3">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-mono text-[13px] font-semibold text-[var(--navy)]">
                {o.reference as string}
              </span>
              <span className="text-[14px] text-[var(--navy)]">{o.property_address as string}</span>
              <span className="ml-auto text-[14px] text-[var(--secondary)]">
                {money(o.batch_share_cents === null ? null : Number(o.batch_share_cents))}
              </span>
            </div>
            <p className="mt-1 text-[14px] leading-[1.55] text-[var(--secondary)]">
              {CUSTOMER_STATUS[o.status as keyof typeof CUSTOMER_STATUS] ?? (o.status as string)}
            </p>
          </li>
        ))}
      </ul>

      {rejections.length > 0 ? (
        <>
          <h2 className="mt-8 portal-kicker text-[var(--gold-deep)]">
            Not taken, and not charged for
          </h2>
          <ul className="mt-3 space-y-2">
            {rejections.map((r) => (
              <li key={r.ref} className="rounded-[3px] bg-[var(--warn-bg)] px-3 py-2.5">
                <p className="font-mono text-[13px] font-semibold text-[var(--warn-ink)]">
                  {r.ref} {r.address}
                </p>
                <p className="mt-0.5 text-[14px] leading-[1.55] text-[var(--warn-ink)]">{r.reason}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

        <p className="mt-10 text-[14px] text-[var(--color-ink-quiet)]">
          <Link href="/account" className="text-[var(--color-link)] underline underline-offset-2">
            Back to your account
          </Link>
        </p>
      </main>

      <footer className="border-t border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-[var(--color-ink-quiet)] sm:px-6">
          {/* Derived from the board's own record. Never typed. */}
          <p>{registrationLine()}</p>
          <nav className="flex gap-5">
            <Link href="/terms" prefetch={false} className="text-[var(--color-link)]">
              Terms
            </Link>
            <Link href="/privacy" prefetch={false} className="text-[var(--color-link)]">
              Privacy
            </Link>
            <Link href="/contact" prefetch={false} className="text-[var(--color-link)]">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
