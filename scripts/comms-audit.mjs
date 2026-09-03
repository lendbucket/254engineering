/**
 * Tasks, threads, and notifications: who sees what, and what reaches them where.
 *
 *   npx tsx scripts/comms-audit.mjs
 *
 * Pure. No server, no database, no network. Runs in phase zero.
 *
 * WHAT THIS FILE IS GUARDING
 * --------------------------
 * A messaging system is the easiest place in a platform to leak. A thread is
 * rows, and the difference between "the people on this file" and "everybody" is
 * one forgotten filter that no screen will ever show you.
 *
 * The single most important check here is that an administrator cannot read a
 * direct message they are not in. That is a deliberate limit on the most
 * powerful role in the platform, it is the kind of rule that gets quietly
 * removed by somebody adding an admin override for a support case, and nothing
 * else in the system would notice.
 */
import {
  COMPLIANCE_SEEDS,
  NOTIFICATION_KINDS,
  RECURRENCES,
  canPostToThread,
  canReadThread,
  canSeeTask,
  channelsFor,
  credentialTasks,
  defaultPreference,
  emailIsMandatory,
  firstDueFor,
  isOverdue,
  kindSpec,
  kindsForRole,
  mentionsIn,
  nextOccurrence,
  recipientsOf,
} from "../src/lib/ops-comms.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const actor = (role, id, status = "active") => ({ id, role, status });
const admin = actor("admin", "admin-1");
const engineer = actor("engineer", "eng-1");
const tech = actor("field_tech", "tech-1");
const otherTech = actor("field_tech", "tech-2");

// =====================================================================
// THE ONE THAT MATTERS: a direct message is private, from everybody.
// =====================================================================
{
  const dm = {
    id: "t-dm",
    kind: "direct",
    fileId: null,
    participantIds: ["eng-1", "tech-1"],
  };

  rec("a participant can read a direct thread", canReadThread(engineer, dm, false));
  rec("the other participant can too", canReadThread(tech, dm, false));
  rec("somebody not in it cannot", !canReadThread(otherTech, dm, false));
  /*
   * The check this file exists for. An administrator who can read every private
   * message is one nobody sends an honest message near.
   */
  rec("AN ADMINISTRATOR CANNOT READ A DIRECT THREAD THEY ARE NOT IN", !canReadThread(admin, dm, false));
  rec("and cannot post to it either", !canPostToThread(admin, dm, false));
  rec(
    "an administrator who IS a participant can, because that is just being in it",
    canReadThread(admin, { ...dm, participantIds: ["eng-1", "admin-1"] }, false),
  );
  /*
   * canSeeFile is the file thread's key and must not be a skeleton key. A direct
   * thread has no file, and passing true must not open it.
   */
  rec("file visibility does not open a direct thread", !canReadThread(otherTech, dm, true));
  rec("a signed out actor reads nothing", !canReadThread(null, dm, true));
  rec("a suspended participant reads nothing", !canReadThread({ ...engineer, status: "suspended" }, dm, true));
}

// =====================================================================
// File threads follow the file.
// =====================================================================
{
  const fileThread = { id: "t-f", kind: "file", fileId: "file-1", participantIds: ["tech-1", "eng-1"] };

  rec("somebody who can see the file can read its thread", canReadThread(tech, fileThread, true));
  rec("somebody who cannot see the file cannot", !canReadThread(otherTech, fileThread, false));
  /*
   * Deliberate: a technician who cannot read the note explaining what was wrong
   * with their photographs is a technician who repeats it.
   */
  rec("an administrator can read a file thread, because they can see every file", canReadThread(admin, fileThread, true));
  rec("and reading implies posting", canPostToThread(tech, fileThread, true));
}

// =====================================================================
// Channels are role scoped.
// =====================================================================
{
  const techChannel = {
    id: "t-c",
    kind: "channel",
    fileId: null,
    participantIds: [],
    channelRoles: ["field_tech", "admin"],
  };

  rec("a technician can read a technician channel", canReadThread(tech, techChannel, false));
  rec("an administrator can too", canReadThread(admin, techChannel, false));
  rec("an engineer cannot, because the channel does not name that role", !canReadThread(engineer, techChannel, false));
  rec(
    "an engineer added explicitly can",
    canReadThread(engineer, { ...techChannel, participantIds: ["eng-1"] }, false),
  );
  rec(
    "a channel with no roles and no participants is readable by nobody",
    !canReadThread(admin, { ...techChannel, channelRoles: [], participantIds: [] }, true),
  );
}

// =====================================================================
// Notifications: channels, defaults, and the ones nobody can silence.
// =====================================================================
{
  rec("every kind has a label somebody can read", NOTIFICATION_KINDS.every((k) => k.label.length > 8));
  rec("every kind names at least one role", NOTIFICATION_KINDS.every((k) => k.roles.length > 0));
  rec("kind names are unique", new Set(NOTIFICATION_KINDS.map((k) => k.kind)).size === NOTIFICATION_KINDS.length);

  /*
   * In app is the record that the event happened. A preference that suppressed
   * it would leave a row nobody can ever see, which is a hidden product rather
   * than a quieter one.
   */
  const muted = { kind: "message.received", in_app: false, email: false, sms: false };
  rec(
    "in app is delivered even when the preference says otherwise",
    channelsFor("message.received", "field_tech", muted).includes("in_app"),
  );
  rec("and email is not, when it is turned off", !channelsFor("message.received", "field_tech", muted).includes("email"));

  rec(
    "a kind a role never receives produces no channels at all",
    channelsFor("review.refused", "field_tech", null).length === 0,
    "review.refused is administrators only",
  );
  rec("an unknown kind produces nothing rather than guessing", channelsFor("not.a.kind", "admin", null).length === 0);

  /*
   * SMS: the columns exist so a provider is a configuration change rather than a
   * migration. Until one is wired, claiming the channel would mean recording an
   * SMS that was never sent.
   */
  const smsOn = { kind: "offer.received", in_app: true, email: true, sms: true };
  rec("SMS is never returned as a channel, even when the preference asks for it", !channelsFor("offer.received", "field_tech", smsOn).includes("sms"));
  rec("the preference is still stored rather than discarded", defaultPreference("offer.received").sms === false);

  /*
   * The two that cannot be silenced, and the reason: their consequence lands
   * outside the platform. Everything operational stays optional, because a
   * notification nobody can turn off is one people learn to ignore.
   */
  const MANDATORY = ["credential.expiring", "certification.revoked"];
  for (const kind of MANDATORY) {
    const off = { kind, in_app: true, email: false, sms: false };
    rec(`${kind} still emails when the person turned email off`, channelsFor(kind, "field_tech", off).includes("email"));
    rec(`and the screen knows it is fixed`, emailIsMandatory(kind));
  }
  const optional = NOTIFICATION_KINDS.filter((k) => !MANDATORY.includes(k.kind));
  rec(
    "nothing else is mandatory",
    optional.every((k) => !emailIsMandatory(k.kind)),
    optional.filter((k) => emailIsMandatory(k.kind)).map((k) => k.kind).join(", "),
  );
  rec(
    "the mandatory set is small",
    NOTIFICATION_KINDS.filter((k) => emailIsMandatory(k.kind)).length === 2,
  );

  rec(
    "a technician's preference screen offers only what a technician receives",
    kindsForRole("field_tech").every((k) => k.roles.includes("field_tech")),
  );
  rec("and an engineer's is different from a technician's", kindsForRole("engineer").length !== kindsForRole("field_tech").length);
  rec("a default is produced for any known kind", defaultPreference("mention").in_app === true);
  rec("the default follows the kind rather than being true for everything", defaultPreference("message.received").email === false);
  rec("kindSpec returns nothing for an unknown kind", kindSpec("nope") === null);
}

// =====================================================================
// Mentions.
// =====================================================================
{
  const people = [
    { id: "p1", displayName: "Robert Reyna" },
    { id: "p2", displayName: "Demo Engineer" },
  ];
  rec("a mention by first name is found", mentionsIn("can @robert look at this", people).includes("p1"));
  rec("case does not matter", mentionsIn("@Robert please", people).includes("p1"));
  rec("somebody not mentioned is not notified", !mentionsIn("@robert please", people).includes("p2"));
  rec("a bare name with no at sign is not a mention", mentionsIn("robert should see this", people).length === 0);
  /*
   * Matched against the thread's participants only, so a mention cannot be used
   * to discover that somebody exists or to notify a person outside the
   * conversation.
   */
  rec("a mention of somebody not on the thread notifies nobody", mentionsIn("@stranger hello", people).length === 0);
  rec("the same person mentioned twice is notified once", mentionsIn("@robert @robert", people).length === 1);

  const thread = { id: "t", kind: "file", fileId: "f", participantIds: ["a", "b", "c"] };
  rec("a message notifies the other participants", recipientsOf(thread, "a").length === 2);
  rec("and never the author", !recipientsOf(thread, "a").includes("a"));
}

// =====================================================================
// Recurrence. Every date fixed, so nothing drifts.
// =====================================================================
{
  const iso = (d) => d.toISOString().slice(0, 10);

  rec("weekly adds seven days", iso(nextOccurrence("weekly", new Date("2026-03-02T09:00:00"))) === "2026-03-09");
  rec("monthly adds a month", iso(nextOccurrence("monthly", new Date("2026-03-02T09:00:00"))) === "2026-04-02");
  rec("quarterly adds three months", iso(nextOccurrence("quarterly", new Date("2026-01-15T09:00:00"))) === "2026-04-15");
  rec("annually adds a year", iso(nextOccurrence("annually", new Date("2026-03-02T09:00:00"))) === "2027-03-02");

  /*
   * The one that matters. A task due on the 31st, repeating monthly, must land
   * on the last day of February and not roll into March: a compliance task that
   * silently moves into the next month is one that gets filed late.
   */
  rec("the 31st repeating monthly clamps to the end of February", iso(nextOccurrence("monthly", new Date("2026-01-31T09:00:00"))) === "2026-02-28");
  rec("and does not roll into March", !iso(nextOccurrence("monthly", new Date("2026-01-31T09:00:00"))).startsWith("2026-03"));
  rec("the 31st repeating monthly into a 30 day month clamps too", iso(nextOccurrence("monthly", new Date("2026-03-31T09:00:00"))) === "2026-04-30");
  rec("a leap year February is respected", iso(nextOccurrence("monthly", new Date("2028-01-31T09:00:00"))) === "2028-02-29");
  rec("December rolls the year", iso(nextOccurrence("monthly", new Date("2026-12-10T09:00:00"))) === "2027-01-10");
  rec("every recurrence in the list is handled", RECURRENCES.every((r) => nextOccurrence(r, new Date("2026-06-15T09:00:00")) instanceof Date));
}

// =====================================================================
// The firm's real compliance calendar.
// =====================================================================
{
  rec("each seed has a unique key", new Set(COMPLIANCE_SEEDS.map((s) => s.key)).size === COMPLIANCE_SEEDS.length);
  rec("each has a real description rather than a restated title", COMPLIANCE_SEEDS.every((s) => s.description.length > 60));
  rec("each recurs on a rule the module understands", COMPLIANCE_SEEDS.every((s) => RECURRENCES.includes(s.recurrence)));

  /*
   * Named by hand, from the operator's list, so dropping one is a failure rather
   * than a smaller number. These are the obligations that go wrong quietly:
   * nothing breaks on the day, and the consequence arrives months later attached
   * to work already delivered.
   */
  const MUST_EXIST = [
    "pe_licence_renewal",
    "dwc_005_filing",
    "tbpels_registration_renewal",
    "eo_policy_renewal",
    "credential_sweep",
  ];
  for (const key of MUST_EXIST) {
    rec(`the ${key} obligation is seeded`, COMPLIANCE_SEEDS.some((s) => s.key === key));
  }

  const pe = COMPLIANCE_SEEDS.find((s) => s.key === "pe_licence_renewal");
  rec("the PE licence renewal is annual", pe?.recurrence === "annually");
  rec("and anchored to 30 September, as the operator gave it", pe?.anchor?.month === 9 && pe?.anchor?.day === 30);
  rec("and is urgent, because an expired licence taints work already sealed", pe?.priority === "urgent");

  const dwc = COMPLIANCE_SEEDS.find((s) => s.key === "dwc_005_filing");
  rec("the DWC-005 filing is annual", dwc?.recurrence === "annually");
  /*
   * The window is stated from general knowledge, not from the Division. This
   * repo's rule is that a number which cannot be traced to a primary source is
   * marked unverified rather than repeated as fact, and a compliance deadline is
   * the last place to break it.
   */
  rec("the DWC-005 window is flagged as needing confirmation", dwc?.needsConfirmation === true);
  /*
   * Tests the intent, not a sentence. The first version matched an exact phrase
   * and failed the moment the wording improved, which teaches whoever hits it to
   * edit the assertion rather than think about it.
   */
  rec(
    "and the task itself points at the Division as the authority",
    /with the Division/i.test(dwc?.description ?? ""),
  );
  rec(
    "and says the anchor is provisional until then",
    /provisional|not a primary source/i.test(dwc?.description ?? ""),
  );

  /*
   * The two with no known date. A guessed renewal date is worse than an empty
   * one: an empty field asks a question, a wrong date answers it incorrectly and
   * then stops asking.
   */
  for (const key of ["tbpels_registration_renewal", "eo_policy_renewal"]) {
    const seed = COMPLIANCE_SEEDS.find((s) => s.key === key);
    rec(`${key} carries no invented due date`, seed?.anchor === null);
    /*
     * The description has to say WHERE the real date comes from, so the empty
     * field is a question with an answer rather than an oversight. The operator
     * supplied both on 2026-09-02: the TBPELS date is set on launch day, one
     * year from issuance, and the errors and omissions date when the policy
     * binds.
     */
    rec(
      `and says where its real date comes from`,
      /set on launch day|one year from issuance|when the policy binds|declarations page|registration certificate/i.test(
        seed?.description ?? "",
      ),
      seed?.description?.slice(0, 50),
    );
  }

  rec(
    "no seed is anchored to a date nobody supplied",
    COMPLIANCE_SEEDS.filter((s) => s.anchor).every((s) => ["pe_licence_renewal", "dwc_005_filing"].includes(s.key)),
    COMPLIANCE_SEEDS.filter((s) => s.anchor).map((s) => s.key).join(", "),
  );

  // First due dates, at fixed clocks so nothing drifts.
  const before = new Date("2026-03-01T09:00:00");
  const after = new Date("2026-10-05T09:00:00");
  const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);

  rec("the PE renewal falls this year when September is still ahead", iso(firstDueFor(pe, before)) === "2026-09-30");
  rec("and next year once it has passed", iso(firstDueFor(pe, after)) === "2027-09-30");
  rec("an unanchored obligation gets no due date at all", firstDueFor(COMPLIANCE_SEEDS.find((s) => s.key === "eo_policy_renewal"), before) === null);
  rec(
    "an obligation due today is due today rather than next year",
    iso(firstDueFor(pe, new Date("2026-09-30T00:00:00"))) === "2026-09-30",
  );
}

// =====================================================================
// Credentials become tasks.
// =====================================================================
{
  const cred = (over) => ({
    credentialId: over.credentialId ?? "c1",
    profileId: over.profileId ?? "p1",
    personName: over.personName ?? "Demo Tech",
    kindLabel: over.kindLabel ?? "Vehicle insurance",
    expiresOn: over.expiresOn ?? "2026-10-01",
    state: over.state,
  });

  const all = [
    cred({ credentialId: "a", state: "current", expiresOn: "2027-01-01" }),
    cred({ credentialId: "b", state: "expiring", expiresOn: "2026-09-20" }),
    cred({ credentialId: "c", state: "expired", expiresOn: "2026-08-01" }),
  ];
  const tasks = credentialTasks(all);

  rec("a current credential produces no task", tasks.length === 2, `${tasks.length} tasks`);
  rec("an expiring one does", tasks.some((t) => t.key === "credential:b"));
  rec("an expired one does", tasks.some((t) => t.key === "credential:c"));

  /*
   * An expired credential is already stopping the technician being dispatched.
   * A pending one is not yet, and calling both urgent would make urgent
   * meaningless on the list where it has to mean something.
   */
  rec("an expired credential is urgent", tasks.find((t) => t.key === "credential:c")?.priority === "urgent");
  rec("an expiring one is high rather than urgent", tasks.find((t) => t.key === "credential:b")?.priority === "high");

  rec("the task names the person", tasks.every((t) => t.title.includes("Demo Tech")));
  rec("and the document", tasks.every((t) => t.title.includes("Vehicle insurance")));
  rec("and the date", tasks.every((t) => /20\d\d-\d\d-\d\d/.test(t.title)));
  rec(
    "an expired one says dispatch is already refusing",
    /already refusing/i.test(tasks.find((t) => t.key === "credential:c")?.description ?? ""),
  );

  /*
   * The key is derived from the credential, so a second sweep updates one task
   * rather than producing two. A duplicated compliance task is one somebody
   * closes without doing, because the other copy makes it look handled.
   */
  const again = credentialTasks(all);
  rec("running the sweep twice produces the same keys", JSON.stringify(tasks.map((t) => t.key)) === JSON.stringify(again.map((t) => t.key)));
  rec("keys are unique within a sweep", new Set(tasks.map((t) => t.key)).size === tasks.length);

  /*
   * The due date is the expiry itself. Padding it invents a second, softer
   * deadline that people then treat as the real one.
   */
  rec("the task is due on the expiry, not before it", tasks.find((t) => t.key === "credential:b")?.dueAt.startsWith("2026-09-20"));
  rec("an empty credential list produces no tasks", credentialTasks([]).length === 0);
}

// =====================================================================
// Tasks.
// =====================================================================
{
  const mine = { assigneeId: "tech-1", createdBy: "admin-1", fileId: null };
  const theirs = { assigneeId: "tech-2", createdBy: "admin-1", fileId: null };
  const orphan = { assigneeId: null, createdBy: null, fileId: null };

  rec("the assignee sees their task", canSeeTask(tech, mine));
  rec("somebody else's task is not visible", !canSeeTask(tech, theirs));
  rec("the creator sees a task they assigned away", canSeeTask(admin, theirs));
  rec("an administrator sees everything", canSeeTask(admin, mine));
  /*
   * A compliance task nobody owns must not be invisible until somebody claims
   * it. That is exactly the task that gets missed.
   */
  rec("an unassigned task is visible to administrators", canSeeTask(admin, orphan));
  rec("but not to a technician", !canSeeTask(tech, orphan));
  rec("a suspended person sees no tasks", !canSeeTask({ ...tech, status: "suspended" }, mine));
  rec("a signed out actor sees none", !canSeeTask(null, mine));

  const NOW = new Date("2026-03-15T12:00:00");
  rec("a task with no due date is never overdue", !isOverdue(null, NOW));
  rec("a task due tomorrow is not overdue", !isOverdue("2026-03-16T09:00:00", NOW));
  /*
   * By calendar day. A task due at nine this morning is not overdue at noon on
   * the same day: an operator working through a list should not be told they
   * are late on something they are about to do.
   */
  rec("a task due earlier today is not overdue", !isOverdue("2026-03-15T09:00:00", NOW));
  rec("a task due yesterday is overdue", isOverdue("2026-03-14T23:00:00", NOW));
  rec("a malformed due date is not overdue", !isOverdue("not-a-date", NOW));
}

console.log("============ TASKS, THREADS, NOTIFICATIONS ============");
console.log("who can see a conversation, and what reaches somebody outside the app\n");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. A private thread stays private, including from an administrator.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
