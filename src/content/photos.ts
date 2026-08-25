/**
 * Which photograph belongs to which surface.
 *
 * NO FORCED MATCHES, WHICH IS WHY MOST SURFACES ARE ABSENT
 * ---------------------------------------------------------
 * The design brief is explicit that a region gets an image only where a
 * genuinely fitting one exists, and the same discipline applies to the service
 * lines. The library is six photographs. There are nine service lines and eight
 * regions, so a mapping that covered everything would be seventeen entries and
 * eleven of them would be a picture chosen because a slot existed.
 *
 * A reader can tell. A forensic engineering page illustrated with a grain silo
 * is worse than a forensic engineering page with no picture on it, because the
 * silo actively says the firm had nothing relevant and reached for filler.
 *
 * So a missing entry is the normal case, not a gap. PageHeader renders a solid
 * navy masthead when there is no image, and that is a finished design rather
 * than a placeholder waiting for art.
 *
 * THE HONESTY RULE ON EVERY ALT STRING
 * ------------------------------------
 * Alt text describes what the photograph is. It never says or implies the firm
 * did the work shown, and it never names a place the photograph does not
 * demonstrably show. public/photos/PHOTOS.md carries the same strings and the
 * provenance for each file, including the one that was rejected for being a
 * Brazilian suburb.
 */

export type SurfacePhoto = { src: string; alt: string };

const PHOTO = {
  storm: {
    src: "/photos/plains-storm-sky.jpg",
    alt: "An open plain under a heavy grey storm sky.",
  },
  road: {
    src: "/photos/plains-open-road.jpg",
    alt: "A dirt road running straight across open country under grey cloud.",
  },
  roof: {
    src: "/photos/roof-under-construction.jpg",
    alt: "The roof of a house under construction, rafters exposed against the sky.",
  },
  framing: {
    src: "/photos/framing-against-sky.jpg",
    alt: "Timber framing of a house standing against an open sky.",
  },
  silos: {
    src: "/photos/grain-silos-plain.jpg",
    alt: "Grain silos standing on open farmland.",
  },
  pier: {
    src: "/photos/gulf-coast-pier.jpg",
    alt: "A timber fishing pier on standing piles reaching out over coastal water.",
  },
} as const satisfies Record<string, SurfacePhoto>;

/** Top level surfaces. */
export const sectionPhotos: Record<string, SurfacePhoto> = {
  services: PHOTO.roof,
  coverage: PHOTO.road,
  government: PHOTO.silos,
  careers: PHOTO.framing,
};

/**
 * Service lines.
 *
 * Four of nine. The five without an entry are roof certification adjacent desk
 * work, insurance and forensic investigation, and manufactured housing, and the
 * library holds nothing that shows any of them without pretending.
 */
export const servicePhotos: Record<string, SurfacePhoto> = {
  "roof-inspections": PHOTO.roof,
  "residential-light-commercial-design": PHOTO.framing,
  "structural-letters": PHOTO.framing,
  "windstorm-wpi-8": PHOTO.storm,
};

/**
 * Coverage regions.
 *
 * Three of eight, and each is a real match rather than a mood. The Panhandle
 * gets the supercell because wind is the governing load there. West Texas gets
 * the road because distance is the defining condition. Coastal Bend gets the
 * pier because it is the only genuinely Gulf coast photograph in the library.
 *
 * The other five have no entry, and Greater Houston in particular is left blank
 * deliberately: an urban skyline would have been easy to find and would have
 * said nothing true about residential and light commercial engineering there.
 */
export const regionPhotos: Record<string, SurfacePhoto> = {
  panhandle: PHOTO.storm,
  "west-texas": PHOTO.road,
  "coastal-bend": PHOTO.pier,
};
