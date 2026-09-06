/**
 * WHAT AN AUDIT MADE, SO IT CAN REMOVE IT.
 *
 * THE DEFECT THIS FIXES
 * ---------------------
 * portal-probe.mjs sweeps probe ACCOUNTS, because an account carries a domain
 * that says whose it is. Nothing swept the rows those accounts went on to
 * create, and nothing could: a file, a thread, a message or an evidence item
 * carries nothing that identifies which run made it.
 *
 * So development accumulated. Three files with a timestamp where a street
 * number belongs, taking 0007 to 0009 out of the real sequence. Twenty four
 * threads. Forty two messages. Every screenshot of the portal showed some of
 * it, truthfully, which is the problem.
 *
 * Operator ruling, 2026-09-05: fix the cause rather than the residue, because
 * an audit leaving rows nothing removes is the cause and cleanup is the symptom.
 *
 * HOW
 * ---
 * A run registers what it creates, here, as it creates it. At the end it calls
 * sweep() and the rows go in dependency order. Nothing is guessed at from a
 * naming convention, because a convention is a thing somebody forgets and this
 * is a list of ids the run actually holds.
 *
 * WHAT IS NEVER SWEPT, AND THIS IS STANDING LAW
 * ---------------------------------------------
 * eng_audit_events, and nothing a future session finds inconvenient changes it.
 * Operator ruling, 2026-09-05: a test run able to erase the firm's regulatory
 * memory is a far worse property than probe rows sitting in it. That table
 * refuses deletes at the database level and should; the rows are the price of
 * the guarantee, and the guarantee is worth more than tidiness.
 *
 * It is enforced rather than written down. NEVER_SWEEP below is checked when
 * this module loads and again on every made() call, so putting the table into
 * ORDER fails the import and takes the whole suite down with it rather than
 * quietly granting a run the power to forget.
 *
 * NEVER PRODUCTION, for the obvious reason: this deletes things.
 */

import { auditClient } from "./db-target.mjs";

/*
 * Dependency order. A file cannot go while an evidence item points at it, and a
 * thread cannot go while a message does. Written down once here rather than
 * remembered at four call sites.
 */
const ORDER = [
  "eng_messages",
  "eng_thread_participants",
  "eng_threads",
  "eng_evidence_items",
  "eng_assignments",
  "eng_tech_pay_ledger",
  "eng_file_inputs",
  "eng_files",
  "eng_clients",
];

/*
 * The standing law above, in a form that cannot be edited out by accident.
 * Adding one of these to ORDER throws at import, which is deliberate: a rule
 * this important should break loudly at the top of a run rather than be
 * discovered missing afterwards.
 */
const NEVER_SWEEP = ["eng_audit_events"];

for (const table of NEVER_SWEEP) {
  if (ORDER.includes(table)) {
    throw new Error(
      `${table} is in the sweep order. It is the firm's regulatory memory and no test run may erase from it.`,
    );
  }
}

export class ProbeLedger {
  constructor(label) {
    this.label = label;
    /** table -> Set of ids */
    this.rows = new Map();
    this.db = auditClient(label, { neverProduction: true });
  }

  /** Register a row this run created. Safe to call with a null id. */
  made(table, id) {
    if (!id) return id;
    if (NEVER_SWEEP.includes(table)) {
      throw new Error(
        `${table} is never swept. It is the firm's regulatory memory, and a run that could erase from it is a worse defect than the rows it would remove.`,
      );
    }
    if (!ORDER.includes(table)) {
      throw new Error(
        `${table} is not in the sweep order, so registering it would promise a cleanup that never happens`,
      );
    }
    if (!this.rows.has(table)) this.rows.set(table, new Set());
    this.rows.get(table).add(id);
    return id;
  }

  /** How many rows this run is holding, for a check that it held any. */
  count() {
    let n = 0;
    for (const set of this.rows.values()) n += set.size;
    return n;
  }

  /**
   * Remove everything, in dependency order, and VERIFY each table is empty of
   * what it held. A delete that matched nothing returns no error, which is the
   * forms-audit lesson and the reason this looks rather than trusts.
   */
  async sweep() {
    if (!this.db) return { ok: true, left: 0, note: "no client, nothing was created" };

    const left = [];
    for (const table of ORDER) {
      const ids = [...(this.rows.get(table) ?? [])];
      if (ids.length === 0) continue;

      await this.db.from(table).delete().in("id", ids);

      const { data } = await this.db.from(table).select("id").in("id", ids);
      if ((data ?? []).length > 0) left.push(`${table}: ${(data ?? []).length}`);
    }

    this.rows.clear();
    return {
      ok: left.length === 0,
      left: left.length,
      note: left.length ? left.join(", ") : "",
    };
  }
}

/**
 * The residue that predates the ledger, removed by its signature.
 *
 * This is the one place a naming convention IS the mechanism, and only because
 * the rows it targets were created before anything recorded what it made. It
 * exists to clear history once, and the ledger is what stops history repeating.
 *
 * The signature is narrow on purpose: a property address beginning with ten or
 * more digits is a unix timestamp where a street number belongs, which is what
 * every probe file has and no real address ever will.
 */
export async function sweepLegacyResidue(label = "reset") {
  const db = auditClient(label, { neverProduction: true });
  if (!db) return { ok: false, note: "no client" };

  const removed = {};

  const { data: files } = await db
    .from("eng_files")
    .select("id, file_number, property_address")
    .not("property_address", "is", null);

  const probeFiles = (files ?? []).filter((f) => /^\d{10,}/.test(String(f.property_address)));
  const ids = probeFiles.map((f) => f.id);

  if (ids.length) {
    for (const table of ["eng_messages", "eng_thread_participants", "eng_threads"]) {
      if (table === "eng_messages" || table === "eng_thread_participants") {
        const { data: threads } = await db.from("eng_threads").select("id").in("file_id", ids);
        const threadIds = (threads ?? []).map((t) => t.id);
        if (threadIds.length) await db.from(table).delete().in("thread_id", threadIds);
      } else {
        await db.from(table).delete().in("file_id", ids);
      }
    }
    for (const table of ["eng_evidence_items", "eng_assignments", "eng_tech_pay_ledger", "eng_file_inputs"]) {
      await db.from(table).delete().in("file_id", ids);
    }
    const { error } = await db.from("eng_files").delete().in("id", ids);
    removed.files = error ? `FAILED: ${error.message}` : ids.length;
  } else {
    removed.files = 0;
  }

  /*
   * PROBE PARTNERS, ADDED 2026-09-06.
   *
   * Found by building the operator's roster screen in Phase 9 Section 6 and
   * looking at it: nine rows reading "ZZ probe, safe to ignore" above the one
   * real demonstration partner. They were created on 2026-09-04 by an end to
   * end script for Section 2 that is not in the tree any more, which is the
   * same class as the timestamped addresses above and the same cause: a script
   * that held no ledger.
   *
   * Nothing in the committed suite creates them, so this is history rather than
   * a leak. The signature is narrow and cannot match a real partner: the
   * organisation name says what it is, and the contact address is on
   * example.com.
   *
   * A partner with ledger entries CANNOT be deleted, by design in 0019. If one
   * of these ever earned anything the delete fails and this reports it, because
   * a probe partner with earnings is something a person has to look at rather
   * than something a sweep should force through.
   */
  const { data: probePartners } = await db
    .from("eng_partners")
    .select("id")
    .eq("organisation", "ZZ probe, safe to ignore")
    .like("contact_email", "%@example.com");

  const partnerIds = (probePartners ?? []).map((p) => p.id);

  /*
   * AND MOST OF THEM CANNOT BE REMOVED, WHICH IS THE RULE WORKING.
   *
   * A partner touch refuses DELETE at the database. 0014 put that trigger there
   * because a touch is the evidence a dispute is settled from, and evidence
   * that can be deleted after the decision is not evidence. eng_partner_touches
   * references the partner with ON DELETE RESTRICT, so a partner who was ever
   * touched cannot be deleted either.
   *
   * The first version of this sweep tried to delete the touches first. That
   * delete matched nothing, returned no error, and the partner delete then
   * failed on the constraint. It was written by somebody who had not read the
   * trigger, which was me, and the check that caught it was looking at the
   * screen afterwards.
   *
   * So: remove the ones with no touches, leave the rest, and say which. This is
   * the same standing as eng_audit_events. A probe row that cannot be erased is
   * the price of a guarantee worth more than tidiness, and pretending otherwise
   * would mean weakening the trigger to clean up development.
   */
  let removable = [];
  let untouchable = 0;

  if (partnerIds.length) {
    const { data: touched } = await db
      .from("eng_partner_touches")
      .select("partner_id")
      .in("partner_id", partnerIds);
    const hasTouch = new Set((touched ?? []).map((t) => t.partner_id));
    removable = partnerIds.filter((id) => !hasTouch.has(id));
    untouchable = partnerIds.length - removable.length;
  }

  if (removable.length) {
    const { data: partnerUsers } = await db
      .from("eng_partner_users")
      .select("id")
      .in("partner_id", removable);
    const userIds = (partnerUsers ?? []).map((u) => u.id);
    if (userIds.length) await db.from("eng_partner_tokens").delete().in("user_id", userIds);
    await db.from("eng_partner_users").delete().in("partner_id", removable);
    await db.from("eng_partner_terms").delete().in("partner_id", removable);
    const { error } = await db.from("eng_partners").delete().in("id", removable);
    removed.partners = error ? `FAILED: ${error.message}` : removable.length;
  } else {
    removed.partners = 0;
  }
  removed.partnersKeptForEvidence = untouchable;

  const { data: still } = await db.from("eng_files").select("property_address");
  const remaining = (still ?? []).filter((f) => /^\d{10,}/.test(String(f.property_address ?? "")));

  /*
   * The verdict counts only what SHOULD have gone. A probe partner held by its
   * own touch log is not a failed sweep, and reporting it as one would train
   * whoever runs this to ignore the line.
   */
  const { data: partnersLeft } = await db
    .from("eng_partners")
    .select("id")
    .eq("organisation", "ZZ probe, safe to ignore")
    .in("id", removable.length ? removable : ["00000000-0000-4000-8000-000000000000"]);

  const stragglers = [
    remaining.length ? `${remaining.length} probe file(s)` : "",
    (partnersLeft ?? []).length ? `${(partnersLeft ?? []).length} probe partner(s)` : "",
  ].filter(Boolean);

  return {
    ok: stragglers.length === 0,
    removed,
    note: stragglers.length
      ? `${stragglers.join(" and ")} still present`
      : untouchable
        ? `${untouchable} probe partner(s) kept, held by the touch log, which refuses deletion by design`
        : "",
  };
}
