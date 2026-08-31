/**
 * Name, address, phone. The one place any of them may come from.
 *
 * WHY THIS IS SEPARATE FROM business.ts
 * -------------------------------------
 * business.ts holds facts that are true and settled: the legal name, the domain,
 * the county count, the NAICS codes. Everything in this file is a fact the firm
 * has not published yet, and the distinction matters because these three values
 * are the ones that leak.
 *
 * A phone number, a street address, and a set of opening hours are exactly what
 * a page, a schema block, a footer, and a Google Business Profile all want at
 * once. That is four surfaces, and the moment the value exists in four places it
 * disagrees with itself in three of them. Worse, address and phone are the two
 * fields that get scraped into directories and knowledge panels and are close to
 * impossible to retract once wrong.
 *
 * EVERYTHING HERE DEFAULTS TO NULL, AND NULL MEANS THE SURFACE DISAPPEARS
 * ----------------------------------------------------------------------
 * Not a placeholder, not a 555 number, not "Corpus Christi, TX" standing in for
 * a street. Absent. A component that would render a phone number renders nothing
 * instead, schema omits the property rather than emitting an empty one, and the
 * Google Business Profile brief in docs/gbp-brief.md stays a brief rather than a
 * submission.
 *
 * This is the same shape as the launch gate in src/lib/launch.ts and for the same
 * reason: a fact that is not yet true is gated by configuration rather than by
 * somebody remembering not to type it.
 *
 * READ AT BUILD TIME
 * ------------------
 * The pages are statically prerendered, so setting any of these requires a
 * rebuild to take effect. That is deliberate. Publishing an address is a
 * deployment with an audit trail, not a runtime toggle.
 *
 * OWNER VERIFICATION, ALL OF IT
 * -----------------------------
 * None of these values are known to this build. They are not guessed anywhere,
 * including in schema, including in the location page, including in the GBP
 * brief. Robert supplies them; until then every dependent surface is absent and
 * the audits assert that it is.
 */

const env = (key: string): string | null => {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : null;
};

export const contact = {
  /**
   * E.164 for schema and tel: links. Display formatting is derived, never
   * stored, so the two cannot drift.
   *
   * OWNER VERIFICATION: a published number is a commitment to answer it during
   * the hours published beside it. Set FIRM_PHONE only when both are true.
   */
  phone: env("FIRM_PHONE"),

  /**
   * The street address of the firm's place of business.
   *
   * OWNER VERIFICATION: this must be an address where the firm can receive mail
   * and, for a Google Business Profile, one that can accept a verification
   * postcard. A residential address published here is published permanently.
   */
  street: env("FIRM_STREET"),
  street2: env("FIRM_STREET_2"),
  city: env("FIRM_CITY"),
  postalCode: env("FIRM_POSTAL_CODE"),

  /**
   * Coordinates of that address, for LocalBusiness geo.
   *
   * Omitted rather than approximated. A geo point that is off by half a mile is
   * worse than none, because a map pin is trusted absolutely by the person
   * driving to it.
   */
  latitude: env("FIRM_LATITUDE"),
  longitude: env("FIRM_LONGITUDE"),

  /**
   * Opening hours in schema.org openingHours syntax, comma separated.
   * Example shape only, not a default: "Mo-Fr 08:00-17:00".
   */
  hours: env("FIRM_HOURS"),
} as const;

/**
 * The founder, stated at entity level.
 *
 * This one is not environment driven because it is already public: it is the
 * name on the commits, on the SAM registration, and on the operator's own
 * correspondence. It carries no license claim and no title beyond founder, which
 * keeps it clear of the regulatory gate. Nothing here says engineer.
 */
export const founder = {
  name: "Robert Reyna",
} as const;

/** Whether a postal address complete enough to publish has been configured. */
export function hasPostalAddress(): boolean {
  return Boolean(contact.street && contact.city && contact.postalCode);
}

/** Whether a map point has been configured. Independent of the address. */
export function hasGeo(): boolean {
  return Boolean(contact.latitude && contact.longitude);
}

/**
 * The phone number as a person reads it, derived from the stored E.164 value.
 *
 * Returns null rather than a partially formatted string if the number is not in
 * the shape this formatter understands, because a half formatted phone number is
 * a typo in the reader's eyes and they will not try it.
 */
export function displayPhone(): string | null {
  if (!contact.phone) return null;
  const digits = contact.phone.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** The href for a tel: link, or null when there is no number to call. */
export function telHref(): string | null {
  if (!contact.phone) return null;
  const digits = contact.phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `tel:+${digits.length === 10 ? "1" : ""}${digits}`;
}

/**
 * The PostalAddress node, or null.
 *
 * addressRegion and addressCountry are constants because the firm is a Texas
 * firm by definition, which is what it is named after. They are not enough on
 * their own: a schema address with only a region is a claim to a location
 * without stating one, and this returns null rather than emit that.
 */
export function postalAddressSchema() {
  if (!hasPostalAddress()) return null;
  return {
    "@type": "PostalAddress" as const,
    streetAddress: [contact.street, contact.street2].filter(Boolean).join(", "),
    addressLocality: contact.city,
    addressRegion: "TX",
    postalCode: contact.postalCode,
    addressCountry: "US",
  };
}

/** The GeoCoordinates node, or null. */
export function geoSchema() {
  if (!hasGeo()) return null;
  return {
    "@type": "GeoCoordinates" as const,
    latitude: Number(contact.latitude),
    longitude: Number(contact.longitude),
  };
}
