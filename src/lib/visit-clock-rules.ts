/**
 * THE VISIT CLOCK: WHEN THE TECHNICIAN ARRIVED AT THE PROPERTY AND LEFT IT.
 * Robert's T6, 2026-11-07: "navigation to the property, with the visit clock
 * recorded by the server, never by the phone."
 *
 * An arrival and a leaving are rows in eng_file_events, kinds `visit.arrived`
 * and `visit.left`, whose created_at is the column default, now(), on the
 * database. No time is ever read from the request: the phone says THAT it
 * arrived and the server says WHEN. A phone's clock can be wrong, set by hand,
 * or hours stale after a day with no signal, and a time on the firm's record of
 * a site visit is a fact somebody may later be asked to stand behind.
 *
 * The cost is stated rather than hidden: an arrival pressed with no signal
 * cannot be recorded at the moment it was pressed. Robert's answer 4 of
 * 2026-11-07 (6717223376): it needs signal, and says so when there is none; a
 * late press records the server's time of receipt, labelled as such. So a press
 * with no signal is held on the phone WITH NO TIME ATTACHED, sent when signal
 * returns marked late, and shown as "recorded when signal returned"
 * (src/app/portal/(app)/jobs/[id]/VisitClock.tsx).
 *
 * Pure, so the proof can run every rule with no database:
 * scripts/proofs/the-visit-clock-is-the-servers.mjs.
 */

export const VISIT_ARRIVED = "visit.arrived";
export const VISIT_LEFT = "visit.left";
export const VISIT_KINDS: readonly string[] = [VISIT_ARRIVED, VISIT_LEFT];

export type VisitAction = "arrive" | "leave";

export const VISIT_KIND_FOR: Record<VisitAction, string> = {
  arrive: VISIT_ARRIVED,
  leave: VISIT_LEFT,
};

/**
 * One row of the clock as the database recorded it. `late` is true when the
 * press was made with no signal and sent when signal returned (Robert's answer
 * 4, 2026-11-07, 6717223376): the time is still the server's, of receipt, and
 * it is labelled as such. The phone's own clock is never stored, late or not.
 */
export type VisitEvent = { kind: string; at: string; late?: boolean };

export type Visit = { arrivedAt: string; arrivedLate: boolean; leftAt: string | null; leftLate: boolean };

export type VisitState = {
  /** Every visit, oldest first. A return trip is a second visit, never an edit of the first. */
  visits: Visit[];
  /** True when the last thing recorded is an arrival. */
  onSite: boolean;
};

/**
 * The visits a list of rows describes, in the database's own order. Rows are
 * sorted by their recorded time here rather than trusted to arrive in the
 * sequence a query happened to return, and anything that is not a visit row is
 * ignored.
 */
export function visitState(events: VisitEvent[]): VisitState {
  const rows = events
    .filter((e) => VISIT_KINDS.includes(e.kind))
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const visits: Visit[] = [];
  for (const row of rows) {
    const open = visits.length > 0 && visits[visits.length - 1].leftAt === null;
    if (row.kind === VISIT_ARRIVED && !open) visits.push({ arrivedAt: row.at, arrivedLate: Boolean(row.late), leftAt: null, leftLate: false });
    if (row.kind === VISIT_LEFT && open) {
      visits[visits.length - 1].leftAt = row.at;
      visits[visits.length - 1].leftLate = Boolean(row.late);
    }
  }
  const last = visits[visits.length - 1];
  return { visits, onSite: Boolean(last && last.leftAt === null) };
}

/**
 * Whether this action may be recorded now. Null when it may, otherwise the
 * sentence the technician reads. Arriving twice without leaving, or leaving
 * without having arrived, would put a second time on the record for one fact,
 * and the record would then hold two answers to "when did they get there".
 */
export function visitRefusal(state: VisitState, action: VisitAction): string | null {
  if (action === "arrive" && state.onSite) {
    return "Your arrival is already recorded. Press Leaving when you go.";
  }
  if (action === "leave" && !state.onSite) {
    return "Record your arrival first. Leaving is recorded against an arrival.";
  }
  return null;
}

/** The action named in a request, or null when it names neither. */
export function visitActionFrom(value: unknown): VisitAction | null {
  return value === "arrive" || value === "leave" ? value : null;
}

/** Whether the request says the press was held for want of signal. Only a literal true counts. */
export function visitLateFrom(value: unknown): boolean {
  return value === true;
}
