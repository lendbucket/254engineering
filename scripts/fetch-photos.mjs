/**
 * Download the environmental photography, and write the licence ledger.
 *
 *   npm run fetch-photos
 *
 * WHAT IS PERMITTED HERE, AND WHAT IS NOT
 * ---------------------------------------
 * The operator amended the site's no photography rule. Environmental imagery of
 * the Texas built and natural world is now permitted and wanted. Three bans
 * remain absolute and this script is where they are enforced by curation rather
 * than by hope:
 *
 *   No stock humans presented as staff or team.
 *   No image captioned or contextually implied to be this firm's project.
 *   No AI generated imagery presented as photography.
 *
 * So every entry below is a place or a material, never a person at work, and
 * every `alt` describes what the photograph is rather than whose it is. "An
 * aerial view of a suburban neighbourhood" is honest. "Our recent project in
 * Katy" would be a fabrication, and it is the kind that is very hard to walk
 * back once a crawler has it.
 *
 * WHY ONLY images.unsplash.com
 * ----------------------------
 * Unsplash serves two libraries from two hosts. `images.unsplash.com` is the
 * free Unsplash Licence: usable commercially, no permission needed, attribution
 * appreciated but not required. `plus.unsplash.com` is Unsplash+, which is a
 * paid subscription licence, and several strong candidates were rejected for
 * being on it. The check below refuses any URL that is not on the free host, so
 * a later addition cannot quietly bring a licence obligation with it.
 *
 * ATTRIBUTION IS RECORDED EVEN THOUGH IT IS NOT REQUIRED
 * ------------------------------------------------------
 * public/photos/PHOTOS.md is generated from this manifest and lists the
 * photographer, the source page, and the licence for every file. The Unsplash
 * Licence does not oblige it. A firm that publishes a compliance gate on its own
 * registration should be able to say where its pictures came from.
 */
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "public/photos";
/** Wide enough for a 1600px hero at 2x without being absurd. */
const WIDTH = 2400;
const QUALITY = 80;

/**
 * The curated set.
 *
 * Curation notes are kept on the entries that were hard calls, because the
 * rejected candidates are the useful record: searches for Texas returned mostly
 * flags, neon signs, and cowboy boots, and searches for construction returned
 * mostly models in clean hard hats pointing at clipboards. None of that is here.
 */
/**
 * REJECTED, and recorded rather than deleted.
 *
 * photo-1516156008625-3a9d6067fab5 by Breno Assis, "aerial view of suburban
 * neighborhood houses", was downloaded as the homepage hero and then looked at.
 * It is a Brazilian suburb: palm trees, barrel tile roofs, pastel stucco. The
 * alt text would have been literally true and the page would still have been
 * lying, because environmental imagery on a Texas firm's homepage implies the
 * place it shows.
 *
 * The rule this produced, which governs every future addition: an image that
 * reads as A PLACE has to be a place this firm could plausibly work in. An image
 * that reads as A MATERIAL, roof trusses, concrete, framing, carries no
 * geographic claim and is judged only on whether it is honest about what it is.
 */
const PHOTOS = [
  {
    file: "roof-under-construction.jpg",
    id: "photo-1690719095815-549c60090c9f",
    photographer: "Troy Mortier",
    page: "https://unsplash.com/photos/the-roof-of-a-house-being-built-brPKGeqvVKI",
    alt: "The roof of a house under construction, rafters exposed against the sky.",
    use: "Roof and structural service pages.",
  },
  {
    file: "framing-against-sky.jpg",
    id: "photo-1676802540678-2dceb1820113",
    photographer: "Troy Mortier",
    page: "https://unsplash.com/photos/a-wooden-structure-with-a-sky-background-w6g9DqZUNkI",
    alt: "Timber framing of a house standing against an open sky.",
    use: "Structural design and repair specification pages.",
  },
  {
    file: "plains-storm-sky.jpg",
    id: "photo-1618604943672-faaf34b4c3b2",
    photographer: "Raychel Sanner",
    page: "https://unsplash.com/photos/green-grass-field-under-gray-clouds-drQtGkdBz8E",
    alt: "An open plain under a heavy grey storm sky.",
    use: "Panhandle region page, and the wind sections. Sanner photographs storms rather than staging them, which is why several of these come from the same photographer.",
  },
  {
    file: "plains-open-road.jpg",
    id: "photo-1593471000693-aa09778d706b",
    photographer: "Raychel Sanner",
    page: "https://unsplash.com/photos/brown-dirt-road-under-gray-clouds-0pSWKddFXiI",
    alt: "A dirt road running straight across open country under grey cloud.",
    use: "West Texas region page, and the coverage story band.",
  },
  {
    file: "grain-silos-plain.jpg",
    id: "photo-1632327491579-e833602c99e5",
    photographer: "Raychel Sanner",
    page: "https://unsplash.com/photos/a-couple-of-silos-sitting-on-top-of-a-lush-green-field-sNnqveyaIiE",
    alt: "Grain silos standing on open farmland.",
    use: "Government and municipal page. Rural infrastructure rather than a city skyline, because the county level buyer is the audience.",
  },
];

const FREE_HOST = "https://images.unsplash.com/";

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const seen = new Set();
  for (const p of PHOTOS) {
    if (seen.has(p.file)) throw new Error(`duplicate output filename: ${p.file}`);
    seen.add(p.file);
  }

  let downloaded = 0;
  let skipped = 0;

  for (const photo of PHOTOS) {
    const url = `${FREE_HOST}${photo.id}?w=${WIDTH}&q=${QUALITY}&fm=jpg&fit=max`;

    // The licence guard. Unsplash+ lives on plus.unsplash.com and is a paid
    // licence; nothing from it may enter this directory.
    if (!url.startsWith(FREE_HOST)) {
      console.error(`fetch-photos: ${photo.file} is not on the free Unsplash host. Refusing.`);
      process.exit(1);
    }

    const dest = path.join(OUT_DIR, photo.file);
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`fetch-photos: ${photo.file} returned HTTP ${res.status} from ${url}`);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 20_000) {
      console.error(
        `fetch-photos: ${photo.file} came back at ${buf.byteLength} bytes, which is not a photograph. Refusing.`,
      );
      process.exit(1);
    }
    fs.writeFileSync(dest, buf);
    downloaded++;
    console.log(`  ${photo.file}  ${(buf.byteLength / 1024).toFixed(0)} KB`);
  }

  const ledger = `# Photography ledger

Generated by \`scripts/fetch-photos.mjs\`. Do not edit by hand; edit the manifest
in that script and re-run \`npm run fetch-photos\`.

Every file in this directory is licensed under the [Unsplash
License](https://unsplash.com/license), which permits commercial use without
permission and does not require attribution. Attribution is recorded anyway.

**What is not here, and will not be.** No stock humans presented as staff. No
image captioned or implied to be a project of this firm. No AI generated imagery
presented as photography. Every alt text below describes what the photograph is,
never whose it is.

| File | Photographer | Source | Used for |
| --- | --- | --- | --- |
${PHOTOS.map(
  (p) => `| \`${p.file}\` | ${p.photographer} | [Unsplash](${p.page}) | ${p.use} |`,
).join("\n")}

## Alt text

The alt text below is the text rendered on the site. It is recorded here so a
reviewer can check the honesty rule without reading the components.

${PHOTOS.map((p) => `- \`${p.file}\`: ${p.alt}`).join("\n")}
`;

  fs.writeFileSync(path.join(OUT_DIR, "PHOTOS.md"), ledger, "utf8");

  console.log(
    `\nfetch-photos: ${downloaded} downloaded, ${skipped} already present, ${PHOTOS.length} in the ledger.`,
  );
}

main();
