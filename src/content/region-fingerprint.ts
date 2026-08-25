/**
 * A fingerprint of the region and county assignment.
 *
 * WHY THIS EXISTS
 * ---------------
 * src/content/county-geometry.ts is generated, and one part of it,
 * REGION_BOUNDARY_PATH, is derived from which region each county belongs to. If
 * a county moves between regions in src/content/regions.ts and nobody
 * regenerates, the map keeps drawing the old boundary. Nothing about that looks
 * broken. It is just wrong, permanently, in a way a reader would have to know
 * Texas geography to catch.
 *
 * So the generator stamps this hash into the output, the map component
 * recomputes it from the live data at module scope, and a mismatch throws. The
 * map pages are statically prerendered, so the throw fails the build.
 *
 * WHY IT IS NOT A CRYPTOGRAPHIC HASH
 * ----------------------------------
 * This detects an accident, not an attack. Nobody is trying to forge a county
 * assignment that collides with the previous one. djb2 is deterministic, has no
 * dependency, and runs in both the node generator and the React module scope
 * without a platform specific crypto import, which a Web Crypto digest would
 * have required to be async and therefore unusable at module scope.
 */

type RegionLike = { slug: string; counties: string[] };

/**
 * Sorted so that reordering regions or counties without changing the assignment
 * does not trip the guard. Only a county actually changing region does.
 */
export function regionAssignmentFingerprint(regions: readonly RegionLike[]): string {
  const pairs: string[] = [];
  for (const region of regions) {
    for (const county of region.counties) pairs.push(`${region.slug}:${county}`);
  }
  pairs.sort();

  // djb2
  let hash = 5381;
  const text = pairs.join("|");
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return `${pairs.length.toString(36)}-${hash.toString(36)}`;
}
