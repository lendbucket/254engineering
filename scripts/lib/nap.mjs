/**
 * ONE NAME, ADDRESS AND PHONE, READ OFF A RENDERED PAGE.
 * Robert's instruction of 2026-10-26, 15:57 Central, piece 4 of the
 * link-building work: the same name, address and phone everywhere.
 *
 * A citation, a directory listing and a knowledge panel each take the firm's
 * name, address and phone from whatever the page shows, and a mismatch between
 * two of them is read as two businesses. So the question is asked of the RENDER,
 * not of src/config/contact.ts, because the config can be right while a page is
 * not, and that is the shape of the 2026-09-14 telephone defect.
 *
 * THE EXPECTED VALUES ARE NOT HERE. seo-audit pins them as literals and passes
 * them in, so this module never reads the config it is checking: an audit that
 * imports its expectation from the code under test compares a value to itself.
 *
 * WHAT IT READS, AND IN WHAT FORM.
 *   - The footer, as text nodes. Each of the three must appear as a whole text
 *     node, exactly, so "254 Engineering LLC" does not count as the name and a
 *     phone split across two nodes does not count as the phone.
 *   - The Organization node of the JSON-LD, in the forms schema.org asks for:
 *     `name` exactly; `telephone` as the E.164 of the pinned phone; `address`
 *     as a PostalAddress whose parts, joined, are the pinned address line;
 *     and, since 2026-10-29, one `openingHoursSpecification` with the pinned
 *     days, opening and closing time. The footer carries the hours sentence
 *     as a text of its own, the same as the other three.
 *
 * Pure, so it is proved against pages built to be right and wrong
 * (scripts/proofs/one-name-address-and-phone-everywhere.mjs) without a server.
 */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** The first <footer> element's text nodes, decoded and trimmed, empty ones dropped. */
export function footerTextNodes(html) {
  const footer = html.match(/<footer[\s>][\s\S]*?<\/footer>/i);
  if (!footer) return null;
  return footer[0]
    .replace(/<!--[\s\S]*?-->/g, "<>")
    .split(/<[^>]*>/)
    .map((t) => decodeEntities(t).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** The digits of a display phone as E.164, from the pinned value only. */
export function e164Of(display) {
  const digits = String(display).replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? `+1${ten}` : null;
}

/**
 * Every way this page's name, address and phone differ from the pinned three.
 * An empty list means the page agrees. `jsonLd` is the page's parsed JSON-LD
 * blocks, as seo-audit's extractor returns them.
 */
export function napFindings(route, html, jsonLd, expected) {
  const { name, address, phone, hours } = expected;
  const findings = [];
  /*
   * THE HOURS JOINED THE THREE ON 2026-10-29, when Robert gave them. They are
   * required rather than optional: an expectation that may be left out is a
   * check a caller can switch off by forgetting it.
   */
  if (!hours || !hours.line || !Array.isArray(hours.days)) {
    findings.push(`${route}: no hours were passed to check against, so the hours could not be read`);
  }

  const nodes = footerTextNodes(html);
  if (!nodes) {
    findings.push(`${route}: no footer, so its name, address and phone could not be read`);
  } else {
    for (const [label, value] of [["name", name], ["address", address], ["phone", phone], ["hours", hours?.line]]) {
      if (value === undefined) continue;
      if (!nodes.includes(value)) {
        findings.push(`${route}: the footer does not render the ${label} "${value}" as a text of its own`);
      }
    }
  }

  const org = (jsonLd ?? []).find(
    (d) => d && [].concat(d["@type"] ?? []).includes("Organization") && d["@id"],
  );
  if (!org) {
    findings.push(`${route}: no Organization node, so the schema's name, address and phone could not be read`);
    return findings;
  }
  if (org.name !== name) findings.push(`${route}: the Organization name is "${org.name}", expected "${name}"`);
  const tel = e164Of(phone);
  if (org.telephone !== tel) {
    findings.push(`${route}: the Organization telephone is "${org.telephone}", expected "${tel}" (${phone})`);
  }
  const a = org.address;
  const line =
    a && typeof a === "object"
      ? `${a.streetAddress}, ${a.addressLocality}, ${a.addressRegion} ${a.postalCode}`
      : null;
  if (line !== address) {
    findings.push(`${route}: the Organization address reads "${line ?? "(none)"}", expected "${address}"`);
  }
  if (hours && Array.isArray(hours.days)) {
    const specs = [].concat(org.openingHoursSpecification ?? []);
    const want = hours.days.map((d) => `https://schema.org/${d}`).join(",");
    const got = specs
      .map((s) => `${[].concat(s?.dayOfWeek ?? []).join(",")} ${s?.opens}-${s?.closes}`)
      .join(" | ");
    if (specs.length !== 1 || got !== `${want} ${hours.opens}-${hours.closes}`) {
      findings.push(
        `${route}: the Organization opening hours read "${got || "(none)"}", expected "${want} ${hours.opens}-${hours.closes}"`,
      );
    }
  }
  return findings;
}
