/**
 * EVERY BULK PATH ON THIS PLATFORM, AND WHAT EACH ONE MUST REFUSE.
 *
 * Phase 12 Section 4, Section 2. Section 1 built bulk operations; this is what
 * bulk must not do, declared rather than remembered.
 *
 * WHY A BULK OPERATION IS NOT JUST A LOOP
 * ----------------------------------------
 * It is tempting to say a bulk action is the single action N times and needs no
 * rules of its own. Section 1 proved otherwise, twice, and both times the same
 * way: a bulk path does not INTRODUCE the danger, it REMOVES the accident that
 * was containing it.
 *
 *   The dispatch status rule lived in the Files page, which rendered the panel
 *   only for a file in needs_dispatch. sendOffers itself selected `status` and
 *   never read it. The screen was the whole rule. The moment bulk dispatch
 *   called sendOffers directly, as it must, a SEALED file became dispatchable:
 *   field technicians sent to inspect work a Professional Engineer had already
 *   put their seal on. Found by building the bulk path, and fixed in
 *   sendOffers so every caller inherits it.
 *
 *   The export's money columns are stripped by redactFile, which the screen also
 *   relies on. A bulk export that had read the files itself would have handed
 *   three hundred rows of pricing to a role that cannot see one.
 *
 * So each path below declares which refusals apply to it, and bulk-audit
 * asserts every one. A path with no declared refusals fails the board, for the
 * same reason a registered job kind with no probe does: the list is the
 * mechanism, and a list nothing reads stops being true without telling anybody.
 *
 * WHAT THIS IS NOT
 * -----------------
 * It is not a permission model. `can()` is that, and every path checks it. These
 * are the refusals that survive a caller who HAS the permission and is acting on
 * many records at once, which is the situation a single record screen never
 * puts anybody in.
 */

/**
 * @typedef {object} Refusal
 * @property {string} key    Short name, used by the audit.
 * @property {string} rule   What must not happen, in one sentence.
 * @property {string} why    What it costs when it does.
 */

/** @type {Refusal[]} */
export const REFUSALS = [
  {
    key: "sealed",
    rule: "No bulk operation may act on a sealed or delivered file.",
    why:
      "Sealed means a named Professional Engineer has put their seal on the work. Acting on it in bulk is " +
      "acting on the firm's regulatory output at a scale nobody reviewed, and dispatching one sends " +
      "technicians to inspect a job that is finished. The single file screens gate these by status; a bulk " +
      "path calls the function underneath and inherits nothing the screen was doing.",
  },
  {
    key: "assign",
    rule: "No bulk operation may write an assignment.",
    why:
      "Operator ruling, gate 1: nothing assigns a file to an engineer. An engineer ACCEPTS one, and that " +
      "acceptance is the responsible charge entry. files.assign left the authz matrix in 0040 because a " +
      "declared capability nothing uses is a door waiting for somebody to build on.",
  },
  {
    key: "selection",
    rule: "No bulk operation may choose a person who receives work or money.",
    why:
      "Operator ruling, gate 1: no technician is chosen by a bulk path that the single path would not have " +
      "chosen for that file. Offers are how field technicians get paid, and a bulk action that fanned every " +
      "plan out to everyone eligible would route the firm's field spend by a rule nobody ruled on.",
  },
  {
    key: "redaction",
    rule: "No bulk operation may return more than the same actor's single record read would.",
    why:
      "One request, three hundred rows, and no screen in between is the easiest place on this platform for a " +
      "permission bypass to hide. Every bulk read goes through the same scoped query the list uses, so the " +
      "redaction applies without the bulk path knowing it exists.",
  },
  {
    key: "delete",
    rule: "No bulk operation may delete anything.",
    why:
      "Retention is the only path that removes rows, it is declared per table, it plans before it runs, and " +
      "it writes a manifest. A bulk screen that could delete would be a second answer to what may be removed, " +
      "and the two would drift. Twenty two tables refuse DELETE outright since 0032 and the rest are not a " +
      "bulk screen's business.",
  },
  {
    key: "silent",
    rule: "No bulk operation may report success over a refusal.",
    why:
      "A screen saying 12 dispatched over three silent refusals is describing work that did not happen. Every " +
      "path reports per record, with the reason, which is the rule ops-bulk already followed for a batch of " +
      "orders and is now the rule for all of them.",
  },
  {
    key: "outward",
    rule: "No bulk operation may reach a person outside the firm without the actor rule deciding.",
    why:
      "55 emails left development in one day because a worker ran jobs nobody meant it to run. effect_mode " +
      "puts the permission on the row, decided at enqueue from the identity the work is about, so a bulk " +
      "action cannot become a bulk send by being pointed at the wrong rows.",
  },
];

/**
 * @typedef {object} BulkPath
 * @property {string} name      What it is, in words.
 * @property {string} module    The file that owns the operation.
 * @property {string[]} refuses Keys from REFUSALS. Every path names all that apply.
 * @property {string} note      Anything a reader would otherwise get wrong.
 */

/** @type {BulkPath[]} */
export const BULK_PATHS = [
  {
    name: "Exporting selected files",
    module: "src/lib/ops-bulk-files.ts",
    refuses: ["assign", "selection", "redaction", "delete", "silent"],
    note:
      "A read. It does not reach outside, so `outward` does not apply, and it deliberately does NOT refuse a " +
      "sealed file: reading one is what a file list already does, and an export that silently omitted sealed " +
      "rows would be the demonstration-row defect wearing a different hat. What it must never do is show " +
      "money to somebody the screen would not.",
  },
  {
    name: "Dispatching selected files",
    module: "src/lib/ops-bulk-dispatch.ts",
    refuses: ["sealed", "assign", "selection", "redaction", "delete", "silent", "outward"],
    note:
      "Every refusal applies, and it is the path that found the sealed one. It sends through the single file " +
      "sendOffers so the refusals are made once; what this module adds is saying them on the review screen " +
      "before anything is ticked.",
  },
  {
    name: "Placing many orders in one submission",
    module: "src/lib/ops-bulk.ts",
    refuses: ["assign", "selection", "delete", "silent", "outward"],
    note:
      "The customer facing one, and it predates this section. It wraps placeOrder for the same reason bulk " +
      "dispatch wraps sendOffers. `sealed` and `redaction` do not apply: it CREATES files rather than reading " +
      "or changing existing ones, so there is nothing sealed to reach and nothing of somebody else's to leak.",
  },
  {
    name: "Approving or paying many technician ledger rows",
    module: "src/lib/ops-field.ts",
    refuses: ["assign", "selection", "delete", "silent"],
    note:
      "setLedgerStatus, which predates this section and is the one operator side bulk write the platform had. " +
      "It is money: one press stamps approved_at or paid_at on up to three hundred rows, which is how the " +
      "process clock defect was found. `sealed` does not apply because it acts on ledger rows rather than " +
      "files, and `outward` does not because it sends nothing.",
  },
  {
    name: "Attaching many partner ledger entries to a statement",
    module: "src/lib/ops-partner-comp.ts",
    refuses: ["assign", "selection", "delete", "silent"],
    note:
      "THE ONE THIS SWEEP FOUND, and it is money. Closing a statement claims every payable entry into it with " +
      "one update. eng_partner_entries is frozen by 0019 against every column EXCEPT statement_id, which is " +
      "the one this writes, and that narrow shape exists precisely so a close is possible without the ledger " +
      "becoming editable. It was not in this list until the sweep named it, which is the argument for " +
      "sweeping rather than remembering. `sealed` does not apply because it acts on ledger entries rather " +
      "than files, and `redaction` does not because a partner statement is scoped to one partner by the " +
      "query that built it.",
  },
  {
    name: "Marking many notifications read",
    module: "src/lib/ops-notify.ts",
    refuses: ["assign", "selection", "delete", "silent", "outward"],
    note:
      "The mildest bulk write on the platform and it is here because the sweep found it, not because anybody " +
      "would have thought of it. It is scoped to the actor's OWN profile in the query itself rather than " +
      "filtered afterwards, so `redaction` is satisfied by construction: there is no id a caller could pass " +
      "that would touch somebody else's row. `sealed` does not apply; a notification is not a file.",
  },
  {
    name: "Sweeping rows a retention manifest named",
    module: "src/lib/ops-retention.ts",
    refuses: ["assign", "selection", "silent", "outward"],
    note:
      "The one path that DOES delete, which is why it does not refuse `delete`. Everything about it is the " +
      "argument for that refusal elsewhere: the table must be in the declaration, the manifest is written " +
      "before the job is queued, the ids are hashed into it, and what it did is reconciled against what it " +
      "said it would do. A bulk screen offering deletion would be a second answer to all of that.",
  },
];

/** The refusal keys, for checking a path names only real ones. */
export function refusalKeys() {
  return REFUSALS.map((r) => r.key);
}
