import { NextResponse, type NextRequest } from "next/server";
import { currentPartner } from "@/lib/partner-auth";
import { requestContext } from "@/lib/ops-auth";
import { MAX_LOGO_BYTES, uploadPartnerLogo } from "@/lib/partner-branding";

/*
 * A partner uploads its logo (run item 19, migration 0072). The partner is the
 * session's, never the request's; the file is judged by its bytes in
 * partner-branding.ts; it goes to the operator as pending and shows nowhere
 * until approved.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const principal = await currentPartner();
  if (!principal) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose an image to upload." }, { status: 400 });
  /* Refused before it is read into memory, so a large file costs nothing. */
  if (file.size > MAX_LOGO_BYTES) return NextResponse.json({ ok: false, error: "A logo can be up to one megabyte." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { ip, userAgent } = await requestContext();
  const result = await uploadPartnerLogo(principal, bytes, { ip, userAgent });
  return result.ok
    ? NextResponse.json({ ok: true, note: "Uploaded. It shows on your order page once the firm approves it." })
    : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}
