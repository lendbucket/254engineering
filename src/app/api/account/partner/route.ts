import { NextResponse } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { clientKey, takeCountedAttempt } from "@/lib/ops-rate-limit";
import { rooferApplicationForAccount, saveRooferProfileSection, signCertificateUpload } from "@/lib/ops-roofer-applications";
import { ROOFER_SECTIONS, type RooferSection } from "@/lib/roofer-application";
import { allCounties } from "@/content/regions";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * "FINISH YOUR PROFILE", THE ROOFING PARTNER'S OWN HALF. Robert's rework of
 * 2026-11-06, migration 0117.
 *
 * Signed in only, and only for the account's own partner profile: the account
 * is the principal's, never a value the browser sends.
 *
 *   save          one section (work, insurance, references), parsed with the
 *                 schema the form checks as it is typed, its done time stamped
 *                 in the same update.
 *   certificate   a signed upload URL for the insurance certificate, under
 *                 this application's own prefix, counted before anything is
 *                 signed (twelve an hour per connection).
 *
 * Nothing here decides anything: the profile can be filled in only while a
 * person has not yet approved or declined the account.
 */
const CERTIFICATE_SIGNS_PER_HOUR = 12;

async function handlePOST(request: Request) {
  const me = await currentCustomer();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  if (body.action === "save") {
    const section = body.section;
    if (typeof section !== "string" || !(ROOFER_SECTIONS as readonly string[]).includes(section)) {
      return NextResponse.json({ ok: false, error: "Choose a section to save." }, { status: 400 });
    }
    const saved = await saveRooferProfileSection(me.account.id, section as RooferSection, body.values, { counties: allCounties });
    if (!saved.ok) return NextResponse.json({ ok: false, error: saved.error, errors: saved.fields ?? {} }, { status: saved.fields ? 422 : 409 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "certificate") {
    const { filename, contentType, size } = body;
    if (typeof filename !== "string" || typeof contentType !== "string" || typeof size !== "number") {
      return NextResponse.json({ ok: false, error: "Missing upload details." }, { status: 400 });
    }
    const app = await rooferApplicationForAccount(me.account.id);
    if (!app.ok) return NextResponse.json({ ok: false, error: app.error }, { status: 503 });
    if (!app.row || app.row.status !== "received") {
      return NextResponse.json({ ok: false, error: "This account has no partner profile under review to attach a certificate to." }, { status: 409 });
    }
    const counted = await takeCountedAttempt(`roofer-certificate:ip:${clientKey(request.headers)}`, CERTIFICATE_SIGNS_PER_HOUR, 60 * 60);
    if (!counted.allowed) {
      return NextResponse.json({ ok: false, error: "Too many uploads were started from here in the last hour. Try again later, or email the certificate to the firm." }, { status: 429 });
    }
    const signed = await signCertificateUpload({ applicationId: app.row.id, filename, contentType, size });
    if (!signed.ok) return NextResponse.json({ ok: false, error: signed.error }, { status: 422 });
    return NextResponse.json({ ok: true, url: signed.url, path: signed.path });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}

export const POST = withSaveOutcome(handlePOST);
