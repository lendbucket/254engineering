import type { Actor, Role } from "./ops-authz";

/**
 * Tasks, threads, and notifications: who sees what, and what reaches them
 * where.
 *
 * PURE, BECAUSE THE VISIBILITY RULES ARE THE WHOLE RISK
 * -----------------------------------------------------
 * A messaging system is the easiest place in a platform to leak. A thread is
 * just rows, and the difference between "the people on this file" and "everyone"
 * is one forgotten filter. So every rule about who can see and post lives here,
 * pure, and is asserted exhaustively rather than trusted to a query somebody
 * wrote correctly the first time.
 *
 * THE SMS COLUMNS EXIST AND NOTHING SENDS SMS
 * -------------------------------------------
 * eng_notifications has smsed_at and eng_notification_prefs has sms, both from
 * the original schema, so adding a provider later is a configuration change
 * rather than a migration and a rewrite. What this module will NOT do is
 * pretend: channelsFor never returns sms as deliverable, because no provider is
 * wired, and a platform that records an SMS it never sent is worse than one that
 * has no SMS at all. The preference is stored and honoured the day a provider
 * exists.
 */

// ------------------------------------------------------------- notifications

export type NotificationKind =
  | "offer.received"
  | "offer.lost"
  | "file.assigned"
  | "evidence.submitted"
  | "review.revisions"
  | "review.refused"
  | "review.sealed"
  | "task.assigned"
  | "task.due"
  | "message.received"
  | "mention"
  | "credential.expiring"
  | "certification.revoked";

export type Channel = "in_app" | "email" | "sms";

export type KindSpec = {
  kind: NotificationKind;
  label: string;
  /** Which roles ever receive this at all. */
  roles: Role[];
  /** Whether email is on unless the person turns it off. */
  emailByDefault: boolean;
  /**
   * Email cannot be turned off for this kind.
   *
   * Reserved for the ones whose consequence lands OUTSIDE the platform: a
   * lapsed credential stops somebody being dispatched and a revoked
   * certification stops them working, and both are things a person needs to
   * learn even if they have muted everything else. Everything operational is
   * optional, because a notification somebody cannot silence is a notification
   * they learn to ignore.
   */
  mandatoryEmail?: boolean;
};

export const NOTIFICATION_KINDS: KindSpec[] = [
  { kind: "offer.received", label: "A job is offered to you", roles: ["field_tech", "admin"], emailByDefault: true },
  { kind: "offer.lost", label: "Another technician took a job you were offered", roles: ["field_tech"], emailByDefault: false },
  { kind: "file.assigned", label: "A file is assigned to you", roles: ["field_tech", "engineer", "admin"], emailByDefault: true },
  { kind: "evidence.submitted", label: "An evidence package is ready to review", roles: ["engineer", "admin"], emailByDefault: true },
  { kind: "review.revisions", label: "An engineer sent a file back", roles: ["field_tech", "admin"], emailByDefault: true },
  { kind: "review.refused", label: "An engineer declined to seal a file", roles: ["admin"], emailByDefault: true },
  { kind: "review.sealed", label: "A file was sealed", roles: ["admin"], emailByDefault: true },
  { kind: "task.assigned", label: "A task is assigned to you", roles: ["admin", "engineer", "field_tech"], emailByDefault: true },
  { kind: "task.due", label: "A task is due", roles: ["admin", "engineer", "field_tech"], emailByDefault: true },
  { kind: "message.received", label: "A new message in a thread you are in", roles: ["admin", "engineer", "field_tech"], emailByDefault: false },
  { kind: "mention", label: "Somebody mentioned you", roles: ["admin", "engineer", "field_tech"], emailByDefault: true },
  {
    kind: "credential.expiring",
    label: "One of your documents is expiring",
    roles: ["field_tech", "engineer", "admin"],
    emailByDefault: true,
    mandatoryEmail: true,
  },
  {
    kind: "certification.revoked",
    label: "A certification was withdrawn",
    roles: ["field_tech", "admin"],
    emailByDefault: true,
    mandatoryEmail: true,
  },
];

const KIND_BY_NAME = new Map(NOTIFICATION_KINDS.map((k) => [k.kind, k]));

export function kindSpec(kind: NotificationKind): KindSpec | null {
  return KIND_BY_NAME.get(kind) ?? null;
}

/** Kinds a role can ever receive, for rendering a preferences screen. */
export function kindsForRole(role: Role): KindSpec[] {
  return NOTIFICATION_KINDS.filter((k) => k.roles.includes(role));
}

export type Preference = { kind: NotificationKind; in_app: boolean; email: boolean; sms: boolean };

/**
 * Which channels a notification actually goes out on.
 *
 * IN APP IS ALWAYS ON, AND THAT IS NOT A PREFERENCE BEING IGNORED
 * ---------------------------------------------------------------
 * The in app notification IS the record that the event happened. A preference
 * that suppressed it would leave a row nobody can ever see, which is not a
 * quieter product, it is a hidden one. What the preference screen offers is
 * control over what reaches you ELSEWHERE, which is the thing that actually
 * interrupts somebody's evening.
 *
 * SMS IS NEVER RETURNED, WHATEVER THE PREFERENCE SAYS
 * ---------------------------------------------------
 * No provider is wired. The preference is stored, and honoured the day one is,
 * and until then this function will not claim a channel that does not exist. A
 * platform that records an SMS it never sent is worse than one with no SMS.
 */
export function channelsFor(
  kind: NotificationKind,
  role: Role,
  preference: Preference | null,
): Channel[] {
  const spec = kindSpec(kind);
  if (!spec) return [];
  if (!spec.roles.includes(role)) return [];

  const channels: Channel[] = ["in_app"];

  const emailWanted = spec.mandatoryEmail
    ? true
    : preference
      ? preference.email
      : spec.emailByDefault;
  if (emailWanted) channels.push("email");

  return channels;
}

/** Whether a person is allowed to turn this off. The screen renders it as fixed. */
export function emailIsMandatory(kind: NotificationKind): boolean {
  return kindSpec(kind)?.mandatoryEmail === true;
}

/** The default row for somebody who has never touched their preferences. */
export function defaultPreference(kind: NotificationKind): Preference {
  const spec = kindSpec(kind);
  return {
    kind,
    in_app: true,
    email: spec?.emailByDefault ?? true,
    // Stored as off. The column exists so a provider can be added without a
    // migration; nothing reads it as deliverable yet.
    sms: false,
  };
}

// ------------------------------------------------------------------- threads

export type ThreadKind = "file" | "direct" | "channel";

export type ThreadSubject = {
  id: string;
  kind: ThreadKind;
  fileId: string | null;
  /** Everyone explicitly on the thread. */
  participantIds: string[];
  /** For a channel: which roles may read it. */
  channelRoles?: Role[];
};

/**
 * Who may read a thread.
 *
 * THREE KINDS, THREE DIFFERENT ANSWERS, AND NO SHORTCUT
 * -----------------------------------------------------
 * A file thread follows the file: whoever can see the file can see the
 * conversation about it, because a technician who cannot read the note
 * explaining what was wrong with their photographs is a technician who repeats
 * it.
 *
 * A direct thread is its participants and NOBODY ELSE, administrators included.
 * That is a deliberate limit on the administrator role. An admin who can read
 * every private message is one nobody sends an honest message near, and the
 * platform is worse for it. Administrators can see that a thread exists, in the
 * audit trail, without seeing what was said.
 *
 * A channel is role scoped: an announcements channel for technicians, an
 * engineering channel, and so on.
 */
export function canReadThread(actor: Actor | null, thread: ThreadSubject, canSeeFile: boolean): boolean {
  if (!actor || actor.status !== "active") return false;

  if (thread.kind === "direct") {
    // No administrator override. See above; this is the point.
    return thread.participantIds.includes(actor.id);
  }

  if (thread.kind === "channel") {
    if (thread.participantIds.includes(actor.id)) return true;
    return (thread.channelRoles ?? []).includes(actor.role);
  }

  // A file thread follows the file.
  return canSeeFile;
}

/**
 * Who may post.
 *
 * The same people who may read, minus nobody. A read only participant is a
 * concept this platform does not have and does not need: if somebody can see a
 * conversation about a file they are working, they can answer it.
 */
export function canPostToThread(actor: Actor | null, thread: ThreadSubject, canSeeFile: boolean): boolean {
  return canReadThread(actor, thread, canSeeFile);
}

/** Everyone a new message should notify: participants, minus the author. */
export function recipientsOf(thread: ThreadSubject, authorId: string): string[] {
  return thread.participantIds.filter((id) => id !== authorId);
}

/**
 * Extract @mentions from a message body against the people on the thread.
 *
 * Matched against the thread's own participants rather than against every
 * profile, so a mention cannot be used to discover that somebody exists or to
 * notify a person who is not in the conversation.
 */
export function mentionsIn(
  body: string,
  participants: { id: string; displayName: string }[],
): string[] {
  const found = new Set<string>();
  const lower = body.toLowerCase();
  for (const person of participants) {
    const first = person.displayName.trim().split(/\s+/)[0]?.toLowerCase();
    if (!first || first.length < 2) continue;
    if (lower.includes(`@${first}`)) found.add(person.id);
  }
  return [...found];
}

// --------------------------------------------------------------------- tasks

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export const TASK_STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "done", "cancelled"];

/**
 * How a recurring task repeats.
 *
 * DELIBERATELY FOUR RULES AND NOT A CRON EXPRESSION
 * -------------------------------------------------
 * Everything this firm repeats is a compliance interval: a licence renews
 * annually, an insurance certificate is checked monthly, a filing is quarterly.
 * A cron expression would cover all of them and would also let somebody write a
 * task that fires every eleven minutes, and the person writing these is an
 * operator on a phone, not a systems administrator.
 */
export type Recurrence = "monthly" | "quarterly" | "annually" | "weekly";

export const RECURRENCES: Recurrence[] = ["weekly", "monthly", "quarterly", "annually"];

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every quarter",
  annually: "Every year",
};

/**
 * When the next occurrence is due.
 *
 * Month arithmetic clamps rather than rolling over. A task due on the 31st,
 * repeating monthly, lands on the 28th of February and not on the 3rd of March:
 * a compliance task that silently moves into the next month is one that gets
 * filed late.
 */
export function nextOccurrence(recurrence: Recurrence, from: Date): Date {
  const d = new Date(from.getTime());
  if (recurrence === "weekly") {
    d.setDate(d.getDate() + 7);
    return d;
  }

  const months = recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : 12;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export type ComplianceSeed = {
  key: string;
  title: string;
  description: string;
  recurrence: Recurrence;
  priority: TaskPriority;
  /**
   * The calendar day the obligation falls on, when the firm knows it.
   *
   * Null means the date is genuinely not known here, and the seeded task is
   * created WITHOUT a due date so the operator sets it. A guessed renewal date
   * is worse than an empty one: an empty field asks a question, and a wrong date
   * answers it incorrectly and then stops asking.
   */
  anchor: { month: number; day: number } | null;
  /**
   * The date or window is stated from general knowledge rather than checked
   * against the issuing authority.
   *
   * The task description says so and asks for confirmation. This repo's standing
   * rule is that a number which cannot be traced to a primary source is stated
   * as unverified rather than repeated as fact, and a compliance deadline is the
   * last place to break it.
   */
  needsConfirmation?: boolean;
};

/**
 * The firm's real recurring obligations, as given by the operator on
 * 2026-09-02.
 *
 * WHY THESE AND NOT A TIDY GENERIC LIST
 * -------------------------------------
 * Each one goes wrong quietly. Nothing breaks on the day a licence lapses or a
 * filing is missed; the consequence arrives months later, attached to work
 * already done, which is the worst possible time to find out. They are the
 * category nobody writes down because everybody assumes it is obvious.
 *
 * WHAT IS DATED HERE AND WHAT IS DELIBERATELY NOT
 * -----------------------------------------------
 * The PE licence renewal date came from the operator. The DWC-005 window is
 * stated from general knowledge and flagged for confirmation. The TBPELS and
 * errors and omissions renewals carry no date, because nobody has given one and
 * inventing a compliance deadline is worse than leaving a field that asks.
 */
export const COMPLIANCE_SEEDS: ComplianceSeed[] = [
  {
    key: "pe_licence_renewal",
    title: "Renew the engineer of record's Texas PE licence",
    description:
      "Due 30 September. An expired licence does not delay work sealed under it, it makes that work a problem, and the files are already delivered by the time anybody notices.",
    recurrence: "annually",
    priority: "urgent",
    anchor: { month: 9, day: 30 },
  },
  {
    key: "dwc_005_filing",
    title: "File the DWC-005 nonsubscriber notice with the Texas Division of Workers Compensation",
    description:
      "Required annually of an employer that does not carry workers compensation insurance. The filing window is believed to run from 1 February to 30 April. The operator is confirming the current dates and the current form with the Division; until that is done this description is not a primary source and the anchor below is provisional.",
    recurrence: "annually",
    priority: "urgent",
    anchor: { month: 2, day: 1 },
    needsConfirmation: true,
  },
  {
    key: "tbpels_registration_renewal",
    title: "Renew the TBPELS firm registration",
    description:
      "Renewal falls one year from issuance, so the date is set on launch day when the certificate arrives. Registration is pending as this task is seeded, and the firm cannot offer engineering services without it.",
    recurrence: "annually",
    priority: "urgent",
    anchor: null,
  },
  {
    key: "eo_policy_renewal",
    title: "Renew the errors and omissions policy",
    description:
      "Professional liability cover for the firm. The date is set when the policy binds, from the declarations page. A lapse here is not a paperwork problem, it is the firm carrying its own exposure on every file in flight.",
    recurrence: "annually",
    priority: "urgent",
    anchor: null,
  },
  {
    key: "credential_sweep",
    title: "Work the technician credential expiry list",
    description:
      "The roster flags anything expiring within 45 days and dispatch refuses anybody whose required documents have lapsed. This is the monthly look at the list, so a lapse is found here rather than by a job that cannot be offered to anyone.",
    recurrence: "monthly",
    priority: "high",
    anchor: null,
  },
];

/**
 * When a seeded task is first due.
 *
 * An anchored obligation lands on its next occurrence: if 30 September has
 * already passed this year, the first one is next year. An unanchored obligation
 * gets NO due date, so the operator is asked rather than told.
 */
export function firstDueFor(seed: ComplianceSeed, now: Date = new Date()): Date | null {
  if (!seed.anchor) return null;
  const thisYear = new Date(now.getFullYear(), seed.anchor.month - 1, seed.anchor.day);
  if (thisYear.getTime() >= now.getTime()) return thisYear;
  return new Date(now.getFullYear() + 1, seed.anchor.month - 1, seed.anchor.day);
}

// -------------------------------------------------- credentials become tasks

export type ExpiringCredential = {
  credentialId: string;
  profileId: string;
  personName: string;
  kindLabel: string;
  expiresOn: string;
  /** From ops-credentials.expiryState. */
  state: "current" | "expiring" | "expired";
};

export type DerivedTask = {
  /** Stable, so re-running the sweep updates rather than duplicates. */
  key: string;
  profileId: string;
  title: string;
  description: string;
  dueAt: string;
  priority: TaskPriority;
};

/**
 * Turn expiring credentials into tasks.
 *
 * WHY THIS IS DERIVED AND NOT SEEDED
 * ----------------------------------
 * The other obligations are the firm's own calendar and repeat whatever happens.
 * This one is a fact about data that changes every week: a technician renews an
 * insurance certificate and the task should disappear, another joins and a new
 * one should exist. Seeding a fixed task per technician would produce a list
 * that is wrong the moment anybody is onboarded.
 *
 * The key is derived from the credential id, so running the sweep twice updates
 * one task rather than producing two. A duplicated compliance task is one
 * somebody closes without doing, because the other copy makes it look handled.
 *
 * The due date is the EXPIRY itself, not some days before it. A task due the day
 * the cover ends is honest about the deadline; padding it invents a second,
 * softer date that people then treat as the real one.
 */
export function credentialTasks(credentials: ExpiringCredential[]): DerivedTask[] {
  return credentials
    .filter((c) => c.state === "expiring" || c.state === "expired")
    .map((c) => ({
      key: `credential:${c.credentialId}`,
      profileId: c.profileId,
      title:
        c.state === "expired"
          ? `${c.personName}: ${c.kindLabel} expired on ${c.expiresOn}`
          : `${c.personName}: ${c.kindLabel} expires ${c.expiresOn}`,
      description:
        c.state === "expired"
          ? "Dispatch is already refusing this technician for it. Collect the replacement document and record the new expiry on the roster."
          : "Collect the replacement before it lapses. Once it does, dispatch refuses this technician until it is replaced.",
      dueAt: `${c.expiresOn}T00:00:00.000Z`,
      // An expired credential is already stopping work. A pending one is not.
      priority: c.state === "expired" ? "urgent" : "high",
    }));
}

export type TaskSubject = {
  assigneeId: string | null;
  createdBy: string | null;
  fileId: string | null;
};

/**
 * Who may see a task.
 *
 * The person it is assigned to, the person who created it, and administrators.
 * An unassigned task is the firm's, so administrators see it: a compliance task
 * nobody owns must not be invisible until somebody claims it.
 */
export function canSeeTask(actor: Actor | null, task: TaskSubject): boolean {
  if (!actor || actor.status !== "active") return false;
  if (actor.role === "admin") return true;
  return task.assigneeId === actor.id || task.createdBy === actor.id;
}

/** Whether a task is overdue, by calendar day rather than by timestamp. */
export function isOverdue(dueAt: string | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const endOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
  return now.getTime() > endOfDueDay.getTime();
}
