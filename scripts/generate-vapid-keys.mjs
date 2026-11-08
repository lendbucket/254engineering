/**
 * THE FIRM'S WEB PUSH KEY PAIR, FOR ROBERT TO GENERATE HIMSELF.
 * Robert's T9, 2026-11-07 (src/lib/web-push.ts, src/config/credential-inventory.ts).
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Prints the three values to set in Vercel, Production only:
 *   VAPID_PUBLIC_KEY   the uncompressed P-256 point, base64url (public)
 *   VAPID_PRIVATE_KEY  the private scalar, base64url (SECRET)
 *   VAPID_SUBJECT      mailto: at the firm's domain
 *
 * A SESSION NEVER RUNS THIS. The private key belongs in Vercel and nowhere
 * else, and a key printed into a session's output is a key in a transcript.
 * Run it in a terminal of your own, paste the three values into Vercel, and
 * close the terminal. Nothing is written to disk.
 */
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const priv = privateKey.export({ format: "jwk" });
const pub = publicKey.export({ format: "jwk" });

const fromB64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const toB64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const point = Buffer.concat([Buffer.from([4]), fromB64url(pub.x), fromB64url(pub.y)]);
if (point.length !== 65) throw new Error("the public key is not a 65 byte uncompressed point");

console.log("Set these three in Vercel, Production only. Do not save them anywhere else.");
console.log("");
console.log(`VAPID_PUBLIC_KEY=${toB64url(point)}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
console.log("VAPID_SUBJECT=mailto:support@254engineering.com");
