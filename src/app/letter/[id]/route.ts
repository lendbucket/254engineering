import { NextResponse, type NextRequest } from "next/server";
import { letterForLink } from "@/lib/letter-links";
import { customerLetterFor } from "@/lib/letter-delivery";
import { withSaveOutcome } from "@/lib/save-outcome";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * A COPY CONTACT'S SEALED LETTER, AND NOTHING ELSE OF THE ORDER. The Killeen
 * call, item 7, with Robert's answer 3 of 2026-11-14 (table eng_letter_links,
 * 0133).
 *
 * The email links to /letter/<id>?token=...; the proxy exchanges the token for
 * a cookie scoped to this one letter and redirects without it, then rewrites
 * each visit with the token from the cookie (planLinkRequest, link-cookie.ts),
 * so the token never stays in the address. This route resolves the link to one
 * order and one document (letterForLink) and serves the bytes through
 * customerLetterFor, the customer's own download check: a voided seal or a
 * letter that is not this order's is refused here exactly as it is there.
 *
 * It serves a PDF and nothing else. No order page, no amount, no timeline, no
 * upload. Every refusal reads the same and names nothing.
 */
const NOT_HERE =
  "This link does not open a sealed letter. If the firm sent it to you, use the link in the most recent email, or reply to that email.";

async function handleGET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const refuse = () => new NextResponse(NOT_HERE, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!id || !token) return refuse();
  const link = await letterForLink(id, token);
  if (!link) return refuse();

  /* The contact's role, for the audit row only: the trail never records a lender's download as the customer's. */
  const db = supabaseAdmin();
  const { data: contact } = db ? await db.from("eng_file_contacts").select("role").eq("id", link.contactId).maybeSingle() : { data: null };
  const letter = await customerLetterFor(link.orderId, link.documentId, { kind: "copy", role: (contact?.role as string | undefined) ?? "contact" });
  if (!letter.ok) return refuse();

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

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const GET = withSaveOutcome(handleGET);
