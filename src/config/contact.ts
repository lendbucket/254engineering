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

/**
 * ============================================================================
 * THE NAP RECORD. ONE SOURCE FOR NAME, ADDRESS AND PHONE, IN BOTH FORMS.
 * ============================================================================
 *
 * Operator instruction, 2026-09-14, written down before the Google Business
 * Profile is set up rather than reconstructed afterwards.
 *
 * NAP consistency means the same value in every place a machine or a person can
 * read it: the site, the schema.org markup, email footers, the capability
 * statement, and the listing. Two forms exist and they are NOT alternatives,
 * they are the same fact written for two audiences.
 *
 *   MACHINE-READABLE, and what is STORED:     +12819404490
 *     FIRM_PHONE, schema.org `telephone`, every `tel:` href. E.164.
 *
 *   HUMAN-READABLE, and DERIVED, never typed: (281) 940-4490
 *     Site copy, email footers, the capability statement, the Google Business
 *     Profile. Exactly what `displayPhone()` below produces, so the site and the
 *     listing agree character for character.
 *
 * **THE HUMAN FORM IS NEVER STORED ANYWHERE IN THIS REPOSITORY.** It is derived
 * from the stored E.164 value on every render. That is the whole design and it
 * is why the number cannot drift between surfaces: there is one value, and the
 * rest are functions of it.
 *
 * WHEN SETTING THE LISTING BY HAND, the form to type into the Google Business
 * Profile is the HUMAN one, because that is what the site renders and a listing
 * that disagrees with the site on punctuation is a NAP mismatch even though
 * both dial the same number.
 *
 * Name and address are the other two thirds and are not settled here: the legal
 * name is 254 Services LLC, the brand wordmark is 254 Engineering Services, and
 * which one a listing carries is the operator's decision. See the operating name
 * condition in src/lib/launch.ts, which is why the compliance gate is shut.
 */
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
   * ==========================================================================
   * THE FIRM'S PLACE OF BUSINESS. Operator, 2026-09-18.
   * ==========================================================================
   *
   * 5601 South Padre Island Drive, Suite E, Corpus Christi, TX 78412. Supplied
   * by the operator, who confirmed it matches the support address Stripe holds.
   *
   * DECLARED RATHER THAN READ FROM THE ENVIRONMENT, AND THAT IS A DELIBERATE
   * DEPARTURE FROM THE INSTRUCTION'S LETTER. The operator said to treat it "the
   * same as the phone", and the phone is four environment variables. Two
   * reasons not to copy that here, both of which this repository has already
   * paid for:
   *
   * 1. An environment variable can differ between a build and a deployment,
   *    which is the exact defect that moved the TBPELS firm number and then the
   *    PE licence number out of the environment and into a register. A firm's
   *    address is the same kind of fact: one somebody checks against an
   *    external record.
   * 2. Practically, an environment variable means the address does not appear
   *    in production until somebody edits Vercel, and the instruction was to
   *    render it. Declared here, it deploys with the code.
   *
   * `founder` below is the precedent and its reasoning is identical: not
   * environment driven, because it is already public.
   */
  street: "5601 South Padre Island Drive",
  street2: "Suite E",
  city: "Corpus Christi",
  postalCode: "78412",

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
 * THE NUMBER IN E.164, DERIVED, FOR ANYTHING A MACHINE READS.
 *
 * The header of this file has always said the stored value is E.164 and that
 * display formatting is derived so the two cannot drift. Every consumer honoured
 * that except one: `schema.tsx` emitted `contact.phone` RAW into the JSON-LD
 * `telephone` property, so whatever string happened to be in the environment
 * variable was published as the firm's machine-readable number.
 *
 * WHY THAT WAS THE DANGEROUS ONE. `displayPhone` and `telHref` both strip and
 * rebuild, so a display string set by mistake still renders and still dials
 * correctly, and the site looks perfect. The only surface that was wrong was the
 * one nobody reads by eye. It is the hardcoded compliance sentence from
 * 2026-09-12 with the failure inverted: there the human copy was stale and a
 * screenshot caught it; here the human copy is right and the machine copy is
 * wrong, and no screenshot can ever catch that.
 *
 * Returns null on anything it does not understand, for the same reason
 * `displayPhone` does: a half normalised number in a machine-readable field is
 * worse than no field at all, because a consumer will believe it.
 */
export function e164Phone(): string | null {
  if (!contact.phone) return null;
  const digits = contact.phone.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  return `+1${ten}`;
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

/**
 * The address on one line, for a footer, an email, or a capability statement.
 *
 * ONE HOME, DERIVED EVERYWHERE, WHICH IS THE OPERATOR'S INSTRUCTION AND CLOSES
 * A DEFECT THAT WAS ALREADY PRESENT. The firm's address had TWO homes before
 * this: `contact.street` and friends, read by the schema node, and
 * `mailingAddressLine()` in src/config/email-identity.ts, read from
 * MAIL_FROM_ADDRESS_LINE and rendered into every email footer.
 *
 * Neither was set, so the two could not yet disagree. That is precisely the
 * shape CLAUDE.md records about the PE licence number: a fact with two homes is
 * harmless while both are empty and becomes a live defect the first time
 * somebody fills one in. Today is that day, and filling in only one of them
 * would have put the firm's address in the schema and a different sentence, or
 * nothing at all, in the emails.
 *
 * This is the fifth instance of one fact with two homes in a fortnight.
 */
export function postalAddressLine(): string | null {
  if (!hasPostalAddress()) return null;
  return [
    [contact.street, contact.street2].filter(Boolean).join(", "),
    `${contact.city}, TX ${contact.postalCode}`,
  ].join(", ");
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
