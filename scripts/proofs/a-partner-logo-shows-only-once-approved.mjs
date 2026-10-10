/**
 * A PARTNER'S LOGO SHOWS ONLY ONCE IT IS APPROVED, AND ONLY IF IT IS AN IMAGE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-partner-logo-shows-only-once-approved.mjs
 *
 * Run item 19 of 2026-10-10, migration 0072. Three properties:
 *   1. a file is judged by its bytes: PNG, JPEG and WebP pass, an SVG or a file
 *      merely NAMED .png does not, and nothing over one megabyte does;
 *   2. the four states can hold only what is true of them, enforced by the
 *      migration's checks, run here in an in-process replay of every migration;
 *   3. a public read asks for approved only and gets no link for any other state.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { logoRefusal, sniffLogo, MAX_LOGO_BYTES } = await import("../../src/lib/partner-branding.ts");

/* 1. The bytes decide. */
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
check("a PNG is accepted", sniffLogo(PNG)?.type === "image/png" && logoRefusal(PNG) === null);
check("a JPEG is accepted", sniffLogo(JPEG)?.type === "image/jpeg" && logoRefusal(JPEG) === null);
check("a WebP is accepted", sniffLogo(WEBP)?.type === "image/webp" && logoRefusal(WEBP) === null);
check("an SVG is refused, whatever it is called", sniffLogo(SVG) === null && /SVG is not accepted/.test(logoRefusal(SVG) ?? ""));
const big = new Uint8Array(MAX_LOGO_BYTES + 1);
big.set(PNG);
check("a PNG over one megabyte is refused", /one megabyte/.test(logoRefusal(big) ?? ""));
check("an empty file is refused", logoRefusal(new Uint8Array(0)) !== null);

/* 2. The states, in the replayed schema. */
const db = new PGlite();
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`);
for (const f of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join("supabase/migrations", f)));

const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'eng-partner-branding'")).rows[0];
check("the bucket is private, one megabyte, raster only", bucket && bucket.public === false && Number(bucket.file_size_limit) === 1048576 && !bucket.allowed_mime_types.includes("image/svg+xml"), JSON.stringify(bucket));

const { rows: [p] } = await db.query(
  "insert into eng_partners (organisation, contact_name, contact_email, code) values ('Logo proof', 'Nobody', 'logo@audit-probe.invalid', 'logo-proof') returning id",
);
const tries = async (set) => {
  try {
    await db.query(`update eng_partners set ${set} where id = $1`, [p.id]);
    return true;
  } catch {
    return false;
  }
};
check("a new partner starts with no logo", (await db.query("select brand_logo_status from eng_partners where id = $1", [p.id])).rows[0].brand_logo_status === "none");
check("pending with no file is refused", !(await tries("brand_logo_status = 'pending'")));
check("pending with a file and its time is accepted", await tries("brand_logo_status = 'pending', brand_logo_key = 'x/y.png', brand_logo_uploaded_at = now()"));
check("approved with no decision time is refused", !(await tries("brand_logo_status = 'approved'")));
check("approved with its decision time is accepted", await tries("brand_logo_status = 'approved', brand_logo_decided_at = now()"));
check("a status outside the four is refused", !(await tries("brand_logo_status = 'shown'")));
check("none while a file is held is refused", !(await tries("brand_logo_status = 'none', brand_logo_decided_at = null")));
await db.close();

/* 3. What a public page can get. */
const src = readFileSync("src/lib/partner-branding.ts", "utf8");
check("a read asking for approved only gets no link for any other state", src.includes('if (!key || (options.approvedOnly && status !== "approved")) return { status, url: null };'));
check("the upload's folder is the session's partner, never the request's", src.includes("const key = `${principal.partnerId}/"));

console.log("");
if (wrong === 0) {
  console.log("PASS: a partner's logo shows only once it is approved, and only if it is an image.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
