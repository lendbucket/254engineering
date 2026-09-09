import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";
import { normaliseEmail, voidOperatorEntry, suppress } from "@/lib/marketing-suppression";

export const dynamic = "force-dynamic";

/**
 * RECORDING A REQUEST TO STOP, AND UNDOING ONE THAT WAS MISTYPED.
 *
 * Two verbs and they are not opposites, which is the whole shape of this file.
 *
 * POST records that somebody asked to stop hearing from the firm. It arrives by
 * telephone, or in a reply to a person rather than to the unsubscribe link, and
 * before this screen existed there was no way to record it that did not involve
 * somebody writing SQL against production.
 *
 * DELETE removes a row an operator typed WRONG. It is not a resubscribe.
 * `removeOperatorEntry` refuses any row carrying a token hash against the row
 * itself, because a token hash means a person clicked the unsubscribe link in
 * their own email, and deleting that would be this platform asserting a consent
 * nobody gave. The refusal is in the library rather than here, so a second
 * caller cannot get it wrong.
 *
 * BOTH ARE AUDITED, AND THE AUDIT IS WHY THE DELETE IS SAFE TO OFFER AT ALL.
 * The one real risk of a remove is somebody quietly taking a person off the
 * list who did ask. The audit row names the address, the actor and the reason,
 * and eng_audit_events refuses deletes, so the act is answerable afterwards.
 */

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function gate() {
  const actor = await currentActor();
  if (!actor) return { error: bad("Not signed in.", 401) };
  if (actor.status !== "active") return { error: bad("This account is not active.", 403) };
  if (!can(actor, "suppressions.manage")) return { error: bad("You cannot change the do not contact list.", 403) };
  return { actor };
}

export async function POST(request: NextRequest) {
  const gated = await gate();
  if (gated.error) return gated.error;
  const { actor } = gated;

  let body: { email?: unknown; because?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("That request was not readable.");
  }

  const email = typeof body.email === "string" ? normaliseEmail(body.email) : "";
  const because = typeof body.because === "string" ? body.because.trim() : "";

  if (!email || !email.includes("@")) return bad("An email address is required.");
  /*
   * The reason is required and is not a dropdown. `because` on the table is
   * deliberately free text, for the reason 0026 gives: the list of ways
   * somebody can ask will grow, and a check constraint on a reason code is a
   * migration every time it does. What matters is that the row says how the
   * firm came to believe this person asked, in words somebody can read back to
   * them if they ever say they did not.
   */
  if (because.length < 4) return bad("Say how the request arrived. A row nobody can explain is a row nobody can defend.");

  const done = await suppress(email, because);
  if (!done.ok) return bad(done.error, 500);

  await writeAudit({
    actor,
    action: "suppression.add",
    entityType: "marketing_suppression",
    entityId: email,
    summary: `Recorded a request to stop marketing to ${email}: ${because}`,
    ...(await requestContext()),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const gated = await gate();
  if (gated.error) return gated.error;
  const { actor } = gated;

  const email = normaliseEmail(request.nextUrl.searchParams.get("email") ?? "");
  if (!email) return bad("Which address?");

  /*
   * The reason travels with the request, because 0034 refuses a void without
   * one at the database. Asking for it here means the person who knows why is
   * the person who types it.
   */
  const because = request.nextUrl.searchParams.get("because") ?? "";

  /*
   * AND WHAT WAS MEANT INSTEAD, ASKED IN THE SAME MOTION.
   *
   * Operator ruling, gate 2. Somebody rang and asked not to be contacted, and
   * the address was written down wrong. Voiding the wrong row on its own
   * un-suppresses an address that never asked for anything AND loses the
   * request that was actually made.
   *
   * The route takes one or the other and never neither. It does not default,
   * because a default here would make the lossy case the easy one.
   */
  const instead = (request.nextUrl.searchParams.get("instead") ?? "").trim();
  const noneBecause = (request.nextUrl.searchParams.get("noReplacementBecause") ?? "").trim();

  if (instead && noneBecause) {
    return bad(
      "Give the correct address or say there is not one, not both. A row that names an address and a reason there is no address is a row nobody can read.",
    );
  }
  if (!instead && !noneBecause) {
    return bad(
      "What should it have said? Give the address they actually asked about, or say why there is not one. A void with neither loses a request somebody made out loud.",
    );
  }

  const done = await voidOperatorEntry(
    email,
    because,
    actor.id,
    instead ? { kind: "address", email: instead } : { kind: "none", because: noneBecause },
  );
  if (!done.ok) return bad(done.error, done.error.includes("clicking") ? 403 : 400);

  await writeAudit({
    actor,
    action: "suppression.void",
    entityType: "marketing_suppression",
    entityId: email,
    summary:
      `Marked the operator entered suppression for ${email} as a typing mistake: ${because.trim()}. ` +
      (done.suppressedInstead
        ? `The address they actually asked about, ${done.suppressedInstead}, was suppressed in the same motion, so the request itself is not lost. `
        : `There is no correct address to record instead: ${noneBecause} `) +
      "The row stays, because a consent record is never deleted; it stops counting, so the mistyped address hears from the firm again. " +
      "This is a correction and not a resubscribe: the row carried no token, so it never represented a click.",
    ...(await requestContext()),
  });

  return NextResponse.json({ ok: true });
}
