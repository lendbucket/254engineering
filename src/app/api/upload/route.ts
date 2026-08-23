import { NextResponse } from "next/server";
import { createSignedUpload } from "@/lib/uploads";

/**
 * Hands out a signed upload URL for one document on one application.
 *
 * It never receives the file. The applicant's browser PUTs the bytes straight to
 * storage, which is what keeps a ten megabyte body off a serverless function and
 * keeps the upload alive on a phone with poor signal. See src/lib/uploads.ts.
 *
 * WHAT THIS ROUTE DELIBERATELY DOES NOT DO
 * ----------------------------------------
 * It does not authenticate, because there is nobody to authenticate: an
 * applicant has no account and creating one to attach a resume would lose more
 * applications than it protects. What bounds the damage instead is that the
 * signed URL is scoped to a single path derived server side from an id the
 * client cannot use to reach anything else, the bucket is private so nothing
 * uploaded is readable without a separate signed download, and the bucket
 * enforces its own size and MIME limits.
 *
 * The residual risk is somebody spending their own bandwidth writing junk into a
 * private bucket under a random UUID that no row will ever reference. That is
 * worth accepting to keep the form completable by the person it is for.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const { applicationId, kind, filename, contentType, size } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof applicationId !== "string" ||
    typeof kind !== "string" ||
    typeof filename !== "string" ||
    typeof contentType !== "string" ||
    typeof size !== "number"
  ) {
    return NextResponse.json({ ok: false, error: "Missing upload details." }, { status: 400 });
  }

  const result = await createSignedUpload({
    applicationId,
    kind: kind as never,
    filename,
    contentType,
    size,
  });

  if (!result.ok) {
    // 422 rather than 500: these are all decisions about the request, and the
    // message is written to be shown to the applicant as it stands.
    console.error(`[upload] refused kind=${kind} reason=${JSON.stringify(result.error)}`);
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, url: result.url, path: result.path });
}
