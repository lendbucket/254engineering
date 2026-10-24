/**
 * EVERY REQUEST A CLOUD BOARD MAKES TO ITS OWN SERVER CARRIES ITS RUN ID.
 *
 * Loaded into every Node process of the shard by NODE_OPTIONS="--import ..."
 * in .github/workflows/board.yml. Robert's ruling of 2026-10-23: each board run
 * gets its own sign in rate limit bucket, by a header the board sets from its
 * run id, which src/lib/ops-rate-limit.ts honours only on development.
 *
 * Only requests to this machine (localhost, 127.0.0.1, ::1) are touched, and
 * only when BOARD_RUN_ID is digits; anything else is exactly as before. The
 * header carries no secret: on production the limiter ignores it.
 */
const RUN = process.env.BOARD_RUN_ID ?? "";
const HEADER = "x-254-board-run";

if (/^\d{6,20}$/.test(RUN) && typeof globalThis.fetch === "function") {
  const original = globalThis.fetch;
  const local = (url) => {
    try {
      const { hostname } = new URL(url);
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
    } catch {
      return false;
    }
  };
  globalThis.fetch = (input, init = {}) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    if (!url || !local(url)) return original(input, init);
    const headers = new Headers(init.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined));
    if (!headers.has(HEADER)) headers.set(HEADER, RUN);
    return original(input, { ...init, headers });
  };
}
