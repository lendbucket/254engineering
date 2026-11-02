import { FIRM_TIME_ZONE, addBusinessDays } from "./firm-calendar";
import { isFirmHoliday } from "../config/firm-holidays";
import type { CrmStage } from "./crm-rules";

/**
 * THE CALL QUEUE'S RULES. Robert's sales CRM ruling of 2026-11-02, item R3,
 * with the sequence he approved as drafted the same day (issue #1 comment
 * 6587551356): call day 1, email day 2, call day 5, email day 9, call day 14,
 * then dormant; calling hours 8 AM to 8 PM Central; a call step due at 9:00 AM
 * Central on its day; a step that lands on a weekend or a firm holiday moves to
 * the next business day.
 *
 * Client safe and free of the database, so the screen, the route and the proof
 * read one table. The writes that carry these answers out are in crm-queue.ts.
 */

/* ------------------------------------------------------------ calling hours */

/** 8 AM to 8 PM in the firm's zone, America/Chicago. Robert, R3. */
export const CALLING_HOURS = { startHour: 8, endHour: 20 } as const;

/** The hour (0 to 23) and minute an instant reads in the firm's zone. */
export function firmClock(at: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FIRM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")), minute: Number(part("minute")) };
}

/** Null inside calling hours, or the sentence the screen shows outside them. */
export function callingHoursProblem(at: Date): string | null {
  const { hour } = firmClock(at);
  if (hour >= CALLING_HOURS.startHour && hour < CALLING_HOURS.endHour) return null;
  return "Calls are made between 8 AM and 8 PM Central. The queue opens again at 8 AM.";
}

/** The offset, in minutes east of UTC, that the firm's zone keeps at an instant. */
function zoneOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: FIRM_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -minutes : minutes;
}

/**
 * The instant a wall time on a calendar date reads in the firm's zone, with the
 * offset that date keeps, so a date either side of a daylight saving change
 * gets its own. Read twice because the offset at the guess can differ from the
 * offset at the answer near the change.
 */
export function firmInstant(date: string, hour: number, minute = 0): string | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute);
  let at = naive - zoneOffsetMinutes(new Date(naive)) * 60_000;
  at = naive - zoneOffsetMinutes(new Date(at)) * 60_000;
  return new Date(at).toISOString();
}

/* ----------------------------------------------------------------- sequence */

export type SequenceStep = { step: number; day: number; kind: "call" | "email" };

/** Robert's default sequence, every vertical (R7, approved 2026-11-02). */
export const SEQUENCE: readonly SequenceStep[] = [
  { step: 1, day: 1, kind: "call" },
  { step: 2, day: 2, kind: "email" },
  { step: 3, day: 5, kind: "call" },
  { step: 4, day: 9, kind: "email" },
  { step: 5, day: 14, kind: "call" },
];

/** The due time of a call step, 9:00 AM Central (the approved draft). */
export const CALL_DUE_HOUR = 9;

function isBusinessDay(date: string): boolean {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !isFirmHoliday(date);
}

/** A calendar date moved forward by whole days, then to the next business day if it is not one. */
export function onOrAfterBusinessDay(date: string, days: number): string {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  const day = at.toISOString().slice(0, 10);
  return isBusinessDay(day) ? day : (addBusinessDays(day, 1) ?? day);
}

/** The step a company is on: 0 has not started, so the first call is step 1. */
export function currentStep(sequenceStep: number): SequenceStep {
  return SEQUENCE.find((s) => s.step === Math.max(1, sequenceStep)) ?? SEQUENCE[0];
}

/**
 * The step after this one and when it is due: the days between the two steps
 * of the sequence, counted from today on the firm's calendar, moved off a
 * weekend or a holiday, at 9:00 AM Central. Null after the last step.
 */
export function nextStepAfter(sequenceStep: number, today: string): { step: SequenceStep; dueAt: string } | null {
  const here = currentStep(sequenceStep);
  const next = SEQUENCE.find((s) => s.step === here.step + 1);
  if (!next) return null;
  const day = onOrAfterBusinessDay(today, next.day - here.day);
  const dueAt = firmInstant(day, CALL_DUE_HOUR);
  return dueAt ? { step: next, dueAt } : null;
}

/* ----------------------------------------------------------------- outcomes */

export const CALL_OUTCOMES = [
  "no_answer",
  "voicemail",
  "callback",
  "interested",
  "not_interested",
  "wrong_number",
  "do_not_call",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  no_answer: "No answer",
  voicemail: "Left a voicemail",
  callback: "Call back",
  interested: "Interested",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  do_not_call: "Do not call",
};

/** The call log's own outcome word for each (0079's vocabulary), beside the CRM's (0111). */
export const LOG_OUTCOME: Record<CallOutcome, "no_answer" | "voicemail" | "reached" | "interested" | "not_interested" | "wrong_number"> = {
  no_answer: "no_answer",
  voicemail: "voicemail",
  callback: "reached",
  interested: "interested",
  not_interested: "not_interested",
  wrong_number: "wrong_number",
  do_not_call: "reached",
};

export type OutcomePlan = {
  stage: CrmStage;
  status: "open" | "not_interested";
  nextActionAt: string | null;
  nextActionKind: "call" | "email" | null;
  sequenceStep: number;
  /** Tags to add: "no_working_number" when every phone on file has been reported wrong. */
  addTags: string[];
  /** Do not call: every contact's email goes on the suppression list. */
  suppressEmails: boolean;
  /** Interested: the screen opens the conversion that already exists. */
  openConversion: boolean;
  /** The sentence the screen shows after the outcome is recorded. */
  said: string;
};

/**
 * WHAT EACH OUTCOME DOES, the approved table (6587551356), as one function:
 *
 *   no answer, voicemail   new moves to attempted; the next step of the sequence
 *   callback               connected; a call at the time given, inside calling hours; the sequence waits
 *   interested             interested; the existing conversion opens, prefilled
 *   not interested         dormant and not interested, with a reason; nothing next
 *   wrong number           stage unchanged; the next step if another phone on file has not been
 *                          reported wrong, otherwise held as "no working number"
 *   do not call            do not contact, for good; every contact's email suppressed
 *
 * After the last step, a call that is not answered leaves the company dormant.
 */
export function planOutcome(
  outcome: CallOutcome,
  current: { stage: CrmStage; sequenceStep: number },
  input: { callbackAt?: string | null; reason?: string | null; anotherWorkingPhone?: boolean },
  now: Date,
): { ok: true; plan: OutcomePlan } | { ok: false; error: string } {
  if (current.stage === "do_not_contact") return { ok: false, error: "This company asked not to be contacted. That is kept for good." };
  const today = firmClock(now).date;
  const step = Math.max(1, current.sequenceStep);
  const base = { addTags: [] as string[], suppressEmails: false, openConversion: false };

  const advance = (stage: CrmStage, said: string): { ok: true; plan: OutcomePlan } => {
    const next = nextStepAfter(step, today);
    if (!next) {
      return { ok: true, plan: { ...base, stage: "dormant", status: "open", nextActionAt: null, nextActionKind: null, sequenceStep: step, said: "That was the last step. The company is dormant now." } };
    }
    return { ok: true, plan: { ...base, stage, status: "open", nextActionAt: next.dueAt, nextActionKind: next.step.kind, sequenceStep: next.step.step, said } };
  };

  switch (outcome) {
    case "no_answer":
    case "voicemail": {
      const stage: CrmStage = current.stage === "new" ? "attempted" : current.stage;
      return advance(stage, "Recorded. The next step is scheduled.");
    }
    case "callback": {
      const at = input.callbackAt?.trim() ?? "";
      const when = Date.parse(at);
      if (!at || Number.isNaN(when)) return { ok: false, error: "Give the date and time to call back." };
      if (when <= now.getTime()) return { ok: false, error: "The callback time has to be later than now." };
      const hoursProblem = callingHoursProblem(new Date(when));
      if (hoursProblem) return { ok: false, error: "A callback is set between 8 AM and 8 PM Central." };
      return { ok: true, plan: { ...base, stage: "connected", status: "open", nextActionAt: new Date(when).toISOString(), nextActionKind: "call", sequenceStep: step, said: "The callback is on the queue at the time you set." } };
    }
    case "interested":
      return { ok: true, plan: { ...base, stage: "interested", status: "open", nextActionAt: null, nextActionKind: null, sequenceStep: step, openConversion: true, said: "Marked interested. Open the account for them next." } };
    case "not_interested": {
      if (!input.reason?.trim()) return { ok: false, error: "Say why they are not interested." };
      return { ok: true, plan: { ...base, stage: "dormant", status: "not_interested", nextActionAt: null, nextActionKind: null, sequenceStep: step, said: "Marked not interested. It leaves the queue." } };
    }
    case "wrong_number": {
      if (input.anotherWorkingPhone) return advance(current.stage, "Recorded. The next step tries another number on file.");
      return { ok: true, plan: { ...base, stage: current.stage, status: "open", nextActionAt: null, nextActionKind: null, sequenceStep: step, addTags: ["no_working_number"], said: "No working number is on file. The company is held until somebody adds one." } };
    }
    case "do_not_call":
      return { ok: true, plan: { ...base, stage: "do_not_contact", status: "not_interested", nextActionAt: null, nextActionKind: null, sequenceStep: step, suppressEmails: true, said: "Recorded as do not contact, for good. Their email addresses are on the suppression list." } };
    default:
      return { ok: false, error: "That is not an outcome the queue records." };
  }
}

/* -------------------------------------------------------------------- order */

export type QueueCandidate = {
  id: string;
  company: string;
  stage: CrmStage;
  score: number;
  nextActionAt: string | null;
  nextActionKind: "call" | "email" | null;
  ownerId: string | null;
};

/** Stages that never come up on the queue. */
export const OFF_QUEUE_STAGES: readonly CrmStage[] = ["do_not_contact", "dormant"];

/**
 * Whether a company is due a call now and is the rep's to call: their own or
 * nobody's (R5 adds the territory to this test, not a second test beside it).
 * A company nobody has scheduled yet is due if it is new: it starts the
 * sequence with its first call.
 */
export function isDueForCaller(c: QueueCandidate, callerId: string, now: Date): boolean {
  if (OFF_QUEUE_STAGES.includes(c.stage)) return false;
  if (c.ownerId && c.ownerId !== callerId) return false;
  if (c.nextActionKind === "email") return false;
  if (!c.nextActionAt) return c.stage === "new";
  return Date.parse(c.nextActionAt) <= now.getTime();
}

/** Due time first (a company never scheduled after every scheduled one), then the higher score, then the name. */
export function queueOrder(a: QueueCandidate, b: QueueCandidate): number {
  const at = (c: QueueCandidate) => (c.nextActionAt ? Date.parse(c.nextActionAt) : Number.POSITIVE_INFINITY);
  if (at(a) !== at(b)) return at(a) < at(b) ? -1 : 1;
  if (a.score !== b.score) return b.score - a.score;
  return a.company.localeCompare(b.company);
}
