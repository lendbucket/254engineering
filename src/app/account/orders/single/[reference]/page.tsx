import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentCustomer } from "@/lib/customer-auth";
import { accountOrderId, customerViewForOrder } from "@/lib/ops-customer";
import { Wordmark } from "@/components/brand/Wordmark";
import { OrderStatusBody } from "@/components/order/OrderStatusBody";

export const metadata: Metadata = {
  title: "Your order | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * ONE OF YOUR SINGLE ORDERS, OPENED BY YOUR ACCOUNT. Operator ruling,
 * 2026-10-10 (decision 6, defect 13 of the product audit).
 *
 * Your orders linked each single order to /order/<reference>, the page that
 * opens with the token from an email, and the link carried no token, so every
 * one opened on "this link does not open an order". This page reads the order
 * by the signed in account instead, in exactly the scope Your orders lists
 * (accountOrderId), and renders the same body the token page does
 * (OrderStatusBody), so the two are one account of one order.
 *
 * Somebody else's reference is a 404, never a 403: saying it is forbidden would
 * confirm it exists. A sealed letter is fetched through the account too, by
 * /api/account/order-document, which applies the same scope.
 */
export default async function AccountSingleOrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const me = await currentCustomer();
  if (!me) redirect("/account/login");

  const { reference } = await params;
  const orderId = await accountOrderId(me, decodeURIComponent(reference));
  if (!orderId) notFound();
  const view = await customerViewForOrder(orderId);
  if (!view) notFound();

  return (
    <div className="v10-phone-ground flex min-h-dvh flex-col bg-white">
      <header className="border-b border-[var(--color-limestone-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/account" prefetch={false} aria-label="254 Engineering, your account">
            <Wordmark height={84} cssHeight="clamp(58px, 9vw, 84px)" />
          </Link>
          <Link
            href="/account/orders"
            prefetch={false}
            className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--color-link)]"
          >
            Your orders
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[70ch] flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-[13px] text-[var(--color-ink-quiet)]">
          Order {view.reference}, {view.propertyAddress}
        </p>
        <h1 className="mt-2 text-[clamp(1.65rem,3vw,2rem)] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-ink)]">
          {view.serviceName}
        </h1>
        <p className="mt-2 text-[16px] leading-[1.7] text-[var(--color-ink-quiet)]">
          {view.propertyAddress}
          {view.city ? `, ${view.city}` : ""}, {view.county} County
        </p>
        <OrderStatusBody
          view={view}
          letterHref={(id) =>
            `/api/account/order-document?reference=${encodeURIComponent(view.reference)}&document=${encodeURIComponent(id)}`
          }
        />
      </main>
    </div>
  );
}
