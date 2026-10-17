import { NextResponse } from "next/server";
import { REVIEW_LINK } from "@/config/review-request";

/*
 * /review: the link a review request email carries (run item 25, 2026-10-10).
 *
 * The email links here rather than straight to Google for two reasons. Every
 * link in this firm's email points at its own domain, which email-audit
 * enforces, and an email already sent keeps working if the Business Profile URL
 * ever changes, because only this file moves. While REVIEW_LINK is empty this
 * answers 404, and no request is sent anyway (review-request.ts refuses).
 */
export const dynamic = "force-dynamic";

export function GET() {
  if (!REVIEW_LINK) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(REVIEW_LINK, 307);
}
