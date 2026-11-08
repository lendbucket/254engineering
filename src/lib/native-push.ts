import "server-only";
import { connect } from "node:http2";
import { createPrivateKey, createSign, sign } from "node:crypto";
import { base64url } from "./offer-push-rules";

/**
 * PUSH TO THE STORE APP: FIREBASE ON ANDROID, APPLE ON IPHONE. Robert's T8,
 * 2026-11-08: "Push: Apple's service on iPhone and Firebase on Android. It
 * reuses T9's subscription table and push channel, and the lock screen text
 * stays county and service only."
 *
 * The text a native push carries is built by offerPushText (offer-push-rules.ts)
 * from the offer's county and service and nothing else, by the caller
 * (ops-push.ts, pushOfferTo). It is the same wording the browser's service
 * worker asks the server for. No library: Firebase's OAuth token is an RS256
 * JWT signed here, and Apple's is an ES256 JWT sent over HTTP/2, which Apple
 * requires.
 *
 * THE KEYS, all declared in src/config/credential-inventory.ts, all Production
 * only, none set yet:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  the service account Firebase gives for its HTTP v1 API (secret)
 *   APNS_KEY_P8                    the .p8 signing key from the Apple account (secret)
 *   APNS_KEY_ID, APNS_TEAM_ID      its identifiers
 *   APNS_TOPIC                     the app's bundle identifier
 * Absent the keys for a channel, nothing is sent on it, and the phone still
 * hears of the offer by email, as every technician does today.
 */

export type NativeSend = { status: number | null; gone: boolean };

/* ------------------------------------------------------------------ Firebase */

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function firebaseAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    return parsed.client_email && parsed.private_key && parsed.project_id ? (parsed as ServiceAccount) : null;
  } catch {
    return null;
  }
}

let firebaseToken: { value: string; until: number } | null = null;

async function firebaseAccessToken(account: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (firebaseToken && firebaseToken.until > now + 60) return firebaseToken.value;
  const enc = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  const input = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  const jwt = `${input}.${base64url(new Uint8Array(signer.sign(account.private_key)))}`;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;
    firebaseToken = { value: body.access_token, until: now + (body.expires_in ?? 3600) };
    return body.access_token;
  } catch {
    return null;
  }
}

/** Send one notification to an Android phone by its Firebase token. */
export async function sendFirebase(token: string, text: { title: string; body: string }): Promise<NativeSend> {
  const account = firebaseAccount();
  if (!account) return { status: null, gone: false };
  const access = await firebaseAccessToken(account);
  if (!access) return { status: null, gone: false };
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: text.title, body: text.body },
          android: { priority: "high", notification: { tag: "offer" } },
          data: { url: "/portal/jobs" },
        },
      }),
    });
    /* Firebase answers 404 UNREGISTERED for a token the phone no longer holds. */
    return { status: res.status, gone: res.status === 404 };
  } catch {
    return { status: null, gone: false };
  }
}

/* ------------------------------------------------------------------- Apple */

type ApnsConfig = { key: string; keyId: string; teamId: string; topic: string };

function apnsConfig(): ApnsConfig | null {
  const key = process.env.APNS_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const topic = process.env.APNS_TOPIC;
  return key && keyId && teamId && topic ? { key, keyId, teamId, topic } : null;
}

function apnsJwt(config: ApnsConfig): string {
  const enc = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  const input = `${enc({ alg: "ES256", kid: config.keyId })}.${enc({ iss: config.teamId, iat: Math.floor(Date.now() / 1000) })}`;
  const signature = sign("sha256", new TextEncoder().encode(input), { key: createPrivateKey(config.key), dsaEncoding: "ieee-p1363" });
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

/** Send one notification to an iPhone by its Apple device token, over HTTP/2 as Apple requires. */
export async function sendApns(token: string, text: { title: string; body: string }): Promise<NativeSend> {
  const config = apnsConfig();
  if (!config) return { status: null, gone: false };
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: NativeSend) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    try {
      const client = connect("https://api.push.apple.com");
      client.on("error", () => done({ status: null, gone: false }));
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${apnsJwt(config)}`,
        "apns-topic": config.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      req.on("response", (headers) => {
        const status = Number(headers[":status"]);
        /* Apple answers 410 Unregistered, and 400 BadDeviceToken, for a token no phone holds. */
        done({ status, gone: status === 410 });
        client.close();
      });
      req.on("error", () => {
        done({ status: null, gone: false });
        client.close();
      });
      req.end(JSON.stringify({ aps: { alert: { title: text.title, body: text.body }, "thread-id": "offer" }, url: "/portal/jobs" }));
      setTimeout(() => {
        done({ status: null, gone: false });
        client.close();
      }, 10_000);
    } catch {
      done({ status: null, gone: false });
    }
  });
}
