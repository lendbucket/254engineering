/**
 * The channels a deletion request can arrive through, shared by both sides.
 *
 * NO `server-only` IN THIS FILE, AND THAT IS THE ENTIRE REASON IT EXISTS.
 *
 * The screen that takes a request needs the same list the server validates
 * against, and the first version imported it from `deletion-requests.ts`, which
 * carries `server-only` because it reaches the database. That compiled: `tsc`
 * had nothing to complain about, because the constraint is the bundler's rather
 * than the type system's. The BUILD failed, and the suite reported
 * `THE SUITE DID NOT RUN TO COMPLETION` rather than a list of content failures,
 * which is the runner behaving exactly as CLAUDE.md section 6 says it should:
 * a suite that can be pointed at nothing must not report findings about it.
 *
 * So the values live here and both sides import them. Duplicating the list into
 * the client instead would have worked and would have been the wrong fix: two
 * copies of an enumeration are two copies that drift, and the one that drifts
 * is the screen, which then offers a channel the server refuses.
 */

export type RequestChannel = "telephone" | "email" | "letter" | "in_person" | "other";

/**
 * In the order somebody taking a call would look for them.
 *
 * `other` is last and carries a required note wherever it is used, because a
 * channel of "something else" with nothing beside it is not a channel, it is a
 * shrug, and 0036 refuses it at the database.
 */
export const CHANNELS: { value: RequestChannel; label: string }[] = [
  { value: "telephone", label: "Telephone" },
  { value: "email", label: "Email" },
  { value: "letter", label: "Letter" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Something else" },
];

/** The set, for a server that has to check a string somebody sent it. */
export const CHANNEL_VALUES: ReadonlySet<string> = new Set(CHANNELS.map((c) => c.value));
