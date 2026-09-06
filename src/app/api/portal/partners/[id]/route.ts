import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { invitePartnerUser, setPartnerStatus, setPartnerTerms } from "@/lib/ops-partners-admin";
import {
  closePartnerPeriod,
  issuePartnerStatement,
  recordAdjustment,
  recordPartnerPayout,
} from "@/lib/ops-partner-comp";
import { decideSubmission } from "@/lib/ops-partner-assets";
import { deploymentOrigin } from "@/lib/site-url";
import { money } from "@/lib/ops-money";
import type { CompModel, Tier } from "@/lib/partner-comp";

/**
 * Everything an operator does to one partner, behind one door.
 *
 * WHY ONE ROUTE AND NOT SEVEN
 * ---------------------------
 * Because the door is the interesting part. Seven routes means seven places to
 * remember the same two checks, and the seventh is the one somebody adds in a
 * hurry. Here the session and the capability are resolved once, before the
 * switch, and every branch is past them by construction.
 *
 * The modules check again. That is not belt and braces for its own sake: a
 * module function is callable from a job, a script, or a route written later,
 * and the capability belongs where the write is.
 *
 * MONEY IN CENTS, PARSED IN ONE PLACE
 * -----------------------------------
 * The screen sends dollars because that is what a person types. Multiplying by
 * a hundred and rounding is done here rather than in each caller, because a
 * float that arrives as 12.345 has to become an integer somewhere and the place
 * it happens should be the place somebody looks for it.
 */

export const dynamic = "force-dynamic";

function dollarsToCents(raw: unknown): number | null {
  const value = Number(String(raw ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!can(actor, "partners.manage")) {
    return NextResponse.json(
      { ok: false, error: "You do not have permission to manage the referral programme." },
      { status: 403 },
    );
  }

  const { id: partnerId } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");

  const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

  switch (action) {
    case "status": {
      const status = String(body?.status ?? "");
      if (!["active", "suspended", "ended"].includes(status)) return bad("That is not a state.");
      const result = await setPartnerStatus(
        actor,
        partnerId,
        status as "active" | "suspended" | "ended",
        String(body?.reason ?? ""),
      );
      return result.ok
        ? NextResponse.json({ ok: true, note: `Recorded. The partner is ${status}.` })
        : bad(result.error);
    }

    case "terms": {
      const model = String(body?.model ?? "") as CompModel;
      if (
        !["percent_of_order", "flat_per_order", "flat_per_qualified_lead", "tiered_by_volume"].includes(model)
      ) {
        return bad("That is not a compensation model.");
      }

      /*
       * A percentage arrives as a percentage and is stored in basis points, so
       * a rate is an integer and never a float. 2.5 becomes 250.
       */
      const percent = body?.percent === null || body?.percent === undefined ? null : Number(body.percent);
      const percentBps = percent === null || !Number.isFinite(percent) ? null : Math.round(percent * 100);

      const result = await setPartnerTerms(actor, partnerId, {
        model,
        percentBps,
        flatCents: body?.flat === null || body?.flat === undefined ? null : dollarsToCents(body.flat),
        tiers: (body?.tiers as Tier[] | null) ?? null,
        holdbackDays: Number(body?.holdbackDays ?? 30),
        effectiveFrom: String(body?.effectiveFrom ?? ""),
        note: String(body?.note ?? ""),
      });
      return result.ok ? NextResponse.json({ ok: true, note: "Terms set." }) : bad(result.error);
    }

    case "invite": {
      const result = await invitePartnerUser(
        actor,
        partnerId,
        { email: String(body?.email ?? ""), displayName: String(body?.displayName ?? "") },
        deploymentOrigin(),
      );
      return result.ok
        ? NextResponse.json({
            ok: true,
            setPasswordUrl: result.setPasswordUrl,
            expiresAt: result.expiresAt,
            note: result.alreadyExisted
              ? "That person already had an account, so this is a reset link."
              : "Invited.",
          })
        : bad(result.error);
    }

    case "close": {
      const result = await closePartnerPeriod(partnerId, String(body?.period ?? ""), {
        actorEmail: actor.email,
      });
      if (!result.ok) return bad(result.error);
      return NextResponse.json({
        ok: true,
        note: result.statementId
          ? `${result.reference}: ${result.entries} entr${result.entries === 1 ? "y" : "ies"}, ${money(result.totalCents)}. ${result.note}`
          : result.note,
      });
    }

    case "issue": {
      const result = await issuePartnerStatement(String(body?.statementId ?? ""), actor.email);
      return result.ok
        ? NextResponse.json({
            ok: true,
            note: `${result.reference} issued for ${money(result.totalCents)}. The partner can see it now.`,
          })
        : bad(result.error);
    }

    case "pay": {
      const result = await recordPartnerPayout({
        statementId: String(body?.statementId ?? ""),
        reference: String(body?.reference ?? ""),
        note: String(body?.note ?? ""),
        actorId: actor.id,
        actorEmail: actor.email,
      });
      return result.ok
        ? NextResponse.json({ ok: true, note: "Recorded as paid." })
        : bad(result.error);
    }

    case "adjustment": {
      const amountCents = dollarsToCents(body?.amount);
      if (amountCents === null) return bad("That is not an amount.");
      const result = await recordAdjustment(actor, {
        partnerId,
        amountCents,
        reason: String(body?.reason ?? ""),
      });
      return result.ok
        ? NextResponse.json({
            ok: true,
            note: `${money(amountCents)} recorded on the ledger, beside what it corrects.`,
          })
        : bad(result.error);
    }

    case "decide": {
      const decision = String(body?.decision ?? "");
      if (!["approved", "changes_requested"].includes(decision)) return bad("That is not a decision.");
      const result = await decideSubmission(
        actor,
        String(body?.submissionId ?? ""),
        decision as "approved" | "changes_requested",
        String(body?.note ?? ""),
      );
      return result.ok
        ? NextResponse.json({
            ok: true,
            note: decision === "approved" ? "Approved, and the partner can see it." : "Sent back with your note.",
          })
        : bad(result.error);
    }

    default:
      return bad("That is not something this screen does.");
  }
}
