/**
 * THE ONE RULE FOR "WHAT YOU RECEIVE". Robert, 09:28 Central 2026-10-30.
 *
 * Every catalogue deliverable's `receives` and every service page's
 * `deliverable` either quotes its own protocol in force, sentence by sentence,
 * or carries the operator's pending sentence alone. A line whose protocol is in
 * force may carry no pre-signature wording of any spelling.
 *
 * Read by protocol-registry-audit (which also compares the paper-signed
 * 254-RC-001 against its PDF, fetched from the private bucket) and by
 * scripts/proofs/a-deliverable-quotes-its-protocol-in-force.mjs (which the
 * preflight runs, and which skips the paper-signed lines it cannot fetch).
 *
 * WHICH PROTOCOLS ARE IN FORCE, AS THE CODE DECLARES IT. The portal signatures
 * of ruling 11 live in the database, which neither caller reads. What the code
 * declares is the set 0081 put in force on production (its read-back in
 * supabase/applied.mjs, 2026-10-23: DS, FC, MH, PL, RS, SL and WS, no WP), which
 * is SIGNABLE_PROTOCOLS less HELD_OUT_OF_FORCE, DS having since been withdrawn
 * from signing, plus the paper-signed entries of PROTOCOL_ENTRIES. A signature
 * voided later closes the line at the gate without this list knowing; the
 * quoted text stays the protocol's own words either way.
 */

/** Pre-signature wording of any spelling, not only the operator's sentence. */
export const PRE_SIGNATURE = [
  /published here once/i,
  /once the engineer of record signs/i,
  /until the engineer (?:of record )?signs/i,
  /awaiting (?:the engineer|signature|his signature)/i,
  /(?:protocol|scope) (?:is )?not yet signed/i,
];

const squash = (s) => s.replace(/\s+/g, "");

/**
 * The protocol in force for a line, or null. `paperText(entry)` returns the
 * squashed text of a paper-signed protocol's PDF, null when it could not be
 * read, or undefined when the caller does not compare paper-signed lines.
 */
export function inForceResolver({ PROTOCOL_ENTRIES, SIGNABLE_PROTOCOLS, HELD_OUT_OF_FORCE, paperText }) {
  const inForceFor = (d) => {
    const paper = PROTOCOL_ENTRIES.find(
      (p) => p.declaration.serviceSlug === d.serviceSlug && p.signatureEvidence !== null,
    );
    if (paper) return { documentNumber: paper.declaration.documentNumber, kind: "paper", text: () => paperText(paper) };
    const portal = SIGNABLE_PROTOCOLS.find(
      (p) =>
        p.serviceSlug === d.serviceSlug &&
        !HELD_OUT_OF_FORCE[p.documentNumber] &&
        (p.serviceTier === null || d.tier === "page" || p.serviceTier === d.tier),
    );
    if (portal) return { documentNumber: portal.documentNumber, kind: "portal", text: () => squash(portal.text.join("")) };
    return null;
  };
  const inForceSet = [
    ...PROTOCOL_ENTRIES.filter((p) => p.signatureEvidence !== null).map((p) => p.declaration.documentNumber),
    ...SIGNABLE_PROTOCOLS.filter((p) => !HELD_OUT_OF_FORCE[p.documentNumber]).map((p) => p.documentNumber),
  ];
  return { inForceFor, inForceSet };
}

/**
 * Checks every entry. An entry is { serviceSlug, tier, receives, _key? }.
 * `pendingSentence` is the caller's own literal of the operator's wording, so a
 * reworded sentence in the catalogue is a red rather than a new expectation.
 * Returns the failures and what was quoted, pending, skipped or unread.
 */
export function checkReceives(entries, inForceFor, pendingSentence) {
  const wrong = [];
  const quoted = [];
  const pending = [];
  const skipped = [];
  let itemsCompared = 0;
  let unread = 0;
  for (const d of entries) {
    const where = d._key ?? `${d.serviceSlug}/${d.tier}`;
    const signed = inForceFor(d);
    const preSignature = d.receives.filter((r) => PRE_SIGNATURE.some((re) => re.test(r)));
    if (signed && preSignature.length) {
      wrong.push(`${where}: its protocol ${signed.documentNumber} is in force, so pre-signature wording is false: "${preSignature[0].slice(0, 70)}"; quote the protocol`);
      continue;
    }
    if (d.receives.length === 1 && d.receives[0] === pendingSentence) {
      pending.push(where);
      continue;
    }
    if (!signed) {
      wrong.push(`${where}: no protocol in force, so it must carry the pending sentence alone, and carries ${d.receives.length} item(s) of its own`);
      continue;
    }
    const doc = signed.text();
    if (doc === undefined) {
      skipped.push(where);
      continue;
    }
    if (doc === null) {
      unread++;
      continue;
    }
    const missing = d.receives.filter((r) => !doc.includes(squash(r)));
    itemsCompared += d.receives.length;
    if (d.receives.length === 0) wrong.push(`${where}: an empty list says nothing at all`);
    else if (missing.length) wrong.push(...missing.map((m) => `${where}: not a sentence of ${signed.documentNumber}: "${m.slice(0, 70)}"`));
    else quoted.push(`${where} (${d.receives.length} from ${signed.documentNumber})`);
  }
  return { wrong, quoted, pending, skipped, itemsCompared, unread };
}

/** Catalogue lines and service pages, as the entries checkReceives reads. */
export function receivesEntries(catalog, services) {
  return [
    ...catalog.CATALOG,
    ...services.map((s) => ({
      serviceSlug: s.slug,
      tier: "page",
      receives: s.deliverable,
      notes: s.notes,
      _key: `service:${s.slug}`,
    })),
  ];
}
