import { createHash } from "node:crypto";

/**
 * ===========================================================================
 * NO DUPLICATE PHOTOS, AND "NOT CHECKED" IS NOT A PASS. Robert's ruling P5,
 * 2026-11-01 evening.
 * ===========================================================================
 *
 * Every evidence file carries the SHA-256 of its stored bytes from 0107,
 * computed by the server when the capture is recorded. The engineer's queue
 * asks one question of a package: is the same photograph in it twice, which is
 * what a package padded to satisfy a checklist looks like.
 *
 * THREE ANSWERS, NEVER TWO.
 *   not_checked  at least one photograph has no hash: captured before 0107, or
 *                its hash was never written. The check has not looked at the
 *                package, and saying "no duplicates" would claim it had.
 *   clear        every photograph has a hash and no two are equal.
 *   duplicates   two or more photographs are byte for byte the same file.
 *
 * Byte identical only. A photograph cropped, resized or re-saved is a
 * different file to this check, and the screen says "byte for byte" so nobody
 * reads it as a visual comparison. The property location check stays off, and
 * nothing here geocodes (Robert, same ruling).
 *
 * Pure apart from the hash helper, so a proof hands it rows.
 */

export const SHA256_SHAPE = /^[0-9a-f]{64}$/;

/** The hex SHA-256 of some bytes, lowercase, as 0107's check constraint requires. */
export function sha256Hex(bytes: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).digest("hex");
}

export type FingerprintedCapture = { id: string; itemKey: string; label: string; kind: string; sha256: string | null };

export type DuplicateCheck =
  | { state: "not_checked"; photos: number; unhashed: number }
  | { state: "clear"; photos: number }
  | { state: "duplicates"; photos: number; groups: { sha256: string; labels: string[] }[] };

export function duplicatePhotoCheck(captures: readonly FingerprintedCapture[]): DuplicateCheck {
  const photos = captures.filter((c) => c.kind === "photo");
  const unhashed = photos.filter((c) => !c.sha256 || !SHA256_SHAPE.test(c.sha256)).length;
  if (unhashed > 0) return { state: "not_checked", photos: photos.length, unhashed };

  const byHash = new Map<string, FingerprintedCapture[]>();
  for (const p of photos) byHash.set(p.sha256 as string, [...(byHash.get(p.sha256 as string) ?? []), p]);
  const groups = [...byHash.entries()]
    .filter(([, same]) => same.length > 1)
    .map(([sha256, same]) => ({ sha256, labels: same.map((s) => s.label) }));
  return groups.length ? { state: "duplicates", photos: photos.length, groups } : { state: "clear", photos: photos.length };
}

/** The sentence the engineer reads. One home, so no screen words it differently. */
export function duplicateCheckSentence(check: DuplicateCheck | null): string {
  if (check === null) return "Duplicate photos: the fingerprints could not be read, so this package has not been checked.";
  if (check.state === "not_checked") {
    return `Duplicate photos: not checked. ${check.unhashed} of ${check.photos} photograph${check.photos === 1 ? "" : "s"} ${check.unhashed === 1 ? "has" : "have"} no fingerprint on record, which is how a photograph captured before fingerprints were kept reads.`;
  }
  if (check.state === "clear") {
    return check.photos === 0
      ? "Duplicate photos: this package has no photographs."
      : `Duplicate photos: none. All ${check.photos} photograph${check.photos === 1 ? " is" : "s are"} different files, compared byte for byte.`;
  }
  const parts = check.groups.map((g) => g.labels.join(" and "));
  return `Duplicate photos: ${check.groups.length === 1 ? "one file appears" : `${check.groups.length} files appear`} more than once, byte for byte: ${parts.join("; ")}.`;
}
