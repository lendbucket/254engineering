/**
 * MAY THIS FIRM OFFER THIS SERVICE LINE? Operator ruling, 2026-09-16.
 *
 * THE CONSERVATIVE RULE, AND IT IS CONSERVATIVE ON PURPOSE. A service line is
 * offerable only when all three are true:
 *
 *   1. a protocol exists for it,
 *   2. approved by an engineer whose declared competence covers it,
 *   3. and the protocol DECLARES the discipline it requires.
 *
 * NOTHING IS INFERRED FROM A SERVICE LINE'S NAME. Whether a roof certification
 * is structural work is the engineer's answer and not a reading of the word
 * "roof". So a protocol that has not declared its discipline blocks its line,
 * and the block says so rather than guessing.
 *
 * WHY IT IS BUILT THIS WAY RATHER THAN AS A LIST. Today there is one engineer
 * who seals structural work only. The obvious shortcut is to check the line
 * against that one fact. But the shape has to survive a second engineer, and a
 * fourth, without anybody rewriting it: each engineer declares what he seals,
 * each protocol declares what it requires, and the gate asks whether ANY active
 * engineer covers the protocol. One engineer and four behave identically.
 *
 * PURE. No database, no environment, no module constants read at load. Every
 * argument is passed in, so the audit exercises the RULE with four engineers
 * and three protocols without the register being in any particular state. That
 * is the vacuous-green lesson: a rule checked only against live data is
 * exercised for the first time on the day the data changes.
 */

export type SealingEngineer = {
  name: string;
  /** What he will actually seal. Narrower than the licence branch where he says so. */
  sealsOnly: string[];
  /** ISO date, or null meaning nobody has recorded it. */
  expires: string | null;
};

export type LineProtocol = {
  serviceSlug: string;
  documentNumber: string;
  /**
   * The discipline this protocol requires an engineer to hold competence in.
   * NULL means the engineer has not answered yet, which blocks the line.
   */
  requiresDiscipline: string | null;
};

export type LineBlock = {
  serviceSlug: string;
  /** The sentence a reader gets. Never a boolean. */
  because: string;
  /** What would clear it, so the block is actionable rather than a refusal. */
  clearedBy: string;
};

/** A licence with no recorded expiry is not current. Same rule as the gate uses. */
function current(expires: string | null, todayISO: string): boolean {
  if (typeof expires !== "string" || expires === "") return false;
  return expires >= todayISO;
}

/**
 * Every reason a line may not be offered, one sentence each.
 *
 * Returns an empty array when the line is offerable. A line with no protocol at
 * all is blocked by the launch gate's protocols condition and is reported here
 * too, because a reader asking why a line is a waitlist wants one answer.
 */
export function lineBlocks(
  serviceSlugs: string[],
  protocols: LineProtocol[],
  engineers: SealingEngineer[],
  todayISO: string,
): LineBlock[] {
  const blocks: LineBlock[] = [];
  const activeEngineers = engineers.filter((e) => current(e.expires, todayISO));

  for (const slug of serviceSlugs) {
    const protocol = protocols.find((p) => p.serviceSlug === slug);

    if (!protocol) {
      blocks.push({
        serviceSlug: slug,
        because: "No protocol exists for this service line.",
        clearedBy: "An engineer of record writes and signs a protocol for it.",
      });
      continue;
    }

    if (!protocol.requiresDiscipline) {
      blocks.push({
        serviceSlug: slug,
        because: `${protocol.documentNumber} does not declare the discipline it requires, and it is not inferred from the service line's name.`,
        clearedBy: "The engineer of record states which discipline the protocol requires.",
      });
      continue;
    }

    const covering = activeEngineers.filter((e) => e.sealsOnly.includes(protocol.requiresDiscipline as string));
    if (covering.length === 0) {
      const anyone = engineers.filter((e) => e.sealsOnly.includes(protocol.requiresDiscipline as string));
      blocks.push({
        serviceSlug: slug,
        because:
          anyone.length > 0
            ? `${protocol.documentNumber} requires ${protocol.requiresDiscipline}, and the engineers who seal it hold no current licence.`
            : `${protocol.documentNumber} requires ${protocol.requiresDiscipline}, and no engineer on record seals that.`,
        clearedBy:
          anyone.length > 0
            ? "Record a current license expiry for that engineer."
            : "Add an engineer who declares that discipline, or the engineer of record extends what he seals.",
      });
    }
  }

  return blocks;
}

/** The lines whose protocol has not yet declared a discipline. The list for the engineer. */
export function linesAwaitingDiscipline(serviceSlugs: string[], protocols: LineProtocol[]): string[] {
  return serviceSlugs.filter((slug) => {
    const p = protocols.find((x) => x.serviceSlug === slug);
    return !p || !p.requiresDiscipline;
  });
}
