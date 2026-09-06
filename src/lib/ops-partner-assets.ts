import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { copyVerdict, performingFirmLine, type CopyVerdict } from "./partner-copy";
import type { PartnerPrincipal } from "./partner-auth";
import type { Actor } from "./ops-authz";

/**
 * The asset library, and material a partner sends the firm to look at.
 *
 * NON NEGOTIABLE 2, MADE ENFORCEABLE
 * ----------------------------------
 * "No partner surface may render a service claim the public site could not."
 * Until this existed that was a sentence in a document. Here it is a refusal:
 * copy that would fail the site's own voice audit cannot be published into the
 * library, so it cannot reach a partner through the approved path at all.
 *
 * THE CHECK RUNS ON PUBLISH AND NOT ON SUBMIT, AND THAT IS DELIBERATE
 * -------------------------------------------------------------------
 * A partner sending something in for review is asking whether it is allowed.
 * Refusing to accept it because the answer is no would mean the firm never sees
 * the thing a partner was about to publish anyway, and the partner learns
 * nothing except that the form is broken.
 *
 * So a submission is always accepted, the same check runs, and its verdict is
 * shown to both sides as the first thing anybody reads. The operator decides.
 * The firm's own material is held to the harder rule, because publishing it is
 * the firm saying the words itself.
 */

export const ASSET_BUCKET = "eng-partner-assets";
const SIGNED_URL_SECONDS = 60 * 10;

export type AssetKind = "copy_block" | "one_pager" | "logo" | "email_snippet" | "link_card";

export type PublishedAsset = {
  id: string;
  slug: string;
  title: string;
  kind: AssetKind;
  version: number;
  body: string | null;
  summary: string | null;
  storageKey: string | null;
  contentType: string | null;
  publishedAt: string | null;
};

/**
 * What a partner may use today: the current version of everything published.
 *
 * Withdrawn assets are not returned. A withdrawn asset is the firm saying stop
 * using this, and the version history keeps what it said, but a partner opening
 * the library should not be able to copy a paragraph the firm has pulled.
 */
export async function publishedAssets(): Promise<PublishedAsset[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data: assets } = await db
    .from("eng_partner_assets")
    .select("id, slug, title, kind, status, current_version")
    .eq("status", "published")
    .order("kind", { ascending: true });

  const ids = (assets ?? []).map((a) => a.id as string);
  if (ids.length === 0) return [];

  const { data: versions } = await db
    .from("eng_partner_asset_versions")
    .select("asset_id, version, body, summary, storage_key, content_type, published_at")
    .in("asset_id", ids);

  const current = new Map<string, (typeof versions extends (infer T)[] ? T : never) | undefined>();
  void current;

  return (assets ?? [])
    .map((asset) => {
      const version = (versions ?? []).find(
        (v) => v.asset_id === asset.id && Number(v.version) === Number(asset.current_version),
      );
      if (!version) return null;
      return {
        id: asset.id as string,
        slug: asset.slug as string,
        title: asset.title as string,
        kind: asset.kind as AssetKind,
        version: Number(version.version),
        body: (version.body as string | null) ?? null,
        summary: (version.summary as string | null) ?? null,
        storageKey: (version.storage_key as string | null) ?? null,
        contentType: (version.content_type as string | null) ?? null,
        publishedAt: (version.published_at as string | null) ?? null,
      };
    })
    .filter((a): a is PublishedAsset => a !== null);
}

/** A short lived link to an asset file. Ten minutes, and never a public url. */
export async function assetDownloadUrl(storageKey: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.storage.from(ASSET_BUCKET).createSignedUrl(storageKey, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

// ------------------------------------------------------------- publishing

export type PublishResult =
  | { ok: true; slug: string; version: number }
  | { ok: false; error: string; verdict?: CopyVerdict };

/**
 * Publish a version of an asset.
 *
 * THE REFUSAL IS THE FEATURE. Copy that names a regulated claim the public site
 * could not make is not published, and the caller is told which sentence and
 * why rather than being told no.
 *
 * A new version rather than an edit, always. A partner who put a paragraph on
 * their website in March is entitled to know exactly what they were given in
 * March, and an editable version would mean the firm's record of what it
 * approved changed under somebody still displaying the old wording.
 */
export async function publishAsset(
  actor: Actor & { email?: string },
  input: {
    slug: string;
    title: string;
    kind: AssetKind;
    body?: string | null;
    summary?: string | null;
    storageKey?: string | null;
    contentType?: string | null;
    byteSize?: number | null;
  },
): Promise<PublishResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug)) {
    return { ok: false, error: "A slug is lower case letters, numbers and hyphens." };
  }

  /*
   * Everything a partner would READ is checked: the copy, the title, and the
   * summary. The title especially, because it is the line that ends up in a
   * list and gets copied into an email.
   */
  const checkable = [input.title, input.summary ?? "", input.body ?? ""].join("\n\n");
  const verdict = copyVerdict(checkable);
  if (!verdict.ok) {
    await writeAudit({
      actor,
      action: "partner.asset_refused",
      entityType: "partner_asset",
      entityId: slug,
      summary: `Refused: ${verdict.summary}`,
    });
    return { ok: false, error: verdict.summary, verdict };
  }

  const { data: existing } = await db
    .from("eng_partner_assets")
    .select("id, current_version")
    .eq("slug", slug)
    .maybeSingle();

  let assetId = existing?.id as string | undefined;

  if (!assetId) {
    const { data: created, error } = await db
      .from("eng_partner_assets")
      .insert({ slug, title: input.title, kind: input.kind, status: "draft" })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "The asset could not be created." };
    assetId = created.id as string;
  }

  const version = Number(existing?.current_version ?? 0) + 1;

  const { error: versionError } = await db.from("eng_partner_asset_versions").insert({
    asset_id: assetId,
    version,
    body: input.body ?? null,
    summary: input.summary ?? null,
    bucket: input.storageKey ? ASSET_BUCKET : null,
    storage_key: input.storageKey ?? null,
    content_type: input.contentType ?? null,
    byte_size: input.byteSize ?? null,
    /*
     * What it was checked against, at the moment it passed. Not recomputed on
     * read: two patterns were added on 2026-09-05 and one of them found a claim
     * that had been live for a month. What the firm needs to say later is that
     * this was checked on this date against these rules, which is a different
     * statement from "it passes today".
     */
    check_note: `Checked against the firm's regulated and voice patterns. ${verdict.summary}`,
    published_at: new Date().toISOString(),
    published_by: actor.id,
  });
  if (versionError) return { ok: false, error: `The version could not be written: ${versionError.message}` };

  await db
    .from("eng_partner_assets")
    .update({ title: input.title, kind: input.kind, status: "published", current_version: version })
    .eq("id", assetId);

  await writeAudit({
    actor,
    action: "partner.asset_published",
    entityType: "partner_asset",
    entityId: slug,
    summary: `${input.title}: version ${version} published to the partner library`,
  });

  return { ok: true, slug, version };
}

/** Stop a partner using something, without removing what it said. */
export async function withdrawAsset(
  actor: Actor & { email?: string },
  slug: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (reason.trim().length < 10) {
    return { ok: false, error: "Say why it is being withdrawn. A partner may be displaying it today." };
  }

  const { data: asset } = await db
    .from("eng_partner_assets")
    .select("id, title")
    .eq("slug", slug)
    .maybeSingle();
  if (!asset) return { ok: false, error: "There is no asset with that slug." };

  await db.from("eng_partner_assets").update({ status: "withdrawn", notes: reason }).eq("id", asset.id);

  await writeAudit({
    actor,
    action: "partner.asset_withdrawn",
    entityType: "partner_asset",
    entityId: slug,
    summary: `${asset.title}: withdrawn. ${reason}`,
  });

  return { ok: true };
}

// ------------------------------------------------------------ submissions

export type Submission = {
  id: string;
  kind: "copy" | "artwork" | "page" | "other";
  title: string;
  body: string | null;
  link: string | null;
  status: "submitted" | "approved" | "changes_requested" | "withdrawn";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  /** What the firm's own patterns said about it when it arrived. */
  advice: string | null;
};

/**
 * A partner sending something in for the firm to look at.
 *
 * ACCEPTED EVEN WHEN IT FAILS THE CHECK. The partner is asking whether it is
 * allowed; refusing the form would mean the firm never sees the thing the
 * partner was about to publish anyway. The verdict is stored as advice and is
 * the first thing both sides read.
 */
export async function submitMaterial(
  principal: PartnerPrincipal,
  input: { kind: Submission["kind"]; title: string; body?: string; link?: string },
): Promise<{ ok: true; id: string; advice: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The partner system is not configured." };

  const title = input.title.trim();
  if (title.length < 3) return { ok: false, error: "Give it a title, so the firm knows what it is." };
  if (!input.body?.trim() && !input.link?.trim()) {
    return { ok: false, error: "Include the wording, or a link to where it is." };
  }

  const verdict = copyVerdict([title, input.body ?? ""].join("\n\n"));

  const { data, error } = await db
    .from("eng_partner_submissions")
    .insert({
      partner_id: principal.partnerId,
      submitted_by: principal.id,
      kind: input.kind,
      title,
      body: input.body?.trim() || null,
      link: input.link?.trim() || null,
      status: "submitted",
      /*
       * The advice goes in decision_note BEFORE anybody has decided, which
       * would be wrong if that column meant "the decision". It does not: it is
       * the firm's answer in the firm's words, and the automated read is the
       * firm's first answer. decided_at is what says whether a person has
       * looked, and it is still null.
       */
      decision_note: verdict.ok ? null : verdict.summary,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "That could not be recorded, so it has not been sent." };

  await writeAudit({
    actor: { id: null, role: "admin", email: principal.email },
    action: "partner.material_submitted",
    entityType: "partner",
    entityId: principal.partnerId,
    summary: `${principal.partner.organisation} sent "${title}" for approval${verdict.ok ? "" : ", and it does not pass the firm's own copy rules"}`,
  });

  return {
    ok: true,
    id: data.id as string,
    advice: verdict.ok
      ? "Nothing in this breaks the firm's own copy rules. Somebody will still read it."
      : verdict.summary,
  };
}

export async function partnerSubmissions(principal: PartnerPrincipal): Promise<Submission[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data } = await db
    .from("eng_partner_submissions")
    .select("id, kind, title, body, link, status, decision_note, decided_at, created_at")
    .eq("partner_id", principal.partnerId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.kind as Submission["kind"],
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    link: (row.link as string | null) ?? null,
    status: row.status as Submission["status"],
    decisionNote: row.decided_at ? ((row.decision_note as string | null) ?? null) : null,
    decidedAt: (row.decided_at as string | null) ?? null,
    createdAt: row.created_at as string,
    advice: row.decided_at ? null : ((row.decision_note as string | null) ?? null),
  }));
}

/**
 * The firm's answer. Section 6 puts a screen on this.
 *
 * Frozen afterwards by the trigger in 0020: reopening is a new submission, so
 * the firm cannot appear to have given one answer when it gave another.
 */
export async function decideSubmission(
  actor: Actor & { email?: string },
  id: string,
  decision: "approved" | "changes_requested",
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  if (note.trim().length < 10) {
    return {
      ok: false,
      error:
        decision === "approved"
          ? "Say what is being approved. A partner reading only the word has to guess which version."
          : "Say which sentence is the problem. A partner cannot fix a refusal with no reason in it.",
    };
  }

  const { data: submission } = await db
    .from("eng_partner_submissions")
    .select("id, partner_id, title, decided_at")
    .eq("id", id)
    .maybeSingle();
  if (!submission) return { ok: false, error: "That submission does not exist." };
  if (submission.decided_at) {
    return { ok: false, error: "That one has already been decided. A new answer is a new submission." };
  }

  const { error } = await db
    .from("eng_partner_submissions")
    .update({
      status: decision,
      decision_note: note.trim(),
      decided_by: actor.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("decided_at", null);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: `partner.material_${decision}`,
    entityType: "partner",
    entityId: submission.partner_id as string,
    summary: `${submission.title}: ${decision === "approved" ? "approved" : "changes requested"}. ${note.trim()}`,
  });

  return { ok: true };
}

/** Everything waiting for a person. Section 6's queue reads this. */
export async function submissionsAwaitingDecision() {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data } = await db
    .from("eng_partner_submissions")
    .select("id, partner_id, kind, title, body, link, created_at, decision_note")
    .eq("status", "submitted")
    .order("created_at", { ascending: true })
    .limit(100);

  return data ?? [];
}

export { performingFirmLine };
