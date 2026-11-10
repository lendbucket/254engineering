/**
 * PROOF: A PHONE HEARS OF AN OFFER, AND THE LOCK SCREEN SAYS COUNTY AND SERVICE.
 *
 * Robert's T9 and his answers 6 and 7 of 2026-11-07 (6717223376): web push
 * now, email on beside it; "'A job is offered to you: county, service', with
 * no address and no price on the lock screen."
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-phone-hears-of-an-offer-and-the-lock-screen-says-little.mjs
 *
 *   A  the wording: county and service, and nothing that could be an address
 *      or a price; a fallback that says only that a job is offered.
 *   B  the signature: a VAPID token signed with a key pair made here verifies
 *      against its public key, names the push service as audience, expires
 *      within the RFC's 24 hours, and names a mailto subject.
 *   C  the push itself: POST, no body, a TTL, the vapid Authorization; and a
 *      404 or 410 is read as the phone forgotten for good.
 *   D  the code: the offer's own notification still goes, the push goes beside
 *      it; a forgotten phone is stamped revoked; the lock screen's text reads
 *      only county and service, for the caller's own open offer; an endpoint
 *      that is not https is never stored.
 *   E  the worker, RUN: a push fetches the wording from the firm's server and
 *      shows it; with the server unreachable it shows the fallback; a tap
 *      opens My jobs.
 *   F  the table, replayed: row level security, one row per endpoint, https
 *      only, and a revocation that says why.
 */
import { generateKeyPairSync, verify } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";

const rules = await import("../../src/lib/offer-push-rules.ts");
const push = await import("../../src/lib/web-push.ts");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ----------------------------------------------------------------- A, the words */

const text = rules.offerPushText("Nueces", "Roof certification letters");
check("A: the title says a job is offered", text.title === "A job is offered to you");
check("A: the line names the county and the service", text.body === "A job is offered to you: Nueces County, Roof certification letters", text.body);
check("A: and carries no digit and no dollar sign, so no address number and no price", !/[0-9$]/.test(text.body + text.title));
const none = rules.offerPushText(null, null);
check("A: with nothing to name, it says only that a job is offered", !/[0-9$]/.test(none.body) && none.body.startsWith("A job is offered to you"));
check("A: the worker's fallback says no more", !/[0-9$]/.test(JSON.stringify(rules.OFFER_PUSH_FALLBACK)));

/* ------------------------------------------------------------- B, the signature */

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pj = publicKey.export({ format: "jwk" });
const point = new Uint8Array([4, ...rules.fromBase64url(pj.x), ...rules.fromBase64url(pj.y)]);
const config = { publicKey: rules.base64url(point), privateKey: privateKey.export({ format: "jwk" }).d, subject: "mailto:support@254engineering.com" };
const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
const now = 1_800_000_000;
const header = push.vapidAuthorization(endpoint, config, now);
const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
check("B: the header reads vapid t=<token>, k=<public key>", Boolean(m) && m[4] === config.publicKey);
const claims = m ? JSON.parse(new TextDecoder().decode(rules.fromBase64url(m[2]))) : {};
const signed = m ? verify("sha256", new TextEncoder().encode(`${m[1]}.${m[2]}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, rules.fromBase64url(m[3])) : false;
check("B: the token verifies against the public key", signed === true);
check("B: its audience is the push service's origin", claims.aud === "https://fcm.googleapis.com", claims.aud);
check("B: it expires within 24 hours", claims.exp > now && claims.exp - now <= 24 * 3600, String(claims.exp - now));
check("B: its subject is a mailto address", typeof claims.sub === "string" && claims.sub.startsWith("mailto:"));

/* --------------------------------------------------------------- C, the push */

const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  sent.push({ url: String(url), init });
  return new Response(null, { status: 201 });
};
const status = await push.sendEmptyPush(endpoint, config);
globalThis.fetch = realFetch;
const req = sent[0]?.init ?? {};
check("C: it POSTs to the phone's endpoint", sent[0]?.url === endpoint && req.method === "POST", sent[0]?.url);
check("C: with no body", req.body === undefined || req.body === null);
check("C: with a TTL and the vapid Authorization", typeof req.headers?.TTL === "string" && String(req.headers?.Authorization).startsWith("vapid t="));
check("C: and reports the push service's answer", status === 201);
check("C: 404 and 410 mean the phone is gone for good, and nothing else does", rules.subscriptionGone(404) && rules.subscriptionGone(410) && !rules.subscriptionGone(500) && !rules.subscriptionGone(429));

/* ------------------------------------------------------------------- D, the code */

const field = readSource("src/lib/ops-field.ts");
const sendAt = field.indexOf("export async function sendOffers(");
const send = field.slice(sendAt, field.indexOf("\nexport ", sendAt + 10));
const raiseAt = send.indexOf('kind: "offer.received"');
const pushAt = send.indexOf("await pushOfferTo(id, {");
check("D: the offer's own notification still goes", raiseAt > 0);
check("D: and the push goes beside it, after it, for each technician offered", pushAt > raiseAt);
const ops = readSource("src/lib/ops-push.ts");
check(
  "D: a forgotten phone is stamped revoked on the database's clock, never deleted",
  /subscriptionGone\(status\)/.test(ops) && ops.includes("revoked_at: DB_NOW, revoked_reason: `the push service answered ${status}`") && !/\.delete\(\)/.test(ops),
);
const latestAt = ops.indexOf("export async function latestOfferPushFor(");
const latest = ops.slice(latestAt);
check("D: the lock screen's text is the caller's own open offer", latest.includes('.eq("tech_id", actor.id)') && latest.includes('.eq("state", "offered")'));
check("D: and reads only the county and the service from the file", latest.includes('.select("county, service_slug")') && !/property_address|offer_amount|amount_cents|price/.test(latest));
check("D: an endpoint that is not https, or not a string, is never stored", !rules.endpointAcceptable("http://x.test/a") && !rules.endpointAcceptable(42) && rules.endpointAcceptable(endpoint));
const route = readSource("src/app/api/portal/field/route.ts");
check("D: the route has the four push actions", ["push_key", "push_subscribe", "push_unsubscribe", "push_latest"].every((a) => route.includes(`action === "${a}"`)));

/* -------------------------------------------------------------- E, the worker, RUN */

const sw = await (await import("../../src/app/field-sw.js/route.ts")).GET().text();
const listeners = {};
const shown = [];
const opened = [];
let serverUp = true;
new Function("self", "caches", "fetch", sw)(
  {
    location: { origin: "https://254engineering.com" },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve(), openWindow: async (u) => { opened.push(u); } },
    registration: { showNotification: async (title, options) => { shown.push({ title, ...options }); } },
  },
  { open: async () => ({ match: async () => undefined, put: async () => {} }), keys: async () => [], delete: async () => true },
  async (url, init) => {
    if (!serverUp) throw new TypeError("Failed to fetch");
    const asked = JSON.parse(init?.body ?? "{}");
    return new Response(JSON.stringify(asked.action === "push_latest" ? { ok: true, ...text } : { ok: false }), { status: 200 });
  },
);
const fire = async (type, event) => {
  let waited = null;
  listeners[type]({ ...event, waitUntil: (p) => { waited = p; } });
  if (waited) await waited;
};
check("E: the worker listens for a push and a tap", typeof listeners.push === "function" && typeof listeners.notificationclick === "function");
await fire("push", {});
check("E: a push shows the server's wording", shown[0]?.title === text.title && shown[0]?.body === text.body, JSON.stringify(shown[0]));
serverUp = false;
await fire("push", {});
check("E: with the server unreachable it shows only the fallback", shown[1]?.body === rules.OFFER_PUSH_FALLBACK.body);
await fire("notificationclick", { notification: { close: () => {} } });
check("E: a tap opens My jobs", opened[0] === "/portal/jobs");

/* -------------------------------------------------------------- F, the table */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));
const rls = (await db.query(`select relrowsecurity from pg_class where oid = 'public.eng_push_subscriptions'::regclass`)).rows[0]?.relrowsecurity;
check("F: row level security is on", rls === true);
const PROFILE = "00000000-0000-4000-8000-0000000000aa";
await db.exec(`insert into auth.users (id) values ('${PROFILE}');
  insert into eng_profiles (id, email, display_name, role, status) values ('${PROFILE}', 'push-proof@audit-probe.invalid', 'Push proof, not a real person', 'field_tech', 'active');`);
const refused = async (sql) => {
  try { await db.query(sql); return ""; } catch (e) { return String(e?.message ?? e); }
};
check("F: an https endpoint is taken", (await refused(`insert into eng_push_subscriptions (profile_id, endpoint) values ('${PROFILE}', 'https://push.example/1')`)) === "");
check("F: the same endpoint twice is refused", (await refused(`insert into eng_push_subscriptions (profile_id, endpoint) values ('${PROFILE}', 'https://push.example/1')`)).includes("eng_push_subscriptions_endpoint_once"));
check("F: an http endpoint is refused", (await refused(`insert into eng_push_subscriptions (profile_id, endpoint) values ('${PROFILE}', 'http://push.example/2')`)).includes("eng_push_subscriptions_endpoint_fits_channel"));
check("F: a store app token is taken on its channel (T8)", (await refused(`insert into eng_push_subscriptions (profile_id, channel, endpoint) values ('${PROFILE}', 'fcm', 'fcm-token-abcdefghijklmnop')`)) === "");
check("F: a token with whitespace is refused", (await refused(`insert into eng_push_subscriptions (profile_id, channel, endpoint) values ('${PROFILE}', 'apns', 'apns token with spaces in it')`)).includes("eng_push_subscriptions_endpoint_fits_channel"));
check("F: an unknown channel is refused", (await refused(`insert into eng_push_subscriptions (profile_id, channel, endpoint) values ('${PROFILE}', 'sms', 'abcdefghijklmnopqrstu')`)).includes("eng_push_subscriptions_channel_known"));

/* ------------------------------------------------------- G, the store app's push (T8) */

check("G: the channel a request names is web, fcm or apns, and nothing else", rules.pushChannelFrom(undefined) === "web" && rules.pushChannelFrom("fcm") === "fcm" && rules.pushChannelFrom("sms") === null);
check("G: a native token fits its channel and a web address does not pass as one", rules.endpointFitsChannel("fcm", "abcdefghijklmnopqrst") && !rules.endpointFitsChannel("web", "abcdefghijklmnopqrst"));
const pushOffer = ops.slice(ops.indexOf("export async function pushOfferTo("), ops.indexOf("export async function latestOfferPushFor("));
check("G: every channel gets the one wording, county and service, built by offerPushText", pushOffer.includes("const text = offerPushText(offer.county, offer.serviceName);") && /sendFirebase\(sub\.endpoint as string, text\)/.test(pushOffer) && /sendApns\(sub\.endpoint as string, text\)/.test(pushOffer));
check("G: the offer hands the push its county and service only", /await pushOfferTo\(id, \{\s*county: \(file\.county as string \| null\) \?\? null,\s*serviceName: services\.find/.test(send));
const native = readSource("src/lib/native-push.ts");
check("G: a native push carries only the title and the line it is given, and the jobs screen to open", /notification: \{ title: text\.title, body: text\.body \}/.test(native) && /alert: \{ title: text\.title, body: text\.body \}/.test(native) && !/address|amount|price|cents/i.test(native.replace(/\/\*[\s\S]*?\*\//g, "")));
check("F: a revocation with no reason is refused", (await refused(`update eng_push_subscriptions set revoked_at = now() where endpoint = 'https://push.example/1'`)).includes("eng_push_subscriptions_revocation_says_why"));

/* ------------------------------------------- H, sign out turns this phone's alerts off (T8, answer 5) */

const forget = readSource("src/lib/offer-alerts-client.ts");
const forgetBody = forget.slice(forget.indexOf("export async function forgetOfferAlerts("));
check("H: turning alerts off at sign out revokes the server row through push_unsubscribe", /action: "push_unsubscribe", endpoint/.test(forgetBody));
check("H: in the store app it forgets the remembered token, and in a browser it removes the subscription", /localStorage\.removeItem\(NATIVE_TOKEN_KEY\)/.test(forgetBody) && /sub\.unsubscribe\(\)/.test(forgetBody));
check("H: sign out never waits on it for long: it races a timer", /Promise\.race\(\[work, new Promise<void>\(\(resolve\) => setTimeout\(resolve, SIGN_OUT_WAIT_MS\)\)\]\)/.test(forgetBody));
for (const file of ["src/components/portal/PortalChrome.tsx", "src/components/portal/SignOutControl.tsx"]) {
  const src = readSource(file);
  const at = src.indexOf("await forgetOfferAlerts();");
  const ends = src.indexOf('fetch("/api/portal/session", { method: "DELETE" })');
  check(`H: ${file.split("/").pop()} turns this phone's alerts off before the session ends`, at !== -1 && ends !== -1 && at < ends, `${at} before ${ends}`);
}
check("H: the token's storage key has one home", !/"eng-native-push-token"/.test(readSource("src/app/portal/(app)/jobs/OfferAlerts.tsx")) && /export const NATIVE_TOKEN_KEY = "eng-native-push-token";/.test(forget));

console.log(wrong === 0 ? "PASS: a phone hears of an offer, and the lock screen says little." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
