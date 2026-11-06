import { NextResponse } from "next/server";
import { clientKey, takeCountedAttempt } from "@/lib/ops-rate-limit";
import { signCertificateUpload } from "@/lib/ops-roofer-applications";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * A SIGNED UPLOAD URL FOR ONE ROOFER'S INSURANCE CERTIFICATE.
 *
 * The browser PUTs the file straight to private storage, as the careers
 * uploads do, so a ten megabyte PDF never rides through a function. The key
 * is this application's own prefix with a random segment and upsert off, so
 * nothing is overwritten and the application route can refuse a key that is
 * not its own.
 *
 * COUNTED BEFORE ANYTHING IS SIGNED, on the counted limiter Q11 built: twelve
 * an hour per connection, enough for a roofer who retries on poor signal and
 * nowhere near enough to fill the bucket.
 */
const CERTIFICATE_SIGNS_PER_HOUR = 12;

async function handlePOST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }
  const { applicationId, filename, contentType, size } = (body ?? {}) as Record<string, unknown>;
  if (typeof applicationId !== "string" || typeof filename !== "string" || typeof contentType !== "string" || typeof size !== "number") {
    return NextResponse.json({ ok: false, error: "Missing upload details." }, { status: 400 });
  }

  const counted = await takeCountedAttempt(`roofer-certificate:ip:${clientKey(request.headers)}`, CERTIFICATE_SIGNS_PER_HOUR, 60 * 60);
  if (!counted.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many uploads were started from here in the last hour. Send the application without it, or email the certificate to the firm." },
      { status: 429 },
    );
  }

  const signed = await signCertificateUpload({ applicationId, filename, contentType, size });
  if (!signed.ok) return NextResponse.json({ ok: false, error: signed.error }, { status: 422 });
  return NextResponse.json({ ok: true, url: signed.url, path: signed.path });
}

export const POST = withSaveOutcome(handlePOST);
