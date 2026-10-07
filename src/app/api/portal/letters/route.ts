import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { draftForDetermination, sealLetter } from "@/lib/letter-seal";

export const dynamic = "force-dynamic";

/**
 * THE ENGINEER'S LETTER: READ THE DRAFT, THEN SEAL IT. POST ONLY.
 *
 * Sealing piece two, docs/sealing-controls.md. Two actions, both his alone:
 *
 *   draft  returns the drafted lines for him to read. Reads no seal image.
 *   seal   applies his seal with a fresh code from his authenticator.
 *
 * The licence is checked here so a refusal is a status code before any work,
 * and checked again in src/lib/letter-seal.ts against the determination's own
 * engineer, and again by the database in 0063. There is no GET: nothing here
 * serves a document, and the customer's copy is served by its own route, which
 * re-hashes it on every read.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!holdsLicence(actor, "documents.seal")) {
    return bad("Only the engineer of record drafts and seals a letter. No other role can stand in for him.", 403);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Send the request as JSON.");
  const determinationId = typeof body.determinationId === "string" ? body.determinationId : "";
  if (!determinationId) return bad("Name the determination whose letter this is.");
  const entered = {
    recipientAddress: typeof body.recipientAddress === "string" ? body.recipientAddress : "",
    recipientSalutation: typeof body.recipientSalutation === "string" ? body.recipientSalutation : "",
  };

  if (body.action === "draft") {
    const draft = await draftForDetermination(actor, determinationId, entered);
    return draft.ok
      ? NextResponse.json({ ok: true, lines: draft.lines, determination: draft.determination })
      : NextResponse.json({ ok: false, error: draft.why, missing: draft.missing }, { status: 400 });
  }

  if (body.action === "seal") {
    const sealed = await sealLetter(actor, {
      determinationId,
      code: typeof body.code === "string" ? body.code : "",
      ...entered,
      context: {
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: request.headers.get("user-agent"),
      },
    });
    return sealed.ok
      ? NextResponse.json({
          ok: true,
          documentId: sealed.documentId,
          sha256: sealed.sha256,
          delivered: sealed.delivered,
          warning: sealed.warning,
        })
      : bad(sealed.error);
  }

  return bad("The action is draft or seal.");
}
