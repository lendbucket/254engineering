/**
 * THE PHOTOGRAPH THAT ARRIVED IS THE ONE TAKEN. Robert's T2 and his answer 2
 * of 2026-11-07 (6717223376): "The phone hashes at capture. The server hashes
 * the bytes again at upload and compares. The server's hash stays the record.
 * A mismatch is refused and named."
 *
 * Pure, so the proof runs it directly
 * (scripts/proofs/a-field-day-starts-and-replays-with-no-signal.mjs).
 * recordCapture in src/lib/ops-field.ts calls it after hashing the stored bytes
 * and before writing the row.
 */

/** A SHA-256 in hex, as the phone sends one taken at capture. */
export const SHA256_HEX = /^[0-9a-f]{64}$/i;

/**
 * Null when the stored bytes are the bytes the phone hashed at capture, or the
 * phone sent no hash (an entry queued before this rule, or a browser that could
 * not hash); otherwise the sentence the technician reads.
 */
export function captureHashMismatch(captureSha256: string | null | undefined, storedSha256: string | null): string | null {
  if (!captureSha256 || storedSha256 === null) return null;
  if (captureSha256.toLowerCase() === storedSha256.toLowerCase()) return null;
  return (
    `The photograph that reached the firm is not the one taken: its fingerprint at capture was ${captureSha256.slice(0, 12)}..., ` +
    `and the stored file's is ${storedSha256.slice(0, 12)}.... It was not recorded. Take the photograph again.`
  );
}
