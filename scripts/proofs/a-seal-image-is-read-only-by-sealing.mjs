// @runtime react-server
//
/**
 * THE ENGINEER'S SEAL IMAGES ARE READABLE ONLY BY THE SEALING STEP.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server \
 *     scripts/proofs/a-seal-image-is-read-only-by-sealing.mjs
 *
 * Ruling 2 of 2026-10-06, the second requirement: "The seal and signature
 * images are readable only by the sealing step, never displayed or
 * downloadable anywhere else." No runtime check can prove a negative about
 * every path, so this proves the shape that makes it true and says so:
 *
 *   1. One module in src names the bucket. Anything else that wanted the bytes
 *      would have to name it, and this goes red when it does.
 *   2. That module carries no download, signed URL or public URL call today.
 *      The sealing step will add exactly one read, and this check is where
 *      that read has to be accounted for when it arrives.
 *   3. Only the upload route and the engineer's own seal page import it, and
 *      the route has no GET.
 *   4. The PNG reader that decides what may be stored rejects what is not a PNG.
 *   5. The refusals that need no database answer before anything is read.
 *
 * The images are validated by their own header rather than by the content type
 * a browser sends, because a content type is a claim anybody can set.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const STORE = "src/lib/seal-store.ts";
const BUCKET = "eng-seals";

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) found.push(path.replace(/\\/g, "/"));
  }
  return found;
}

const sources = walk("src");
rec("the source tree was read, so the scans below read something", sources.length > 200, `${sources.length} files`);

/* ---- 1. one module names the bucket */
const naming = sources.filter((f) => readFileSync(f, "utf8").includes(`"${BUCKET}"`));
rec(
  `exactly one module names the ${BUCKET} bucket, and it is the seal store`,
  naming.length === 1 && naming[0] === STORE,
  naming.join(", ") || "NO MODULE NAMES IT, so the check below would pass over nothing",
);

/*
 * ---- 2. the module reads ONE thing out of the bucket, for sealing
 *
 * CHANGED 2026-10-07, ON PURPOSE, WITH SEALING PIECE TWO. This asserted "the
 * seal store holds no download, signed link or public link call", because in
 * piece one nothing read an image yet. The sealing step must read them, once,
 * server side, and control 2 of docs/sealing-controls.md says that read lives
 * in one function. So the assertion is now that exact shape: one download, in
 * readImageForSealing, and never a signed or public link, which would let an
 * image leave the server.
 */
const store = readFileSync(STORE, "utf8");
const links = ["createSignedUrl", "getPublicUrl"].filter((call) => store.includes(call));
const downloads = store.split(".download(").length - 1;
const readerAt = store.indexOf("export async function readImageForSealing(");
const downloadAt = store.indexOf(".download(");
rec(
  "the seal store holds no signed or public link, and exactly one download, inside readImageForSealing",
  links.length === 0 && downloads === 1 && readerAt > 0 && downloadAt > readerAt,
  links.length ? `FOUND: ${links.join(", ")}` : `${downloads} download(s)`,
);

/*
 * ---- 3. who imports it, and the route has no GET
 *
 * The importer scan matched only `from "@/lib/seal-store"` until 2026-10-07, so
 * a relative import (`from "./seal-store"`) would have been invisible to it,
 * which is exactly how the sealing step first imported it. It now matches both.
 */
const importsStore = (f) => /from "(@\/lib|\.)\/seal-store"/.test(readFileSync(f, "utf8"));
const importers = sources.filter((f) => f !== STORE && importsStore(f));
const allowed = [
  "src/app/api/portal/seal/route.ts",
  "src/app/portal/(app)/profile/seal/page.tsx",
  "src/lib/letter-seal.ts",
];
rec(
  "only the upload route, the engineer's own seal page and the sealing step import the seal store",
  importers.length === allowed.length && importers.every((f) => allowed.includes(f)),
  importers.join(", ") || "NOTHING IMPORTS IT",
);
const callers = sources.filter((f) => f !== STORE && readFileSync(f, "utf8").includes("readImageForSealing("));
rec(
  "and the sealing step is the only caller of the image read (control 2)",
  callers.length === 1 && callers[0] === "src/lib/letter-seal.ts",
  callers.join(", ") || "NOTHING CALLS IT",
);
const route = readFileSync("src/app/api/portal/seal/route.ts", "utf8");
rec(
  "the upload route answers POST and nothing else, so it cannot serve an image",
  /export async function POST\(/.test(route) && !/export (async )?function (GET|HEAD|PUT|PATCH|DELETE)\(/.test(route),
  "no GET, HEAD, PUT, PATCH or DELETE",
);

/* ---- 4. the PNG reader */
const { pngDimensions, uploadSealImage } = await import("../../src/lib/seal-store.ts");

const png = (width, height) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
};
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)]);

rec("a PNG header reads back its own width and height", JSON.stringify(pngDimensions(png(600, 450))) === '{"width":600,"height":450}', JSON.stringify(pngDimensions(png(600, 450))));
rec("a JPEG is not a PNG, whatever it claims to be", pngDimensions(jpeg) === null, "rejected on its own bytes");
rec("and a PNG that declares no width is refused", pngDimensions(png(0, 450)) === null, "zero is not a size");

/* ---- 5. the refusals that need no database */
const engineer = { id: "00000000-0000-4000-8000-0000000000aa", role: "engineer", status: "active" };
const admin = { id: "00000000-0000-4000-8000-0000000000ab", role: "admin", status: "active" };

const noSession = await uploadSealImage({ actor: null, kind: "seal", bytes: png(600, 600), code: "123456" });
rec("no session cannot store a seal", noSession.ok === false, noSession.ok ? "IT STORED" : noSession.error);

const asAdmin = await uploadSealImage({ actor: admin, kind: "seal", bytes: png(600, 600), code: "123456" });
rec(
  "an administrator cannot store a seal, including the owner",
  asAdmin.ok === false && /licensed engineer/.test(asAdmin.error),
  asAdmin.ok ? "IT STORED" : asAdmin.error,
);

const wrongKind = await uploadSealImage({ actor: engineer, kind: "stamp", bytes: png(600, 600), code: "123456" });
rec("a kind that is neither seal nor signature is refused", wrongKind.ok === false, wrongKind.ok ? "" : wrongKind.error);

const notPng = await uploadSealImage({ actor: engineer, kind: "seal", bytes: jpeg, code: "123456" });
rec("a file that is not a PNG is refused before a code is spent", notPng.ok === false && /not a PNG/.test(notPng.error), notPng.ok ? "" : notPng.error);

const tiny = await uploadSealImage({ actor: engineer, kind: "seal", bytes: png(50, 50), code: "123456" });
rec("an image too small to print clearly is refused", tiny.ok === false && /between/.test(tiny.error), tiny.ok ? "" : tiny.error);

/* ----------------------------------------------------------------- report */
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length > 0) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. The seal images are reachable by one module, and that module serves nothing.`);
