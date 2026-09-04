/**
 * What is allowed to leave this process when something goes wrong.
 *
 * Pure. No imports, no environment, no network, so the audit can put a real
 * payload through it and read exactly what comes out.
 *
 * THE PROBLEM THIS SOLVES, STATED PLAINLY
 * ---------------------------------------
 * An error reporter is a pipe out of the building. It takes whatever the
 * process was holding at the moment things went wrong and posts it to somebody
 * else's server, and the moment things go wrong is precisely when the process
 * is holding a request body, a header, a token it was about to verify, or the
 * URL of a file it was about to sign.
 *
 * This firm holds three categories of thing that must never make that trip:
 *
 *   Credentials. The Supabase service role key bypasses row level security on
 *   every table including the audit trail. A Stripe secret key moves money.
 *   The session secrets forge sessions.
 *
 *   Signed URLs. Evidence photographs and onboarding documents are served
 *   through time limited signed links. A signed URL in an error report is a
 *   working link to somebody's document sitting in a third party's database.
 *
 *   Identity documents. Onboarding collects driver licence and insurance
 *   references from technicians. Those belong in one database with one
 *   service role key in front of them, not in an error breadcrumb.
 *
 * WHY IT REDACTS BY SHAPE AND BY NAME, AND NOT ONLY BY NAME
 * ---------------------------------------------------------
 * Redacting fields called "password" catches the case somebody thought of. The
 * secret that actually leaks is in a field called `body`, or in the middle of a
 * message string, or in a URL query. So this runs both: names that are always
 * removed whatever they contain, and patterns that are removed wherever they
 * appear including inside free text.
 *
 * WHY THE MARKER SAYS WHAT WAS REMOVED
 * ------------------------------------
 * A redaction that leaves [redacted] tells the reader nothing about whether
 * the scrubber worked or the field was empty. [redacted: stripe key] says what
 * was there, which is the difference between an error report you can debug and
 * one you cannot. The marker never contains any of the value.
 */

export const REDACTED = "[redacted";

/**
 * Field names removed whatever they hold.
 *
 * Matched case insensitively against the whole key and against snake, camel and
 * kebab spellings of it, because a payload assembled from three sources spells
 * the same idea three ways and the one that gets through is the spelling
 * nobody listed.
 */
const SECRET_KEYS = [
  "password",
  "passphrase",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "cookie",
  "setcookie",
  "session",
  "servicerolekey",
  "service_role_key",
  "anonkey",
  "signature",
  "signingsecret",
  "webhooksecret",
  "clientsecret",
  "privatekey",
  "creditcard",
  "cardnumber",
  "cvc",
  "ssn",
  "driverlicense",
  "driverslicense",
  "licensenumber",
  "policynumber",
  "dateofbirth",
  "dob",
];

/**
 * Value shapes removed wherever they appear, including inside a sentence.
 *
 * Each entry names what it is, so the marker can say so. Order matters: the
 * more specific patterns run first, because a JWT is also a long opaque string
 * and the reader is better served by "[redacted: jwt]" than by
 * "[redacted: long opaque string]".
 */
const SECRET_PATTERNS: { label: string; re: RegExp }[] = [
  // Stripe. Live and test, secret and restricted. Publishable keys are public
  // by design and are deliberately not matched: redacting them would suggest
  // an exposure that is not one.
  { label: "stripe key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g },
  { label: "stripe webhook secret", re: /\bwhsec_[A-Za-z0-9]{8,}/g },

  // Supabase and anything else issuing a JWT. The service role key is one of
  // these, which is why this pattern is not optional.
  { label: "jwt", re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g },

  // Resend.
  { label: "resend key", re: /\bre_[A-Za-z0-9_-]{16,}/g },

  // A bearer token in a header value or a log line.
  { label: "bearer token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi },

  /*
   * A signed URL. Matched on the query parameters that make it signed rather
   * than on the host, so it catches Supabase storage, S3 style presigning and
   * anything else that puts a signature in the query. The whole URL goes, not
   * just the signature: the path names the document.
   */
  {
    label: "signed url",
    re: /\bhttps?:\/\/[^\s"'<>]*[?&](?:token|signature|x-amz-signature|sig|se|sp|sv)=[^\s"'<>&]+[^\s"'<>]*/gi,
  },

  /*
   * A Texas driver licence, eight digits, and an insurance policy reference.
   * Both come off the onboarding form.
   *
   * Eight consecutive digits is a broad pattern and it will sometimes redact
   * something that is not a licence. That is the correct direction to be wrong
   * in: a redacted order total is an inconvenience and a leaked licence number
   * is a person's identity document in a third party's database. The bound is
   * a word boundary either side, so it does not eat digits out of a uuid or a
   * timestamp.
   */
  { label: "possible identity number", re: /\b\d{8,9}\b/g },

  // An email address. Not a secret, and still a person, and an error report
  // does not need to name them to be useful.
  { label: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
];

const normalise = (key: string) => key.toLowerCase().replace(/[-_\s]/g, "");

/** Is this field name one that is removed whatever it holds? */
export function isSecretKey(key: string): boolean {
  const flat = normalise(key);
  return SECRET_KEYS.some((secret) => flat === normalise(secret) || flat.includes(normalise(secret)));
}

/**
 * Remove every recognised secret shape from a string.
 *
 * Applied to messages, stack frames, URLs and every string value in a payload,
 * because the field a secret is found in is never the field it was expected in.
 */
export function scrubString(input: string): string {
  let out = input;
  for (const { label, re } of SECRET_PATTERNS) {
    out = out.replace(re, `${REDACTED}: ${label}]`);
  }
  return out;
}

/**
 * Walk any value and scrub it.
 *
 * WHY THERE IS A DEPTH LIMIT AND A CYCLE GUARD
 * --------------------------------------------
 * This runs inside an error handler. A stack overflow or an infinite loop here
 * would turn a reportable error into an unreportable crash, which is the worst
 * possible failure for the one piece of code whose job is to tell somebody
 * that something failed. Past the depth limit the value is dropped rather than
 * partially walked, because a half scrubbed object is worse than no object.
 */
export function scrubValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 8) return "[dropped: too deep to scrub]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    if (seen.has(value)) return "[dropped: circular]";
    seen.add(value);
    return value.slice(0, 100).map((v) => scrubValue(v, depth + 1, seen));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return "[dropped: circular]";
    seen.add(obj);

    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      out[key] = isSecretKey(key) ? `${REDACTED}: ${key}]` : scrubValue(v, depth + 1, seen);
    }
    return out;
  }

  // Functions, symbols, bigints. Nothing useful and possibly a closure over
  // something that matters.
  return `[dropped: ${typeof value}]`;
}

/**
 * The shape of a Sentry event, reduced to the parts that can carry a secret.
 *
 * Deliberately structural rather than importing Sentry's type. This module is
 * pure and the audit exercises it without the SDK installed in its import
 * graph; taking a dependency here to describe a shape would make the pure part
 * of the system depend on the part that talks to the network.
 */
export type ScrubbableEvent = {
  message?: string;
  request?: {
    url?: string;
    headers?: Record<string, unknown>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  user?: Record<string, unknown>;
  breadcrumbs?: unknown[];
  exception?: { values?: { type?: string; value?: string; stacktrace?: unknown }[] };
  [key: string]: unknown;
};

/**
 * Everything that leaves goes through here.
 *
 * WHAT IS DROPPED OUTRIGHT RATHER THAN SCRUBBED
 * ---------------------------------------------
 * Cookies and the raw request body. Both are unstructured, both routinely
 * carry a session or a password, and neither has ever helped diagnose a fault
 * on this platform in a way the route and the message did not. A field that
 * cannot be made safe and is not needed should not be sent at all: scrubbing is
 * a filter and every filter has holes, so the surface it has to cover should be
 * as small as the work allows.
 *
 * The user is reduced to an id. Knowing WHICH account hit a fault is genuinely
 * useful; knowing their email address, name, and IP is not worth putting them
 * in a third party's database to find out.
 */
export function scrubEvent(event: ScrubbableEvent): ScrubbableEvent {
  const out: ScrubbableEvent = { ...event };

  if (typeof out.message === "string") out.message = scrubString(out.message);

  if (out.request) {
    const request = { ...out.request };
    delete request.cookies;
    delete request.data;
    if (typeof request.url === "string") request.url = scrubString(request.url);
    if (request.query_string !== undefined) request.query_string = scrubValue(request.query_string);
    if (request.headers) {
      const headers: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(request.headers)) {
        headers[k] = isSecretKey(k) ? `${REDACTED}: ${k}]` : scrubValue(v);
      }
      request.headers = headers;
    }
    out.request = request;
  }

  if (out.user) {
    const id = out.user.id;
    out.user = id === undefined ? {} : { id: scrubValue(id) };
  }

  for (const field of ["extra", "contexts", "tags"] as const) {
    if (out[field]) out[field] = scrubValue(out[field]) as Record<string, unknown>;
  }

  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = out.breadcrumbs.map((b) => scrubValue(b));
  }

  if (out.exception?.values) {
    out.exception = {
      values: out.exception.values.map((v) => ({
        ...v,
        value: typeof v.value === "string" ? scrubString(v.value) : v.value,
        stacktrace: v.stacktrace ? scrubValue(v.stacktrace) : v.stacktrace,
      })),
    };
  }

  return out;
}

/**
 * A stable name for a fault, so the same thing happening again is recognised.
 *
 * WHY THE IDENTIFIERS COME OUT
 * ----------------------------
 * "File 3f2a no longer exists" and "File 91bc no longer exists" are one fault,
 * and a fingerprint that keeps the identifier makes them two. That is the
 * difference between an operator seeing "this has happened 400 times" and an
 * operator seeing 400 faults, which is the same as seeing none, because the
 * rate threshold is counted per fingerprint and 400 faults of one occurrence
 * each never crosses it.
 *
 * WHY EVERY RUN OF DIGITS GOES, NOT ONLY THE WORD BOUNDED ONES
 * -------------------------------------------------------------
 * The first version used \b\d+\b, and the walk of the status page found what
 * that misses. A Stripe session id is "cs_test_4": there is no word boundary
 * between an underscore and a digit, both being word characters, so the digit
 * survived and twelve occurrences of one fault rendered as twelve faults, each
 * with a count of one and no chance of ever alerting. The screen showed the
 * exact failure the function was written to prevent.
 *
 * The cost of stripping every digit run is over grouping: "HTTP 404" and
 * "HTTP 500" become one fingerprint. That is the right way to be wrong. Over
 * grouping shows one row with a high count and the operator opens it; under
 * grouping shows four hundred rows nobody reads and silences the alerting
 * entirely. Nothing is lost either way, because eng_error_events keeps every
 * message exactly as it was recorded.
 *
 * Deliberately not a hash. A readable fingerprint means the status page can
 * show it and somebody can grep for it, and the collisions a readable one
 * allows are between faults that genuinely read the same.
 */
export function fingerprintOf(kind: string, message: string, route?: string | null): string {
  const shape = message
    .toLowerCase()
    // Uuids first, because they would otherwise be shredded into <n> fragments
    // by the digit rule and stop reading as one thing.
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    // Long hex or base62 runs: a charge ref, an object key, a request id. These
    // carry no digits sometimes, so the digit rule below would not catch them.
    .replace(/\b[0-9a-z]{16,}\b/g, "<ref>")
    /*
     * Identifier shaped tokens: an underscore or a hyphen, and a digit
     * somewhere. cs_test_4, pi_3abc123, evt_1j2k3, order-254-000123.
     *
     * The letters in these differ between occurrences as often as the digits
     * do, so stripping digits alone leaves pi_<n>abc<n> beside pi_<n>xyz<n>,
     * which is still two fingerprints for one fault. A hyphenated English word
     * has no digit in it and is untouched.
     */
    .replace(/\b[0-9a-z]+[_-][0-9a-z_-]*[0-9][0-9a-z_-]*\b/g, "<ref>")
    // Every run of digits, wherever it sits. See above.
    .replace(/\d+/g, "<n>")
    // Repeated placeholders collapse, so "cs_<n>_<n>_<n>" reads as one thing.
    .replace(/(<n>[_-]?){2,}/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return [route ?? "-", kind, shape].join(" | ");
}
