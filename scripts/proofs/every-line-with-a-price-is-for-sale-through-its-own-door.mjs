/**
 * EVERY LINE WITH A PUBLISHED PRICE IS FOR SALE, AND EACH STILL SELLS ONLY
 * THROUGH ITS OWN DOOR. Robert's ruling of 2026-10-25, 23:50 Central.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/every-line-with-a-price-is-for-sale-through-its-own-door.mjs
 *
 * With every gate condition met (the gate fixture), in a child process, against
 * a database played by a fetch:
 *   - signed and trained, manufactured home, solar, WPI-8 (both tiers) and the
 *     repair specification are offered on /order at their published prices,
 *     and their money doors let an order through;
 *   - an unsigned line, and a signed line nobody is trained on, are refused at
 *     their door and offered as a quote, with no price;
 *   - roof, foundation and permit are unchanged, and design is still a quote;
 *   - and the configuration lists exactly the seven, pinned here as literals.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const SEVEN = [
  "roof-inspections",
  "foundation-inspections",
  "structural-letters",
  "manufactured-home-foundation-certifications",
  "solar-structural-letters",
  "windstorm-wpi-8",
  "repair-specifications",
];
const conditions = readFileSync("src/config/launch-conditions.ts", "utf8");
const listed = [...(conditions.match(/export const offeredServiceLines: string\[\] = \[([\s\S]*?)\];/)?.[1] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
check("configuration offers exactly the seven priced lines", JSON.stringify([...listed].sort()) === JSON.stringify([...SEVEN].sort()), listed.join(", "));

const { inOpenGateProcess } = await import("../lib/gate-fixture.mjs");
const child = await inOpenGateProcess(`
  process.env.SUPABASE_URL = "http://every-line-proof.supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "every-line-proof-not-a-key";
  delete process.env.VERCEL_ENV;
  const state = { signed: {}, trained: {} };
  const { transcriptionSha256 } = await import("./src/lib/protocol-sign.ts");
  const { SIGNABLE_PROTOCOLS } = await import("./src/content/protocols/signable.ts");
  const { protocolForLine } = await import("./src/content/protocols/index.ts");
  const { verifiedEngineers } = await import("./src/config/credentials.ts");
  const rc = protocolForLine("roof-inspections");
  const rcRow = {
    version_label: rc.declaration.version, status: "published", approved_by: "engineer",
    approved_by_license: verifiedEngineers[0] ? verifiedEngineers[0].licenseNumber : null,
    document_sha256: rc.versions.find((v) => v.supersededOn === null).sha256,
  };
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const param = (url, key) => (url.searchParams.get(key) || "").replace("eq.", "");
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "rpc/eng_line_is_trained") return json(state.trained[JSON.parse(init.body || "{}").p_service_slug] === true);
    if (table === "eng_seal_acts") {
      const sha = state.signed[param(url, "protocol_document") + " " + param(url, "protocol_version")];
      return json(sha ? [{ created_at: "2026-10-20T15:00:00Z", content_sha256: sha }] : []);
    }
    if (table === "eng_protocol_templates") {
      const doc = param(url, "document_number");
      return json(doc === "254-RC-001" ? [rcRow] : [{ id: "template-" + doc }]);
    }
    return json([]);
  };
  const signAll = () => {
    for (const p of SIGNABLE_PROTOCOLS) state.signed[p.documentNumber + " " + p.version] = transcriptionSha256(p.documentNumber, p.version);
  };
  const trainAll = () => { for (const p of SIGNABLE_PROTOCOLS) state.trained[p.serviceSlug] = true; };
  const { isOpen } = await import("./src/lib/launch.ts");
  const gate = await import("./src/lib/line-gate.ts");
  const { deliverablesFor } = await import("./data/catalog.ts");
  const realNow = Date.now;
  let tick = 0;
  /* Each read is a fresh minute, so the display cache never answers for the state before. */
  const fresh = () => { tick += 1; Date.now = () => realNow() + tick * (gate.DISPLAY_ANSWER_MS + 1); };
  const rows = async () => { fresh(); return (await gate.sellableLineOffers()).map((o) => ({ slug: o.slug, orderable: o.orderable, href: o.href, price: o.price })); };
  const doors = async () => {
    const out = {};
    for (const slug of ["manufactured-home-foundation-certifications", "solar-structural-letters", "windstorm-wpi-8", "repair-specifications", "roof-inspections", "foundation-inspections", "structural-letters"]) {
      for (const d of deliverablesFor(slug)) out[slug + "/" + d.tier] = await gate.orderBlockedNow(d, "open");
    }
    return out;
  };
  signAll(); trainAll();
  const open = { rows: await rows(), doors: await doors() };
  state.signed = {}; signAll(); delete state.signed["254-MH-001 1.1"];
  const unsignedMH = { rows: await rows(), doors: await doors() };
  state.trained = {}; trainAll(); delete state.trained["solar-structural-letters"];
  signAll();
  const untrainedSL = { rows: await rows(), doors: await doors(), why: await gate.lineIsSellable("solar-structural-letters", null) };
  Date.now = realNow;
  answer({ isOpen: isOpen(), open, unsignedMH, untrainedSL });
`);

const by = (rows, slug) => rows.find((r) => r.slug === slug) ?? {};
check("the child really has the gate open", child.isOpen === true);
const PRICE = {
  "manufactured-home-foundation-certifications": "$709",
  "solar-structural-letters": "$709",
  "windstorm-wpi-8": "$795",
  "repair-specifications": "$1,195",
  "roof-inspections": "$709",
  "foundation-inspections": "$709",
  "structural-letters": "$709",
};
for (const [slug, price] of Object.entries(PRICE)) {
  const row = by(child.open.rows, slug);
  check(
    `signed and trained: /order offers ${slug} at ${price} with an order link`,
    row.orderable === true && row.price === price && row.href === `/order/start/${slug}`,
    JSON.stringify(row),
  );
}
/*
 * WPI-8 ONGOING IS THE ONE DELIVERABLE STILL REFUSED, AND NOT BY THIS RULING.
 * Operator ruling of 2026-10-22: ongoing construction is not in the engineer's
 * Schedule 2 and needs a signed scope addendum before any job
 * (SCOPE_ADDENDUM_REQUIRED in src/config/engineer-pay.ts). Robert's ruling of
 * 2026-10-25 loosens nothing in the gate, so that guard stands, and its door
 * says the deliverable is not available yet. Since his ruling of 2026-10-26,
 * 07:10 Central (0095), it opens only on the engineer's signed per_job
 * addendum, read at the door; this child process signs none, so it is refused.
 */
const openDoors = Object.entries(child.open.doors).filter(([k]) => k !== "windstorm-wpi-8/ongoing");
check("every other deliverable's door, WPI-8 completed included, lets an order through", openDoors.length >= 7 && openDoors.every(([, v]) => v === null), JSON.stringify(child.open.doors));
check(
  "and WPI-8 ongoing is still refused by its scope addendum rule, the customer told only that it is not available yet",
  /not available to order yet/.test(String(child.open.doors["windstorm-wpi-8/ongoing"])),
  String(child.open.doors["windstorm-wpi-8/ongoing"]),
);
check("design is still a quote, never an order", by(child.open.rows, "residential-light-commercial-design").orderable === false);

check(
  "unsigned: the manufactured home door refuses, and /order offers it as a quote with no price",
  typeof child.unsignedMH.doors["manufactured-home-foundation-certifications/standard"] === "string" &&
    by(child.unsignedMH.rows, "manufactured-home-foundation-certifications").orderable === false &&
    by(child.unsignedMH.rows, "manufactured-home-foundation-certifications").price === null,
  JSON.stringify(child.unsignedMH.doors["manufactured-home-foundation-certifications/standard"]),
);
check(
  "untrained: the solar door refuses, the gate's reason is that nobody is trained, and /order offers it as a quote",
  typeof child.untrainedSL.doors["solar-structural-letters/standard"] === "string" &&
    child.untrainedSL.why.ok === false && /trained/i.test(child.untrainedSL.why.why) &&
    by(child.untrainedSL.rows, "solar-structural-letters").orderable === false,
  JSON.stringify(child.untrainedSL.why),
);
check(
  "and in both, roof, foundation and permit stay orderable at $709",
  ["roof-inspections", "foundation-inspections", "structural-letters"].every(
    (s) => by(child.unsignedMH.rows, s).price === "$709" && by(child.untrainedSL.rows, s).price === "$709",
  ),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: every line with a published price is for sale, and each still sells only through its own door.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
