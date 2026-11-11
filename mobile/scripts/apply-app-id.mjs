/**
 * THE APP ID'S ONE HOME IS mobile/capacitor.config.json (Robert's T8,
 * 2026-11-08: "one value in one file so changing it later is a single edit").
 *
 * Android reads it at build time (android/app/build.gradle). The iOS project
 * holds the bundle identifier as a literal in project.pbxproj, so this copies
 * the config's value there, and `npm run sync` runs it first. It refuses
 * unless it finds the setting exactly twice (Debug and Release), so a project
 * that has changed shape is reported rather than half rewritten.
 *
 *   node scripts/apply-app-id.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const { appId } = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(appId)) throw new Error(`appId "${appId}" is not a reverse domain identifier`);

const path = "ios/App/App.xcodeproj/project.pbxproj";
const src = readFileSync(path, "utf8");
const pattern = /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g;
const found = src.match(pattern) ?? [];
if (found.length !== 2) throw new Error(`expected the bundle identifier twice in ${path}, found ${found.length}`);
writeFileSync(path, src.replace(pattern, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`));
console.log(`iOS bundle identifier set to ${appId} (Debug and Release). Android reads it from the config at build time.`);
