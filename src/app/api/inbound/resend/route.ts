import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { DB_NOW } from "@/lib/db-now";
import { handleInbound } from "@/lib/crm-inbound";
import { CRM_REPLY_DOMAIN } from "@/config/crm-email";

export const dynamic = "force-dynamic";

/**
 * THE REPLY WEBHOOK. Robert's sales CRM ruling of 2026-11-02, item R7, and
 * his answer 1 (6587550325): replies to sales emails through a reply
 * subdomain on Resend Inbound. The whole path, and why each step is where it
 * is, is in src/lib/crm-inbound.ts.
 *
 * CLOSED WHILE RESEND_WEBHOOK_SECRET IS UNSET: 404, the same answer an absent
 * route gives, as the cron routes do without CRON_SECRET. The secret is set in
 * Vercel when the subdomain reads verified in Resend (the records are posted
 * for Robert, issue #1 comment 6588394106), and it is declared in
 * src/config/credential-inventory.ts.
 */

async function fetchReceived(emailId: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, error: "RESEND_API_KEY is not set" };
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false as const, error: `Resend answered ${res.status}` };
  const body = (await res.json().catch(() => null)) as { from?: string; to?: string[] | string; subject?: string; text?: string } | null;
  if (!body) return { ok: false as const, error: "Resend's answer was not JSON" };
  const to = Array.isArray(body.to) ? body.to : body.to ? [body.to] : [];
  return { ok: true as const, from: body.from ?? null, to, subject: body.subject ?? null, text: body.text ?? null };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() || null;
  if (!secret) return NextResponse.json({ ok: false }, { status: 404 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "The database is not configured." }, { status: 500 });

  const rawBody = await req.text();
  const answer = await handleInbound(
    { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") },
    rawBody,
    {
      secret,
      replyDomain: CRM_REPLY_DOMAIN,
      now: new Date(),
      fetchReceived,
      companyExists: async (id) => {
        const { data, error } = await db.from("eng_prospects").select("id").eq("id", id).maybeSingle();
        return error ? { ok: false, error: error.message } : { ok: true, exists: Boolean(data) };
      },
      companiesWithAddress: async (address) => {
        const { data, error } = await db.from("eng_prospect_contacts").select("prospect_id").ilike("email", address.replace(/[%_\\]/g, (c) => `\\${c}`)).limit(50);
        return error ? { ok: false, error: error.message } : { ok: true, ids: (data ?? []).map((r) => String(r.prospect_id)) };
      },
      recordReply: async (row) => {
        const { error } = await db.from("eng_crm_email_replies").insert(row);
        if (!error) return { ok: true };
        return { ok: false, duplicate: error.code === "23505", error: error.message };
      },
      pauseSequence: async (id) => {
        const { error } = await db.from("eng_prospects").update({ sequence_paused_at: DB_NOW }).eq("id", id).is("sequence_paused_at", null);
        return error ? { ok: false, error: error.message } : { ok: true };
      },
    },
  );
  return NextResponse.json(answer.body, { status: answer.status });
}

export async function GET() {
  return NextResponse.json({ ok: false }, { status: 404 });
}
