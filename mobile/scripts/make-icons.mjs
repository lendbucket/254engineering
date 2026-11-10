/**
 * THE STORE APP'S ICONS, FROM THE FIRM'S OWN MARK. Robert's T8, 2026-11-08:
 * "the icon set from our logo".
 *
 *   node scripts/make-icons.mjs        (from mobile/)
 *
 * Every size is rendered by master() in scripts/emit-favicons.mjs, the one
 * function that already makes the site's favicons and manifest icons from the
 * corrected lockup (Robert, 2026-10-29): the numerals and the gold rule, white
 * on the footer navy. So the app's icon and the site's icon are one artwork at
 * different sizes, and replacing the logo there replaces it here on the next
 * run.
 *
 * Writes:
 *   Android  mipmap-<density>/ic_launcher.png and ic_launcher_round.png (the
 *            legacy square and round icons), ic_launcher_foreground.png (the
 *            adaptive icon's foreground, the mark inside the launcher's safe
 *            zone), and the adaptive background colour, the same navy.
 *   iOS      AppIcon-512@2x.png, the one 1024 icon Xcode needs.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repo = join(process.cwd(), "..");
const { master, GROUND, DEFAULT_SOURCE } = await import(pathToFileURL(join(repo, "scripts", "emit-favicons.mjs")).href);
const source = join(repo, DEFAULT_SOURCE);
const res = join("android", "app", "src", "main", "res");

/* Launcher sizes per density, and the adaptive foreground at 108dp. */
const DENSITIES = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };

const written = [];
for (const [density, [launcher, foreground]] of Object.entries(DENSITIES)) {
  const dir = join(res, `mipmap-${density}`);
  const square = await master(source, launcher, 0.8);
  writeFileSync(join(dir, "ic_launcher.png"), square);
  writeFileSync(join(dir, "ic_launcher_round.png"), square);
  /* The adaptive foreground: the mark within the central 66dp of 108dp the launcher always shows. */
  writeFileSync(join(dir, "ic_launcher_foreground.png"), await master(source, foreground, 0.55));
  written.push(`${density} ${launcher} and ${foreground}`);
}
writeFileSync(
  join(res, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${GROUND.toUpperCase()}</color>\n</resources>\n`,
);
writeFileSync(join("ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png"), await master(source, 1024, 0.8));
console.log(`Android: ${written.join("; ")}; adaptive background ${GROUND}. iOS: AppIcon-512@2x.png at 1024.`);
