// The favicon set is square and complete, the manifest lists it, and the schema
// logo is a square PNG of at least 112 pixels.
//
//   node scripts/proofs/the-favicon-set-is-square-and-complete.mjs
//
// Robert, 13:05 Central 2026-10-29: favicon.ico with 16, 32 and 48; 48, 96, 144
// and 192 pixel PNGs; an apple-touch-icon of 180; manifest icons; and an
// Organization logo, square, at least 112 by 112, on a crawlable URL.
//
// The sizes and paths below are LITERALS, never imported from
// scripts/emit-favicons.mjs: an audit that reads its expectation from the thing
// it audits compares a value to itself.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const failures = [];
let checks = 0;
const check = (ok, what) => {
  checks++;
  if (!ok) failures.push(what);
};

async function dims(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  const m = await sharp(file).metadata();
  return { w: m.width, h: m.height, format: m.format };
}

// Every PNG Robert listed, at the size he listed, square.
const PNGS = [
  ["src/app/icon1.png", 48],
  ["src/app/icon2.png", 96],
  ["src/app/icon3.png", 144],
  ["src/app/icon4.png", 192],
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 180],
  ["public/icons/icon-48.png", 48],
  ["public/icons/icon-96.png", 96],
  ["public/icons/icon-144.png", 144],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-512-maskable.png", 512],
];
for (const [rel, size] of PNGS) {
  const d = await dims(rel);
  check(d !== null, `${rel} exists`);
  if (d) check(d.format === "png" && d.w === size && d.h === size, `${rel} is a ${size} by ${size} PNG (read ${d.w} by ${d.h} ${d.format})`);
}

// The link icons and the manifest copies are the same bytes, so they cannot drift.
for (const [a, b] of [
  ["src/app/icon1.png", "public/icons/icon-48.png"],
  ["src/app/icon2.png", "public/icons/icon-96.png"],
  ["src/app/icon3.png", "public/icons/icon-144.png"],
  ["src/app/icon4.png", "public/icons/icon-192.png"],
  ["src/app/icon.png", "public/icons/icon-512.png"],
]) {
  const same = fs.existsSync(path.join(root, a)) && fs.existsSync(path.join(root, b)) &&
    fs.readFileSync(path.join(root, a)).equals(fs.readFileSync(path.join(root, b)));
  check(same, `${a} and ${b} are the same bytes`);
}

// favicon.ico holds exactly 16, 32 and 48, read from its own directory.
const icoFile = path.join(root, "src/app/favicon.ico");
check(fs.existsSync(icoFile), "src/app/favicon.ico exists");
if (fs.existsSync(icoFile)) {
  const ico = fs.readFileSync(icoFile);
  const count = ico.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < count; i++) sizes.push(ico[6 + i * 16] || 256);
  check(ico.readUInt16LE(2) === 1, "favicon.ico is an icon file");
  check(JSON.stringify(sizes.sort((x, y) => x - y)) === "[16,32,48]", `favicon.ico holds 16, 32 and 48 (read ${sizes.join(", ")})`);
}

// The manifest names every icon, each at a size its file really has.
const manifestSrc = fs.readFileSync(path.join(root, "src/app/manifest.webmanifest/route.ts"), "utf8");
const listed = [...manifestSrc.matchAll(/src: "([^"]+)", sizes: "(\d+)x(\d+)"/g)].map((m) => ({ src: m[1], w: +m[2], h: +m[3] }));
check(listed.length >= 6, `the manifest lists the icons (read ${listed.length})`);
for (const size of [48, 96, 144, 192, 512]) {
  check(listed.some((i) => i.w === size && i.h === size), `the manifest lists a ${size} by ${size} icon`);
}
check(/purpose: "maskable"/.test(manifestSrc), "the manifest carries a maskable icon");
for (const icon of listed) {
  const d = await dims(path.join("public", icon.src));
  check(d !== null && d.w === icon.w && d.h === icon.h, `manifest ${icon.src} is the ${icon.w} by ${icon.h} it claims (read ${d ? `${d.w} by ${d.h}` : "no file"})`);
}

// The schema logo: a crawlable public PNG, square, at least 112.
const schemaSrc = fs.readFileSync(path.join(root, "src/lib/schema.tsx"), "utf8");
const logoPath = "/brand/logo-square-512.png";
check(schemaSrc.includes(`const ORG_LOGO = \`\${business.url}${logoPath}\``), `schema.tsx declares ORG_LOGO as ${logoPath}`);
check((schemaSrc.match(/logo: ORG_LOGO/g) ?? []).length === 2, "the Organization node and the inline hiringOrganization both carry ORG_LOGO");
check(!/logo: `\$\{business\.url\}\/brand\/logo\.png`/.test(schemaSrc), "no schema node still names the wide lockup as its logo");
const logo = await dims(path.join("public", logoPath));
check(logo !== null && logo.format === "png" && logo.w === logo.h && logo.w >= 112, `the schema logo is a square PNG of at least 112 (read ${logo ? `${logo.w} by ${logo.h} ${logo.format}` : "no file"})`);

if (checks === 0) {
  console.log("FAIL: no checks ran");
  process.exit(1);
}
if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} checks failed.`);
  process.exit(1);
}
console.log(`PASS: ${checks} checks. The favicon set is square and complete, the manifest lists it, and the schema logo is a square PNG of at least 112.`);
