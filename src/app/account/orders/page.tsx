import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentCustomer } from "@/lib/customer-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Wordmark } from "@/components/brand/Wordmark";
import { money, isKnown } from "@/lib/ops-money";
import { CUSTOMER_STATUS, type OrderStatus } from "@/lib/ops-orders";
import { registrationLine } from "@/lib/launch";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your orders | 254 Engineering Services",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * EVERYTHING THIS ACCOUNT HAS ORDERED, WHICH DID NOT EXIST UNTIL 2026-10-01.
 *
 * The operator found it by opening the account home and looking: there was no
 * list of orders and no link to one. `/account/orders/[reference]` had existed
 * since the bulk work, so a customer could read ONE order if they already held
 * its reference, and had no way to find the reference. The screen that answers
 * "what have I bought from you" was the one screen missing.
 *
 * TWO KINDS OF THING, ONE LIST. A bulk submission is a batch of properties with
 * one payment, and a single order is one property. They are different tables and
 * they are the same question to the person asking, so they are interleaved by
 * date rather than split into two sections somebody has to read twice.
 *
 * SCOPED IN THE QUERY, NEVER AFTER THE READ, which is the rule the batch screen
 * beside this one already states: filtering after the fact has already fetched
 * the row it is about to hide, and the difference shows up the first time
 * somebody logs the result or puts it in an error.
 *
 * ========================================================================
 * THE EMAIL MATCH, WHICH IS THE ONLY SUBTLE THING ON THIS SCREEN.
 * ========================================================================
 *
 * Operator ruling, 2026-09-30, reversing his own earlier clause: orders placed
 * before the account existed ARE shown, matched on the email address, and each
 * carries one plain line of metadata saying so.
 *
 * It is two queries rather than one `or`, and that is deliberate. The email
 * matched set is restricted to orders with NO account at all. An order carrying
 * another account's id and this person's email address is somebody else's
 * purchase: a landlord who bought an inspection and gave their tenant's address
 * as the contact. Matching on email alone would show one customer another
 * customer's order, which is the worst defect this screen could have, and an
 * `or` across both conditions in one filter is one missing parenthesis away
 * from exactly that. Two queries cannot make that mistake.
 *
 * AND A BATCH IS NOT EMAIL MATCHED. A batch is created by an account, so there
 * is no pre account batch to find. Only single orders have an anonymous past.
 */
export default async function OrdersPage() {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  const db = supabaseAdmin();

  /*
   * An unconfigured deployment can render the shell and say so. It cannot
   * pretend the account has no orders, which is what an empty list would say.
   */
  if (!db) {
    return (
      <Shell>
        <p className="mt-7 border-t border-[var(--color-limestone-line)] pt-6 text-[16px] leading-[1.6] font-semibold text-[var(--color-ink)]">
          Your orders cannot be read on this deployment yet.
        </p>
      </Shell>
    );
  }

  const [batchRead, ownedRead, matchedRead] = await Promise.all([
    db
      .from("eng_order_batches")
      .select("reference, status, service_slug, submitted_count, accepted_count, total_cents, created_at")
      .eq("account_id", me.accountId)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("eng_service_orders")
      .select("reference, status, service_slug, property_address, total_cents, created_at")
      .eq("account_id", me.accountId)
      .is("batch_id", null)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("eng_service_orders")
      .select("reference, status, service_slug, property_address, total_cents, created_at")
      .eq("customer_email", me.email.toLowerCase())
      .is("account_id", null)
      .is("batch_id", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  type Row = {
    reference: string;
    kind: "batch" | "order";
    what: string;
    status: string;
    totalCents: number | null;
    createdAt: string;
    href: string;
    beforeSignIn: boolean;
  };

  const words = (status: string) => CUSTOMER_STATUS[status as OrderStatus] ?? status.replace(/_/g, " ");

  const rows: Row[] = [
    ...(batchRead.data ?? []).map((b) => ({
      reference: b.reference as string,
      kind: "batch" as const,
      what: `${b.submitted_count ?? 0} properties, ${(b.service_slug as string).replace(/-/g, " ")}`,
      status: words(b.status as string),
      totalCents: b.total_cents === null ? null : Number(b.total_cents),
      createdAt: b.created_at as string,
      href: `/account/orders/${encodeURIComponent(b.reference as string)}`,
      beforeSignIn: false,
    })),
    ...(ownedRead.data ?? []).map((o) => ({
      reference: o.reference as string,
      kind: "order" as const,
      what: (o.property_address as string) || (o.service_slug as string).replace(/-/g, " "),
      status: words(o.status as string),
      totalCents: o.total_cents === null ? null : Number(o.total_cents),
      createdAt: o.created_at as string,
      href: `/order/${encodeURIComponent(o.reference as string)}`,
      beforeSignIn: false,
    })),
    ...(matchedRead.data ?? []).map((o) => ({
      reference: o.reference as string,
      kind: "order" as const,
      what: (o.property_address as string) || (o.service_slug as string).replace(/-/g, " "),
      status: words(o.status as string),
      totalCents: o.total_cents === null ? null : Number(o.total_cents),
      createdAt: o.created_at as string,
      href: `/order/${encodeURIComponent(o.reference as string)}`,
      beforeSignIn: true,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const failed = batchRead.error || ownedRead.error || matchedRead.error;

  return (
    <Shell>
      {/*
        A FAILED READ IS NOT AN EMPTY LIST, and saying so is the point. "You have
        not ordered anything yet" over a query that errored is a false statement
        about somebody's own purchases, and it is the kind a person acts on by
        ringing to ask where their order went.
      */}
      {failed ? (
        <p className="mt-7 border-t border-[var(--color-limestone-line)] pt-6 text-[16px] leading-[1.6] font-semibold text-[var(--color-ink)]">
          Some of your orders could not be read just now. What is below may be
          incomplete. Nothing is wrong with your account.
        </p>
      ) : null}

      {rows.length === 0 && !failed ? (
        <p className="mt-7 border-t border-[var(--color-limestone-line)] pt-6 text-[16px] leading-[1.6] text-[var(--color-ink-quiet)]">
          Nothing yet. When you place an order it appears here, with what it is
          for and where it has got to.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-7 overflow-x-auto">
          {/*
            V10: no header fill, ruled rows, status in words, no colour. The
            operator's ruling of 2026-09-30 makes the no colour rule firm wide,
            so a stage is a sentence rather than a dot somebody has to decode.
          */}
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[var(--color-ink)]">
                <th className="py-2.5 pr-4 text-[13px] font-semibold text-[var(--color-ink)]">
                  Reference
                </th>
                <th className="py-2.5 pr-4 text-[13px] font-semibold text-[var(--color-ink)]">
                  What
                </th>
                <th className="py-2.5 pr-4 text-[13px] font-semibold text-[var(--color-ink)]">
                  Where it has got to
                </th>
                <th className="py-2.5 text-right text-[13px] font-semibold text-[var(--color-ink)]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.reference}`} className="border-b border-[var(--color-limestone-line)]">
                  <td className="py-3.5 pr-4 align-top">
                    <Link
                      href={row.href}
                      prefetch={false}
                      className="text-[14px] font-semibold text-[var(--color-link)]"
                    >
                      {row.reference}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-[var(--color-ink-quiet)]">
                      {(formatInFirmZone(row.createdAt, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }) ?? "")}
                    </p>
                  </td>
                  <td className="py-3.5 pr-4 align-top text-[14px] leading-[1.5] text-[var(--color-ink)]">
                    {row.what}
                    {/*
                      THE ONE PLAIN LINE, exactly as ruled: no badge, no colour.
                      It is here rather than in its own column because a column
                      that is empty on most rows is a column that reads as
                      missing data.
                    */}
                    {row.beforeSignIn ? (
                      <p className="mt-1 text-[13px] leading-[1.5] text-[var(--color-ink-quiet)]">
                        Placed with your email address before you signed in.
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3.5 pr-4 align-top text-[14px] leading-[1.5] text-[var(--color-ink)]">
                    {row.status}
                  </td>
                  <td className="py-3.5 align-top text-right text-[14px] tabular-nums text-[var(--color-ink)]">
                    {/*
                      ABSENT IS NOT ZERO. A quote has no price yet, and printing
                      $0.00 there would tell somebody their engineering work is
                      free. This repository has recorded that confusion more than
                      once, which is why isKnown exists.
                    */}
                    {isKnown(row.totalCents) ? money(row.totalCents) : "Not priced yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="v10-phone-ground flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/account" prefetch={false} aria-label="254 Engineering Services, your account">
            {/* v5's header rule as CSS. See the note on /account/login. */}
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" priority />
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

      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div>
          <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.4px] text-[var(--color-ink)]">
            Your orders
          </h1>
          <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
            Everything this account has ordered, newest first. A bulk submission
            shows as one line.
          </p>
        </div>
        <div>{children}</div>
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
