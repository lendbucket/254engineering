/**
 * Which element Lighthouse took as the largest contentful paint, and where its
 * time went, read off one run's audits.
 *
 * A DIAGNOSTIC ONLY. Robert, 10:26 Central 2026-10-31: "Yes to the diagnostic
 * line naming each page's LCP element in the speed audit, no limit or verdict
 * changed." The ceilings are enforced in scripts/perf-audit.mjs and are not
 * touched here; this returns a description, never a verdict, and nothing it
 * returns is pushed into a check or changes an exit code.
 *
 * Why it exists: /coverage/coastal-bend measured 3,402ms on the board against
 * a 3,400ms ceiling, the map markup was cut by 27 KB and the LCP did not move,
 * and an earlier browser reading in TexasCountyMap.tsx says the element is the
 * prelaunch compliance paragraph, which is text. A fix aimed at the wrong
 * element is the move this line exists to stop.
 *
 * Lighthouse 13 carries it in `lcp-breakdown-insight`: a list whose first item
 * is a table of subparts (time to first byte, resource load delay, resource
 * load duration, element render delay) and whose second is the node. The two
 * resource subparts are present only when the element waits on a resource, so
 * their absence is what says the element is text.
 */

/**
 * @param {Record<string, any>} audits a Lighthouse result's `lhr.audits`
 * @returns {{ named: true, selector: string, label: string, snippet: string, text: boolean, subparts: Record<string, number> }
 *   | { named: false, reason: string }}
 */
export function lcpElementOf(audits) {
  const audit = audits?.["lcp-breakdown-insight"];
  if (!audit) return { named: false, reason: "Lighthouse returned no lcp-breakdown-insight audit" };
  const items = audit.details?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { named: false, reason: `lcp-breakdown-insight carried no details (score display: ${audit.scoreDisplayMode ?? "none"})` };
  }

  const subparts = {};
  const table = items.find((i) => i?.type === "table");
  for (const row of table?.items ?? []) {
    if (row?.subpart) subparts[row.subpart] = Math.round(Number(row.duration ?? 0));
  }

  const node = items.find((i) => i?.type === "node");
  if (!node) return { named: false, reason: "lcp-breakdown-insight carried timings but no node" };

  return {
    named: true,
    selector: String(node.selector ?? ""),
    label: String(node.nodeLabel ?? "").replace(/\s+/g, " ").trim(),
    snippet: String(node.snippet ?? "").replace(/\s+/g, " ").trim(),
    text: !("resourceLoadDelay" in subparts) && !("resourceLoadDuration" in subparts),
    subparts,
  };
}

/**
 * The element named most often across a route's runs, with how many runs named
 * it, so a route whose LCP element changes between runs says so rather than
 * reporting whichever run came last.
 *
 * @param {ReturnType<typeof lcpElementOf>[]} perRun
 */
export function lcpElementAcross(perRun) {
  const named = perRun.filter((e) => e.named);
  if (named.length === 0) {
    return { named: false, reason: perRun[0]?.reason ?? "no run", runs: perRun.length };
  }
  const counts = new Map();
  for (const e of named) counts.set(e.selector, (counts.get(e.selector) ?? 0) + 1);
  const [selector, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const pick = named.find((e) => e.selector === selector);
  return { ...pick, count, runs: perRun.length, distinct: counts.size };
}
