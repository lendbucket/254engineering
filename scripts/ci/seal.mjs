/**
 * SEALING WHAT THE CLOUD BOARD KEEPS. Operator ruling, 2026-10-22: the
 * repositories stay public, the public check shows verdict lines only, and the
 * full audit output is kept as an ENCRYPTED artifact, because artifacts on a
 * public repository can be downloaded by anybody.
 *
 *   node scripts/ci/seal.mjs seal   <in> <out>               public key, for logs
 *   node scripts/ci/seal.mjs open   <in> <out> <private.pem> on the operator's PC
 *   node scripts/ci/seal.mjs lock   <in> <out>               BUILD_ARTIFACT_KEY, for .next
 *   node scripts/ci/seal.mjs unlock <in> <out>               BUILD_ARTIFACT_KEY
 *
 * LOGS ARE SEALED WITH A PUBLIC KEY, so no runner and no secret can open them:
 * the private half lives on the operator's machine (C:/Users/salon/.254-ci) and
 * nowhere else. A fresh AES-256-GCM key per file, wrapped with RSA-OAEP.
 *
 * THE BUILD IS LOCKED WITH A SHARED SECRET, because the shard jobs have to
 * open it and a runner cannot hold the private key. It lives a day.
 */
import { createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt, randomBytes, constants } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAGIC = Buffer.from("254SEAL1");
/* Not named .pem: .gitignore refuses every .pem, which is right for private keys
 * and is left alone. This is the PUBLIC half, and it is meant to be read. */
const PUBLIC_KEY = fileURLToPath(new URL("./log-key.public", import.meta.url));
const [mode, input, output, privatePath] = process.argv.slice(2);

function encrypt(plain, key) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return { iv, tag: c.getAuthTag(), body };
}
function decrypt({ iv, tag, body }, key) {
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
}
function sharedKey() {
  const k = Buffer.from(process.env.BUILD_ARTIFACT_KEY ?? "", "base64");
  if (k.length !== 32) {
    console.log("REFUSED: BUILD_ARTIFACT_KEY is not set to 32 bytes of base64.");
    process.exit(1);
  }
  return k;
}
const OAEP = (key) => ({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" });

if (mode === "seal") {
  const key = randomBytes(32);
  const wrapped = publicEncrypt(OAEP(readFileSync(PUBLIC_KEY, "utf8")), key);
  const { iv, tag, body } = encrypt(readFileSync(input), key);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(wrapped.length);
  writeFileSync(output, Buffer.concat([MAGIC, len, wrapped, iv, tag, body]));
} else if (mode === "open") {
  const all = readFileSync(input);
  if (!all.subarray(0, 8).equals(MAGIC)) throw new Error(`${input} is not a sealed board file`);
  const n = all.readUInt16BE(8);
  const wrapped = all.subarray(10, 10 + n);
  const key = privateDecrypt(OAEP(readFileSync(privatePath, "utf8")), wrapped);
  const at = 10 + n;
  writeFileSync(output, decrypt({ iv: all.subarray(at, at + 12), tag: all.subarray(at + 12, at + 28), body: all.subarray(at + 28) }, key));
} else if (mode === "lock") {
  const { iv, tag, body } = encrypt(readFileSync(input), sharedKey());
  writeFileSync(output, Buffer.concat([MAGIC, iv, tag, body]));
} else if (mode === "unlock") {
  const all = readFileSync(input);
  if (!all.subarray(0, 8).equals(MAGIC)) throw new Error(`${input} is not a locked build`);
  writeFileSync(output, decrypt({ iv: all.subarray(8, 20), tag: all.subarray(20, 36), body: all.subarray(36) }, sharedKey()));
} else {
  console.log("usage: seal.mjs seal|open|lock|unlock <in> <out> [private.pem]");
  process.exit(1);
}
