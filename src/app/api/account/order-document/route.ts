import { NextResponse, type NextRequest } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { accountOrderId } from "@/lib/ops-customer";
import { customerLetterFor } from "@/lib/letter-delivery";

export const dynamic = "force-dynamic";

/*
 * A SEALED LETTER, FETCHED BY THE SIGNED IN ACCOUNT. Operator ruling,
 * 2026-10-10 (decision 6). /api/order-document serves a letter through an
 * order's token; this serves the same letter, through the same
 * customerLetterFor and its checks (sealed, on this order's own file, with a
 * live seal, still hashing to what was sealed), to the account that owns the
 * order in Your orders' own scope. Not signed in, not yours, or not a letter:
 * all one 404 with one sentence, so nothing is confirmed about an order that is
 * not the caller's.
 */
const NOT_HERE = "This does not open a sealed letter on your account. Open the order from Your orders and try again.";

export async function GET(request: NextRequest) {
  const missing = () => new NextResponse(NOT_HERE, { status: 404, headers: { "Cache-Control": "no-store" } });
  const me = await currentCustomer();
  if (!me) return missing();
  const reference = request.nextUrl.searchParams.get("reference") ?? "";
  const documentId = request.nextUrl.searchParams.get("document") ?? "";
  if (!reference || !documentId) return missing();

  const orderId = await accountOrderId(me, reference);
  if (!orderId) return missing();

  const letter = await customerLetterFor(orderId, documentId);
  if (!letter.ok) return missing();

  return new NextResponse(Buffer.from(letter.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${letter.filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
