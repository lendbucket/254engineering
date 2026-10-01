/**
 * NOTHING SECRET REACHES THE REPORT, AND THAT IS ENFORCED RATHER THAN PROMISED.
 *
 * Operator ruling, 2026-09-30: "The sweep script must never print, log, or write
 * to the report any secret, token, hash or signed value, even truncated. Assert
 * that in the script before it writes anything."
 *
 * IT REFUSES, IT DOES NOT REDACT. A redaction that happened and a redaction that
 * was never needed read identically on the page, so a sweep that quietly starred
 * out a token would leave nobody able to say whether one had ever been there.
 * This throws, the report is not written, and the run fails naming the rule that
 * stopped it. That is the only version where a green report means the text was
 * clean rather than cleaned.
 *
 * TRUNCATION IS NOT A DEFENCE AND THE RULING SAYS SO. Twelve characters of a
 * session secret is twelve characters an attacker does not have to guess, and a
 * prefix identifies which credential it came from. So the patterns below match
 * fragments, not whole values.
 *
 * WHAT IT CANNOT DO, said plainly. It matches SHAPES. A secret that looks like
 * an ordinary word is invisible to it, and so is one this process never knew.
 * What it does buy is that the shapes which actually occur here, environment
 * values, minted tokens, signed cookies and bearer headers, cannot reach the
 * file by accident, which is the realistic failure: a findings line that
 * helpfully quotes the request it made.
 */

/**
 * Values this process knows are secret, registered at runtime.
 *
 * ENVIRONMENT VALUES ARE REGISTERED WHOLESALE rather than named one by one,
 * because a list of names is a list somebody forgets to grow. Anything long
 * enough to be a credential and read from the environment is treated as one.
 */
const known = new Set();

/**
 * Register a value as unprintable, explicitly.
 *
 * EIGHT, BECAUSE SHORTER IS WORSE THAN USELESS. Registering a three character
 * value would make the guard match ordinary prose containing those three
 * characters and refuse every report for ever, which is how a check that cannot
 * be satisfied gets switched off. Nothing minted here is that short.
 *
 * This is the EXPLICIT door and keeps the low floor, because a caller passing a
 * value has decided it is secret. The automatic door below is stricter.
 */
export function treatAsSecret(value) {
  if (typeof value !== "string") return;
  if (value.trim().length < 8) return;
  known.add(value.trim());
}

/**
 * COULD THIS ENVIRONMENT VALUE PLAUSIBLY BE A CREDENTIAL?
 *
 * REGISTERING EVERY VALUE WHOLESALE WAS WRONG, and the sweep found it the
 * expensive way: `VERCEL_ENV` holds "production", ten characters, and
 * "reproduction" contains it. So a finding reading "a valid reproduction was
 * accepted first" was withheld from the report as though it carried a secret.
 *
 * It is the matcher-too-wide defect in a new place. The fix is the one the
 * operator has ruled for before: sharpen the subject rather than exempt the
 * instance, and derive the distinction rather than list names. A credential is
 * long and arbitrary; a mode, a flag or a region is a short dictionary word.
 *
 * So a value is auto-registered only if it is at least sixteen characters AND
 * is not a single run of lowercase letters. "production", "development" and
 * "preview" are excluded by both tests; a session secret, an API key and a
 * connection string pass both.
 *
 * WHAT THIS GIVES UP, said rather than hidden: a real secret that is sixteen or
 * more characters and entirely lowercase letters would not be auto-registered.
 * The shape patterns still catch every provider format, and anything this
 * process mints is registered explicitly, so the gap is a credential somebody
 * set by hand to a long lowercase word. Narrow, and stated.
 */
function plausiblyCredential(value) {
  const v = value.trim();
  if (v.length < 16) return false;
  if (/^[a-z]+$/.test(v)) return false;
  return true;
}

/** Register every environment value that could be a credential. */
export function registerEnvironment(env = process.env) {
  for (const [name, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    /*
     * PATH and its siblings are long, not secret, and registering them would
     * refuse any report naming a directory. Names are matched rather than
     * values because the distinction is about what the variable IS.
     */
    if (/^(PATH|PATHEXT|PSModulePath|SystemRoot|windir|TEMP|TMP|HOME|HOMEPATH|USERPROFILE|APPDATA|LOCALAPPDATA|ProgramFiles.*|CommonProgram.*|OS|COMSPEC|NUMBER_OF_PROCESSORS|PROCESSOR_.*)$/i.test(name)) {
      continue;
    }
    if (!plausiblyCredential(value)) continue;
    treatAsSecret(value);
  }
}

/**
 * Shapes that are secret whatever their origin.
 *
 * Each is here because it occurs in this platform, not because it is a generic
 * credential pattern: a JWT from Supabase, a `sb-` publishable or service key,
 * a bearer header, a signed cookie value, a hex digest, and the base64url a
 * token mint produces.
 */
const SHAPES = [
  { name: "a JSON web token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "a Supabase key", pattern: /\bsb[ps]?_[A-Za-z0-9_-]{16,}/ },
  { name: "a bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._-]{12,}/i },
  {
    name: "a Stripe key or secret",
    /*
     * UNDERSCORES ARE PART OF THE VALUE, which the first version of this got
     * wrong and the proof caught on its first run. A real key reads
     * `sk_live_51H...`, so a class of `[A-Za-z0-9]` stops dead at the
     * underscore after `live` and the match never reaches the ten character
     * minimum. The pattern was written from the shape I remembered rather than
     * from a key, and ten hand-picked fixtures would not have found it either:
     * the one that did was the realistic sample.
     */
    pattern: /\b(sk|rk|whsec|pk)_[A-Za-z0-9_]{10,}/,
  },
  { name: "a hex digest", pattern: /\b[a-f0-9]{40,}\b/i },
  {
    name: "a signed cookie or minted token",
    /*
     * A long base64url run. The `.` alternative catches the dot separated
     * shape a signed cookie uses. Deliberately not anchored to a cookie name,
     * because the realistic leak is a findings line quoting a whole header.
     */
    pattern: /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{10,}/,
  },
  { name: "a long opaque token", pattern: /\b[A-Za-z0-9_-]{40,}\b/ },
];

/**
 * Things that look like a secret shape and are not, which must be allowed or
 * the guard becomes one nobody can satisfy.
 *
 * COUNTED AND NAMED, NEVER AN OPEN LIST. CLAUDE.md records the operator
 * refusing an allowlist in exactly these words: "an allowlist of names is a
 * list somebody grows until the scan checks nothing." These four are shapes the
 * sweep itself produces, and each is derived rather than typed: a uuid has a
 * fixed shape, a probe address ends in the reserved domain, a git sha is a
 * known length, and a storage key is a path this run built.
 */
const INNOCENT = [
  { name: "a uuid", pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
  { name: "a probe address on the reserved domain", pattern: /^[^@\s]+@[^@\s]*\.invalid$/i },
  { name: "a short git object name", pattern: /^[0-9a-f]{7,12}$/i },
];

/**
 * Check one line. Returns null when it is safe to write, or a reason when not.
 */
export function refusalFor(line) {
  if (typeof line !== "string" || line.length === 0) return null;

  for (const secret of known) {
    if (line.includes(secret)) {
      return "a value registered as secret appears in this line";
    }
  }

  for (const shape of SHAPES) {
    const hit = line.match(shape.pattern);
    if (!hit) continue;
    const token = hit[0];
    if (INNOCENT.some((i) => i.pattern.test(token))) continue;
    /*
     * THE REASON NAMES THE SHAPE AND NEVER THE VALUE, which is the whole point:
     * a guard that reported what it caught would be the leak it exists to stop.
     */
    return `this line contains ${shape.name}`;
  }

  return null;
}

/**
 * Assert a whole report before it is written. Throws rather than returning, so
 * a caller cannot carry on and write it anyway.
 */
export function assertNothingSecret(text, where = "the report") {
  const lines = String(text).split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const refusal = refusalFor(lines[i]);
    if (refusal) {
      throw new Error(
        `REFUSING TO WRITE ${where}: line ${i + 1} was stopped because ${refusal}. ` +
          "Nothing has been written. The line is not reproduced here, for the same reason it was refused.",
      );
    }
  }
  return { ok: true, lines: lines.length, registered: known.size };
}
