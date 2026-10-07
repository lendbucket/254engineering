import { NextResponse, type NextRequest } from "next/server";
import { orderForCustomerToken } from "@/lib/ops-intake";
import { customerLetterFor } from "@/lib/letter-delivery";

export const dynamic = "force-dynamic";

/**
 * ===========================================================================
 * THE CUSTOMER'S SEALED LETTER. PUBLIC, AND THE TOKEN IS THE WHOLE AUTHORITY.
 * ===========================================================================
 *
 * The first public, token-gated API route on this platform (BACKLOG.md, "the
 * nine row checklist has no row for a public token-gated API route"). It
 * carries its own pair of assertions in security-audit, a missing token and a
 * wrong one, which is what that entry asks of it.
 *
 * WHAT IT SERVES AND NOTHING ELSE. A document is served only when:
 *   - the token opens an order (signed, unexpired, unrevoked);
 *   - the document is on THAT order's file, so one customer's link cannot be
 *     pointed at another customer's letter by changing an id;
 *   - it is sealed, visible to the client, and its seal is not void;
 *   - its bytes still hash to what was sealed (control 7).
 *
 * Every refusal is the same 404 with the same sentence, so the route cannot be
 * used to learn which of those failed for somebody else's document.
 */

const NOT_HERE =
  "This link does not open a sealed letter. If you were sent it by the firm, use the link in your most recent email, or reply to that email.";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const documentId = request.nextUrl.searchParams.get("document") ?? "";
  if (!token || !documentId) return new NextResponse(NOT_HERE, { status: 404, headers: { "Cache-Control": "no-store" } });

  const access = await orderForCustomerToken(token);
  if (!access?.orderId) return new NextResponse(NOT_HERE, { status: 404, headers: { "Cache-Control": "no-store" } });

  const letter = await customerLetterFor(access.orderId, documentId);
  if (!letter.ok) return new NextResponse(NOT_HERE, { status: 404, headers: { "Cache-Control": "no-store" } });

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
