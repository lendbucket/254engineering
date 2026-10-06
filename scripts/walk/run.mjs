/**
 * ===========================================================================
 * THE STAFF WALK. Operator ruling, 2026-10-03, option 2 with five conditions.
 * ===========================================================================
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/walk/run.mjs
 *
 * Four roles, every signed in staff screen the surface inventory declares, the
 * controls on each, the rules that govern who sees what, and the failure paths.
 * Development only. It changes no product code and proposes every fix in the
 * report instead.
 *
 * ===========================================================================
 * WHAT IT REFUSES TO DO.
 * ===========================================================================
 *
 * No Stripe, no Checkr, no email, no SMS, no production write. The order was
 * seeded already paid in phase 1. Anything that would SEND is read back from the
 * queue rather than drained. No seal or signature image is composed: a sealed
 * document is uploaded and never generated, which is standing law, and there is
 * no seal image in this repository to use even if it were not.
 *
 * ===========================================================================
 * THE ACCESS MATRIX IS DATA, NOT A VERDICT, AND THE FIRST VERSION GOT THAT
 * WRONG.
 * ===========================================================================
 *
 * It asserted that a role may open a screen only when `roleFor` names that role,
 * and reported 36 failures. Every one was the harness misreading the inventory:
 * `roleFor` names the principal a PROBE should use when the default cannot open
 * a screen, which `docs/new-surface-checklist.md` states in those words. It is
 * not an exclusive access rule, and an engineer opening the files list is
 * correct.
 *
 * So who-opens-what is RECORDED and reported as a matrix, and the pass or fail
 * assertions are kept for rules that actually exist:
 *
 *   1. THE ENGINEER SEES NO MONEY. CLAUDE.md section 6b-i, the operator's ruling
 *      of 2026-09-24, in his words: no order totals, no price charged, no costs,
 *      no margin, no partner commission, no technician pay, in any screen. The
 *      one exception is his OWN pay, which is why /portal/pay is excluded by
 *      name and nothing else is.
 *   2. A refused screen redirects rather than erroring.
 *   3. Every control carries a name, every input a label, no dead links.
 */
process.loadEnvFile?.(".env.local");

import { mkdirSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

import { auditClient, describeTarget, refOf, DEVELOPMENT_REF } from "../lib/db-target.mjs";
import {
  PROBE_DOMAIN,
  createProbe,
  cookieFor,
  createCustomerProbe,
  customerCookieFor,
  destroyProbes,
  destroyCustomerProbes,
} from "../lib/portal-probe.mjs";
import { allPages } from "../lib/surfaces.mjs";
import { startNextServer } from "../lib/dev-server.mjs";
import { takeLock } from "../lib/machine-lock.mjs";
import { PORTS } from "../lib/ports.mjs";

const LABEL = "staff-walk";
const ROLES = ["engineer", "field_tech", "admin", "customer_service"];
const OUT = "docs/audits/walk-captures";

const permanent = [];
const record = (table, id, note) => {
  permanent.push({ table, id, note });
  console.log(`  created  ${table.padEnd(24)} ${id}  ${note}`);
};

/**
 * THREE VERDICTS, NOT TWO. `pass` of null is COULD NOT TELL.
 *
 * "Unreachable is not failed" is standing law, and 2026-09-22 extended it to a
 * check whose SUBJECT could not be built: saying FAIL claims the property was
 * measured and found wrong, when it was never measured. A walk reporting a
 * missing fixture as a defect in the product is the same lie one level in.
 */
const results = [];
const check = (role, screen, action, expected, actual, pass, repro = "") =>
  results.push({ role, screen, action, expected, actual, pass, repro });

/** role -> screen -> "open" | "redirected to X" | "404" | "error" */
const matrix = {};

const db = auditClient(LABEL, { neverProduction: true });
if (!db) {
  console.log("COULD NOT TELL: no database client.");
  process.exit(1);
}
if (refOf(process.env.SUPABASE_URL) !== DEVELOPMENT_REF) {
  console.log("REFUSING: this walk writes, and only to development.");
  process.exit(1);
}
console.log(describeTarget(process.env.SUPABASE_URL));
console.log("no Stripe, no Checkr, no email, no SMS, no production write\n");

mkdirSync(OUT, { recursive: true });

const release = await takeLock({
  project: "254engineering",
  label: "staff walk",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

let server = null;
const probes = {};
let customer = null;
let browser = null;

const CAPTURE = new Set(["/portal", "/portal/review", "/portal/files", "/portal/jobs", "/portal/certification"]);

/** Money on screen, as a reader meets it. Ignores anything inside a script. */
const MONEY = /\$\s?\d[\d,]*(\.\d{2})?/g;

/**
 * The job this walk drives, named by the operator rather than discovered.
 *
 * Pinned as literals on purpose. Finding "the most recent demonstration file"
 * would make the walk report on whatever happened to be newest, which is the
 * wrong-subject defect: the report would name a reference nobody asked about
 * and read exactly like a report about this one.
 */
const WALK_ORDER = "254-DEMO-W320332";
const WALK_FILE = "254-DEMO-F320332";

/**
 * A 1x1 transparent PNG, written out as bytes rather than fetched.
 *
 * It is the smallest thing that is genuinely a photograph as far as the upload
 * path is concerned: a real content type, real bytes, a real signed URL. What
 * it depicts is nothing, which is the point, because no real property is being
 * photographed by a walk.
 */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * The queue, COUNTED and then SAMPLED, which is two reads on purpose.
 *
 * CLAUDE.md records the defect this avoids twice: a bounded read whose LENGTH
 * is reported as the size of the set, once at PostgREST's silent 1000 and once
 * at a hand written `.limit(20)` that reported 20 of 668 and hid a whole job
 * kind. So the depth is an exact count, the kinds are a distinct read, and only
 * the few rows PRINTED come from a limit.
 */
async function queueDepth(db) {
  const { count } = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "running"]);
  const { data: all } = await db.from("eng_jobs").select("kind").in("status", ["pending", "running"]);
  const { data: sample } = await db
    .from("eng_jobs")
    .select("id, kind, status, created_at")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(8);
  return {
    total: count ?? 0,
    kinds: [...new Set((all ?? []).map((j) => j.kind))].sort(),
    sample: sample ?? [],
  };
}

/** The photograph items on the published protocol for a service line. */
async function photoItemKeys(db, serviceSlug) {
  const { data: template } = await db
    .from("eng_protocol_templates")
    .select("id, version")
    .eq("service_slug", serviceSlug)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!template) return { templateId: null, photo: [], required: 0 };
  const { data: items } = await db
    .from("eng_protocol_items")
    .select("item_key, kind, required")
    .eq("template_id", template.id)
    .order("sort_order");
  return {
    templateId: template.id,
    photo: (items ?? []).filter((i) => i.kind === "photo").map((i) => i.item_key),
    required: (items ?? []).filter((i) => i.required).length,
  };
}

/**
 * Files under the named roots whose NAME matches. A source assertion, so the
 * standing law about seal images is checked against disk rather than quoted.
 */
function sourceFilesMatching(pattern, roots = ["src", "public", "design-reference"]) {
  const hits = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (pattern.test(e.name)) hits.push(full);
    }
  };
  for (const r of roots) walk(r);
  return hits;
}

try {
  server = await startNextServer({ port: PORTS.overnightRoles, command: "dev", timeoutMs: 180_000 });
  console.log(`server up at ${server.base}\n`);

  console.log("=== PROBES ===");
  for (const role of ROLES) {
    const p = await createProbe(server.base, role, LABEL);
    probes[role] = p;
    if (p.fault) console.log(`  FAULT ${role}: ${p.fault}`);
    else record("eng_profiles", p.id, `${role}, ${p.email}`);
  }
  customer = await createCustomerProbe(server.base, LABEL);
  if (customer.fault) console.log(`  FAULT customer: ${customer.fault}`);
  else {
    const { data: cr } = await db.from("eng_clients").select("id").eq("email", customer.email).maybeSingle();
    customer.clientId = cr?.id ?? null;
    record("eng_clients", customer.clientId ?? "(unread)", "customer's client");
    record("eng_customer_accounts", customer.accountId, "customer account");
    record("eng_customer_users", customer.userId, "customer sign in");
  }

  browser = await chromium.launch();
  const pages = allPages().filter((p) => p.session === "staff");
  console.log(`\n=== ${pages.length} staff screens x ${ROLES.length} roles ===`);

  for (const role of ROLES) {
    const probe = probes[role];
    if (!probe || probe.fault) continue;
    matrix[role] = {};
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies(cookieFor(probe, server.base));
    const page = await context.newPage();

    for (const screen of pages) {
      let status = 0;
      let landed = "";
      try {
        const res = await page.goto(server.base + screen.path, { waitUntil: "domcontentloaded", timeout: 45_000 });
        status = res?.status() ?? 0;
        await page.waitForTimeout(350);
        landed = new URL(page.url()).pathname;
      } catch (e) {
        matrix[role][screen.path] = "error";
        check(role, screen.path, "opens or refuses cleanly", "a page or a redirect",
          `navigation failed: ${String(e).slice(0, 60)}`, false, `sign in as ${role}, open ${screen.path}`);
        continue;
      }

      const redirected = landed !== screen.path;
      if (status === 404) matrix[role][screen.path] = "404";
      else if (redirected) matrix[role][screen.path] = `redirected to ${landed}`;
      else matrix[role][screen.path] = "open";

      /* A refusal must be a redirect or a 404, never a 500 or a broken render. */
      check(role, screen.path, "refuses cleanly when it refuses",
        "200, a redirect, or 404", `HTTP ${status} at ${landed}`,
        status === 200 || status === 404,
        `sign in as ${role}, open ${screen.path}`);

      if (status !== 200 || redirected) continue;

      const seen = await page.evaluate(() => {
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const named = (el) => (el.getAttribute("aria-label") || el.textContent || "").trim();
        const buttons = [...document.querySelectorAll("button")].filter(vis);
        const links = [...document.querySelectorAll("a[href]")].filter(vis);
        const inputs = [...document.querySelectorAll("input, select, textarea")].filter(
          (i) => vis(i) && i.type !== "hidden",
        );
        const main = document.querySelector("main") || document.body;
        const text = (main.innerText || "").replace(/\s+/g, " ");
        return {
          buttons: buttons.length,
          unlabelled: buttons.filter((b) => named(b) === "").length,
          links: links.length,
          deadLinks: links.filter((a) => {
            const h = a.getAttribute("href") || "";
            return h === "" || h === "#" || h.startsWith("javascript:");
          }).length,
          inputs: inputs.length,
          unlabelledInputs: inputs
            .filter((i) => {
              if (i.getAttribute("aria-label") || i.getAttribute("aria-labelledby")) return false;
              if (i.closest("label")) return false;
              const id = i.getAttribute("id");
              return !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
            })
            .map((i) => `${i.tagName.toLowerCase()}[type=${i.getAttribute("type") ?? "-"}]`),
          text,
        };
      });

      check(role, screen.path, "every button carries a name", "0 unlabelled",
        `${seen.unlabelled} of ${seen.buttons}`, seen.unlabelled === 0,
        `sign in as ${role}, open ${screen.path}, find a button with no text and no aria-label`);
      check(role, screen.path, "no dead link", "0 href empty, # or javascript:",
        `${seen.deadLinks} of ${seen.links}`, seen.deadLinks === 0,
        `sign in as ${role}, open ${screen.path}, inspect anchors`);
      check(role, screen.path, "every input is labelled", "0 unlabelled",
        seen.unlabelledInputs.length ? `${seen.unlabelledInputs.length} of ${seen.inputs}: ${seen.unlabelledInputs.slice(0, 4).join(", ")}` : `0 of ${seen.inputs}`,
        seen.unlabelledInputs.length === 0,
        `sign in as ${role}, open ${screen.path}, inspect inputs with no label, no wrapping label and no aria-label`);

      /*
       * ==================================================================
       * THE ENGINEER SEES NO MONEY EXCEPT HIS OWN PAY.
       * Operator ruling 2026-09-24, CLAUDE.md section 6b-i.
       * ==================================================================
       *
       * THE FIRST VERSION OF THIS CHECK EXCLUDED ONLY /portal/pay AND REPORTED
       * TWO VIOLATIONS THAT ARE NOT. The ruling is "no money except his own
       * pay", and his own pay appears on three screens, not one:
       *
       *   /portal          the dashboard tile reads eng_production_ledger
       *                    filtered to engineer_id = actor.id. Its own comment
       *                    says a figure an engineer will not be paid is "the
       *                    defect class with a person attached", and it excludes
       *                    demonstrations for that reason.
       *   /portal/pay      his pay, by name.
       *   /portal/reports  he holds `reports.production` and nothing else. The
       *                    grant's comment: "The production report and nothing
       *                    else: it describes their own work. No revenue, no
       *                    pipeline, no partner." ReportCoverage carries "the
       *                    reader's own work" for exactly this.
       *
       * Both figures were $0.00 on a fresh probe, which is what an engineer who
       * has reviewed nothing is owed. Reporting those as a compliance breach
       * would have been a false alarm about the ruling that matters most.
       *
       * WHAT THE CHECK IS WORTH KEEPING FOR is the other thirty-odd screens. The
       * engineer opens the files list, the clients list, documents and messages,
       * and shows a currency amount on NONE of them. That is 6b-i working, and
       * it is only visible because the check sweeps everything and excuses three.
       */
      const OWN_PAY = new Set(["/portal", "/portal/pay", "/portal/reports"]);
      if (role === "engineer" && !OWN_PAY.has(screen.path)) {
        const amounts = [...(seen.text.match(MONEY) ?? [])];
        check(role, screen.path, "the engineer sees no money",
          "no currency amount outside /portal/pay",
          amounts.length ? `${amounts.length} amount(s): ${[...new Set(amounts)].slice(0, 5).join(", ")}` : "none",
          amounts.length === 0,
          `sign in as an engineer, open ${screen.path}, look for a currency amount`);
      }

      if (CAPTURE.has(screen.path) && role === "admin") {
        for (const w of [1280, 390]) {
          const c2 = await browser.newContext({ viewport: { width: w, height: 900 } });
          await c2.addCookies(cookieFor(probe, server.base));
          const p2 = await c2.newPage();
          await p2.goto(server.base + screen.path, { waitUntil: "domcontentloaded", timeout: 45_000 });
          await p2.waitForTimeout(700);
          const name = (screen.path.replace(/\//g, "-").replace(/^-/, "") || "root");
          await p2.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
          await c2.close();
        }
      }
    }
    await context.close();
    const mine = results.filter((r) => r.role === role);
    console.log(`  ${role.padEnd(17)} ${mine.filter((r) => r.pass).length}/${mine.length}`);
  }

  /* ------------------------------------------------- the end to end job */
  console.log(`\n=== END TO END, ${WALK_FILE} ===`);
  const e2e = {};
  {
    const statusOf = async (id) => {
      const { data } = await db.from("eng_files").select("status, assigned_tech_id").eq("id", id).maybeSingle();
      return data ?? {};
    };

    const { data: file } = await db
      .from("eng_files")
      .select("id, file_number, client_id, service_slug, status, is_demo")
      .eq("file_number", WALK_FILE)
      .maybeSingle();

    if (!file) {
      check("admin", "end to end", "the walk file is present",
        `${WALK_FILE} exists, seeded by phase 1`, "not found", false,
        `select from eng_files where file_number = '${WALK_FILE}'`);
    } else {
      e2e.fileId = file.id;
      check("admin", "end to end", "the walk file is a demonstration",
        "is_demo true", `is_demo ${file.is_demo}, status ${file.status}`, file.is_demo === true,
        "read the walk file");

      const adminCtx = await browser.newContext();
      await adminCtx.addCookies(cookieFor(probes.admin, server.base));
      const techCtx = await browser.newContext();
      await techCtx.addCookies(cookieFor(probes.field_tech, server.base));
      const engCtx = await browser.newContext();
      await engCtx.addCookies(cookieFor(probes.engineer, server.base));

      const post = (ctx, route, data) =>
        ctx.request.post(`${server.base}/api/portal/${route}`, { data, failOnStatusCode: false });

      /*
       * ===================================================================
       * 1. DISPATCH, THROUGH THE OFFER PATH RATHER THAN THROUGH THE STATUS.
       * ===================================================================
       *
       * A `transition` straight to `dispatched` is REFUSED by canTransition
       * unless a technician has accepted, and its reason is the sentence worth
       * quoting: "a file marked dispatched with nobody on it is not a status,
       * it is a lie". So the walk takes the path a person takes. The refusal is
       * exercised too, below, because a guard nobody tries is a guard nobody
       * has seen work.
       */
      const premature = await post(adminCtx, "files", {
        action: "transition", fileId: file.id, to: "dispatched", note: "staff walk, before any offer",
      });
      const prematureBody = await premature.text();
      check("admin", "/api/portal/files", "a file cannot be dispatched with nobody on it",
        "4xx, naming that no technician has accepted",
        `HTTP ${premature.status()}: ${prematureBody.slice(0, 110)}`,
        premature.status() >= 400 && /accepted this job|technician/i.test(prematureBody),
        `as admin, POST /api/portal/files {action:'transition', to:'dispatched'} on a file with no technician`);

      const offer = await post(adminCtx, "field", {
        action: "send_offers", fileId: file.id, techIds: [probes.field_tech.id],
      });
      const offerBody = await offer.text();
      check("admin", "/api/portal/field", "the job is offered to a technician",
        "HTTP 200 and one offer sent",
        `HTTP ${offer.status()}: ${offerBody.slice(0, 110)}`,
        offer.status() === 200 && /"sent":1/.test(offerBody),
        `as admin, POST /api/portal/field {action:'send_offers', fileId, techIds:[the tech]}`);

      const { data: offers } = await db
        .from("eng_assignments")
        .select("id, state, tech_id")
        .eq("file_id", file.id);
      for (const o of offers ?? []) record("eng_assignments", o.id, `offer to the probe technician, ${o.state}`);

      const offerId = (offers ?? [])[0]?.id ?? null;
      if (offerId) {
        const accept = await post(techCtx, "field", { action: "accept_offer", offerId });
        const acceptBody = await accept.text();
        const s = await statusOf(file.id);
        check("field_tech", "/api/portal/field", "the technician accepts and the file is dispatched",
          "HTTP 200, the file reads dispatched and carries the technician",
          `HTTP ${accept.status()}, status ${s.status}, tech ${s.assigned_tech_id ? "assigned" : "none"}${accept.status() >= 400 ? `: ${acceptBody.slice(0, 90)}` : ""}`,
          accept.status() === 200 && s.status === "dispatched" && Boolean(s.assigned_tech_id),
          "as the technician, POST /api/portal/field {action:'accept_offer', offerId}");

        /* The same acceptance again. This is the shape a back button produces. */
        const again = await post(techCtx, "field", { action: "accept_offer", offerId });
        const againBody = await again.text();
        check("field_tech", "/api/portal/field", "accepting twice is refused rather than applied twice",
          "4xx with a sentence; the file still carries one technician",
          `HTTP ${again.status()}: ${againBody.slice(0, 100)}`,
          again.status() >= 400 && again.status() < 500,
          "accept the same offer, then press back and submit it again");
      } else {
        check("field_tech", "/api/portal/field", "the technician accepts and the file is dispatched",
          "an offer row to accept", "no offer row was created, so acceptance could not be tried (no probe)", false,
          "send_offers, then read eng_dispatch_offers for the file");
      }

      /*
       * ===================================================================
       * 2. THE VISIT AND THE PHOTOGRAPHS.
       * ===================================================================
       */
      const started = await post(techCtx, "files", {
        action: "transition", fileId: file.id, to: "evidence_in_progress", note: "staff walk: on site",
      });
      const startedBody = await started.text();
      check("field_tech", "/api/portal/files", "the technician starts capturing",
        "HTTP 200 and the file reads evidence_in_progress",
        `HTTP ${started.status()}, status ${(await statusOf(file.id)).status}${started.status() >= 400 ? `: ${startedBody.slice(0, 90)}` : ""}`,
        started.status() === 200,
        "as the technician, POST /api/portal/files {action:'transition', to:'evidence_in_progress'}");

      /* WRONG FILE TYPE, on the real route, before any good upload. */
      const badType = await post(techCtx, "field", {
        action: "sign_upload", fileId: file.id, captureId: `cap_${randomUUID()}`,
        contentType: "application/x-msdownload", size: 2048,
      });
      const badTypeBody = await badType.text();
      check("field_tech", "/api/portal/field", "an unaccepted file type is refused with a sentence",
        "4xx naming what is accepted, not a constraint name",
        `HTTP ${badType.status()}: ${badTypeBody.slice(0, 110)}`,
        badType.status() >= 400 && /photograph|pdf/i.test(badTypeBody),
        "as the technician, POST sign_upload with contentType application/x-msdownload");

      /* And an oversized one, which is the other half of the same guard. */
      const tooBig = await post(techCtx, "field", {
        action: "sign_upload", fileId: file.id, captureId: `cap_${randomUUID()}`,
        contentType: "image/jpeg", size: 40 * 1024 * 1024,
      });
      const tooBigBody = await tooBig.text();
      check("field_tech", "/api/portal/field", "an oversized capture is refused with a size",
        "4xx naming the limit",
        `HTTP ${tooBig.status()}: ${tooBigBody.slice(0, 90)}`,
        tooBig.status() >= 400 && /15MB|over/i.test(tooBigBody),
        "as the technician, POST sign_upload with size 40MB");

      /*
       * A REAL PHOTOGRAPH, UPLOADED THROUGH THE SIGNED URL THE PRODUCT MINTS.
       * The bytes are a 1x1 PNG generated here. Nothing is downloaded and no
       * real property is photographed; what is being proven is that the
       * device's path works, not what the picture shows.
       */
      const protocol = await photoItemKeys(db, file.service_slug);
      const items = protocol.photo;
      const captureId = `cap_${randomUUID()}`;
      const signed = await post(techCtx, "field", {
        action: "sign_upload", fileId: file.id, captureId,
        contentType: "image/png", size: PNG_1X1.length,
      });
      const signedBody = await signed.text();
      let storageKey = null;
      let uploaded = false;
      if (signed.status() === 200) {
        const parsed = JSON.parse(signedBody);
        storageKey = parsed.path ?? null;
        const put = await browser.newContext();
        const res = await put.request.fetch(parsed.url, {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          data: PNG_1X1,
          failOnStatusCode: false,
        });
        uploaded = res.status() >= 200 && res.status() < 300;
        await put.close();
        if (uploaded) record("storage: evidence bucket", storageKey ?? "(unread)", "1x1 PNG, the walk's photograph");
      }
      check("field_tech", "/api/portal/field", "the device gets a signed upload and the bytes land",
        "HTTP 200 from sign_upload, and the PUT accepted",
        `sign_upload HTTP ${signed.status()}, upload ${uploaded ? "accepted" : "not accepted"}`,
        signed.status() === 200 && uploaded,
        "as the technician, POST sign_upload for an image/png, then PUT the bytes to the signed url");

      if (items.length === 0) {
        /*
         * NO PROBE, NOT A FAILURE. There is nothing to photograph against, so
         * the capture property was never measured. Saying FAIL would claim it
         * was, which is the ruling of 2026-09-22 about a check whose subject
         * could not be built.
         */
        check("field_tech", "/api/portal/field", "the photograph is recorded against a protocol item",
          "a published protocol with at least one photograph item",
          `COULD NOT TELL: no published protocol item of kind photo for ${file.service_slug} (template ${protocol.templateId ?? "none published"})`,
          null,
          "read eng_protocol_items for the published template of the file's service");
      } else {
        const rec = await post(techCtx, "field", {
          action: "record_capture", fileId: file.id, captureId, itemKey: items[0],
          kind: "photo", storageKey, capturedAt: new Date().toISOString(),
        });
        const recBody = await rec.text();
        check("field_tech", "/api/portal/field", "the photograph is recorded against a protocol item",
          `HTTP 200 and an evidence row for ${items[0]}`,
          `HTTP ${rec.status()}: ${recBody.slice(0, 110)}`,
          rec.status() === 200,
          `as the technician, POST record_capture {itemKey:'${items[0]}', kind:'photo', storageKey}`);
        const { data: ev } = await db
          .from("eng_evidence_items")
          .select("id, protocol_item_id")
          .eq("file_id", file.id);
        for (const row of ev ?? []) record("eng_evidence_items", row.id, "the walk's capture");
        e2e.evidence = (ev ?? []).length;
        e2e.photoItems = items.length;
        e2e.requiredItems = protocol.required;
      }

      /*
       * SUBMITTING AN INCOMPLETE PACKAGE. One photograph against a protocol
       * with many required items, so the expected answer is a refusal that
       * NAMES the missing ones. The blockers are the thing being checked: a
       * technician at a property needs to know which photograph is missing.
       */
      const submit = await post(techCtx, "field", {
        action: "submit_evidence", fileId: file.id, note: "staff walk, deliberately incomplete",
      });
      const submitBody = await submit.text();
      let blockers = [];
      try { blockers = JSON.parse(submitBody).blockers ?? []; } catch { blockers = []; }
      check("field_tech", "/api/portal/field", "an incomplete package is refused and the gaps are named",
        "4xx and a blockers list with at least one named item",
        `HTTP ${submit.status()}, ${blockers.length} blocker(s): ${blockers.slice(0, 3).map((b) => (typeof b === "string" ? b : b.itemKey ?? JSON.stringify(b))).join("; ").slice(0, 120)}`,
        submit.status() >= 400 && blockers.length > 0,
        "as the technician with one capture against a multi item protocol, POST submit_evidence");
      e2e.blockers = blockers.length;

      /*
       * ===================================================================
       * 3. THE REVIEW.
       * ===================================================================
       *
       * The package cannot be completed in a walk without photographing every
       * item in a signed protocol, so the file is moved on by the ADMINISTRATOR
       * through the legal transition rather than by faking a complete package.
       * That is disclosed rather than hidden: the engineer below is reviewing a
       * package the platform itself considers incomplete, which is exactly the
       * state the seal refusal is about.
       */
      const forced = await post(adminCtx, "files", {
        action: "transition", fileId: file.id, to: "evidence_submitted",
        note: "staff walk: submitted for review with the package knowingly incomplete",
      });
      check("admin", "/api/portal/files", "an administrator can submit the package for review",
        "HTTP 200 and the file reads evidence_submitted",
        `HTTP ${forced.status()}, status ${(await statusOf(file.id)).status}`,
        forced.status() === 200,
        "as admin, POST transition to evidence_submitted");

      const open = await post(engCtx, "review", { action: "open_review", fileId: file.id });
      const openBody = await open.text();
      check("engineer", "/api/portal/review", "the engineer takes the file into review",
        "HTTP 200 and the file reads under_review",
        `HTTP ${open.status()}, status ${(await statusOf(file.id)).status}${open.status() >= 400 ? `: ${openBody.slice(0, 90)}` : ""}`,
        open.status() === 200,
        "as the engineer, POST /api/portal/review {action:'open_review', fileId}");

      /*
       * ===================================================================
       * 4. SEALING, AND WHY THE WALK STOPS HERE ON PURPOSE.
       * ===================================================================
       *
       * The operator asked for a letter release with a placeholder seal. It
       * cannot be exercised and it is not a defect:
       *
       *   - `canReview` refuses `seal` while the gate is shut, in its own
       *     words, and the gate is shut. `canTransition` refuses the sealed
       *     STATUS for the same reason, so there are two independent refusals.
       *   - A sealed document is UPLOADED, never generated. Standing law. There
       *     is no seal image in this repository, no signature block and no
       *     letter generator, and the audit below asserts that rather than
       *     taking this comment's word for it.
       *
       * So the attempt is MADE and the refusal is the measurement. A walk that
       * skipped it would be reporting an opinion.
       */
      const seal = await post(engCtx, "review", { action: "decide", fileId: file.id, decision: "seal" });
      const sealBody = await seal.text();
      check("engineer", "/api/portal/review", "sealing is refused while the gate is shut",
        "4xx naming the gate and the absence of a Professional Engineer in responsible charge",
        `HTTP ${seal.status()}: ${sealBody.slice(0, 160)}`,
        seal.status() >= 400 && /cannot seal|responsible charge/i.test(sealBody),
        "as the engineer on a file under review, POST decide with decision 'seal'");
      e2e.sealRefusal = (() => { try { return JSON.parse(sealBody).error ?? sealBody; } catch { return sealBody; } })();

      /*
       * TWO USERS ON ONE JOB. Both decisions fired at once, from two different
       * sessions, on one file. Exactly one may win, and the responsible charge
       * log must gain exactly one row: a second row would be a second engineer
       * recorded as having decided a file that was already decided.
       */
      const reason = "Staff walk on development. Not a determination about any real property.";
      const [raceA, raceB] = await Promise.all([
        post(engCtx, "review", { action: "decide", fileId: file.id, decision: "revisions", reason }),
        post(engCtx, "review", { action: "decide", fileId: file.id, decision: "site_visit", reason }),
      ]);
      const wins = [raceA, raceB].filter((r) => r.status() === 200).length;
      const { data: charge } = await db
        .from("eng_responsible_charge_log")
        .select("id, decision, engineer_id")
        .eq("file_id", file.id);
      check("engineer", "/api/portal/review", "two decisions at once produce one outcome",
        "exactly one HTTP 200 and exactly one responsible charge row",
        `${wins} of 2 succeeded (HTTP ${raceA.status()}, ${raceB.status()}); ${(charge ?? []).length} responsible charge row(s): ${(charge ?? []).map((c) => c.decision).join(", ") || "none"}`,
        wins === 1 && (charge ?? []).length === 1,
        "fire two decide calls on one file concurrently from two sessions, then count eng_responsible_charge_log");
      for (const c of charge ?? []) record("eng_responsible_charge_log", c.id, `decision ${c.decision}`);
      e2e.decision = (charge ?? [])[0]?.decision ?? null;
      e2e.finalStatus = (await statusOf(file.id)).status;

      /* And the decision again, after the file has moved. The back button. */
      const stale = await post(engCtx, "review", { action: "decide", fileId: file.id, decision: "revisions", reason });
      const staleBody = await stale.text();
      check("engineer", "/api/portal/review", "a decision resubmitted after the file moved is refused",
        "4xx saying the file is not under review",
        `HTTP ${stale.status()}: ${staleBody.slice(0, 110)}`,
        stale.status() >= 400 && /under review/i.test(staleBody),
        "decide a file, then press back and submit the decision again");

      /*
       * ===================================================================
       * 5. THE NOTIFICATION, QUEUED AND NEVER SENT.
       * ===================================================================
       */
      const before = await queueDepth(db);
      /*
       * It takes only the file: the content is derived from what the file is
       * missing rather than typed, and the address is the probe client's, on the
       * probe domain, which is not an inbox anybody reads.
       */
      const ask = await post(adminCtx, "files", { action: "request_information", fileId: file.id });
      const askBody = await ask.text();
      const after = await queueDepth(db);
      check("admin", "/api/portal/files", "writing to the customer enqueues rather than sends",
        "HTTP 200 and the queue one job deeper",
        `HTTP ${ask.status()}, queue ${before.total} then ${after.total}${ask.status() >= 400 ? `: ${askBody.slice(0, 90)}` : ""}`,
        ask.status() === 200 && after.total > before.total,
        "as admin, POST request_information on the walk file, then count eng_jobs pending or running");
      e2e.queueBefore = before.total;
      e2e.queueAfter = after.total;
      e2e.queueKinds = after.kinds;
      console.log(`  queue holds ${after.total} pending or running job(s) across ${after.kinds.length} kind(s), none drained`);
      for (const j of after.sample) console.log(`    ${String(j.kind).padEnd(24)} ${j.status}  ${j.id}`);

      /*
       * ===================================================================
       * 6. WHAT THE CUSTOMER CAN REACH.
       * ===================================================================
       */
      if (customer && !customer.fault) {
        const custCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await custCtx.addCookies(customerCookieFor(customer, server.base));
        const cp = await custCtx.newPage();
        const res = await cp.goto(`${server.base}/account/orders`, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await cp.waitForTimeout(500);
        const text = ((await cp.innerText("body").catch(() => "")) || "").replace(/\s+/g, " ");
        check("customer", "/account/orders", "the customer sees their own order",
          `HTTP 200 and the reference ${WALK_ORDER} on the page`,
          `HTTP ${res?.status()}, reference ${text.includes(WALK_ORDER) ? "present" : "absent"}`,
          res?.status() === 200 && text.includes(WALK_ORDER),
          `sign in as the customer, open /account/orders, look for ${WALK_ORDER}`);
        await cp.screenshot({ path: `${OUT}/account-orders-1280.png`, fullPage: true });

        /*
         * THE DOWNLOAD. Nothing is sealed, so there is nothing to download, and
         * what is checked is that the door is shut rather than that a file
         * arrives: a customer session reaching a STAFF document route would be
         * the defect worth finding here.
         */
        const doc = await custCtx.request.get(
          `${server.base}/api/portal/documents?id=${randomUUID()}`,
          { failOnStatusCode: false, maxRedirects: 0 },
        );
        check("customer", "/api/portal/documents", "a customer session cannot open a staff document route",
          "401 or 403", `HTTP ${doc.status()}`,
          doc.status() === 401 || doc.status() === 403,
          "with the customer cookie, GET /api/portal/documents?id=<any uuid>");

        const { data: docs } = await db
          .from("eng_documents")
          .select("id, kind, sealed_at")
          .eq("file_id", file.id);
        check("customer", "eng_documents", "no sealed deliverable exists to release",
          "no row carrying sealed_at, because the gate refuses sealing",
          `${(docs ?? []).length} document row(s), ${(docs ?? []).filter((d) => d.sealed_at).length} sealed`,
          (docs ?? []).filter((d) => d.sealed_at).length === 0,
          "select sealed_at from eng_documents for the walk file");

        await custCtx.close();
      }

      /*
       * AND THE STANDING LAW ASSERTED AGAINST DISK RATHER THAN QUOTED. If a
       * seal image or a letter generator ever appears, this walk says so.
       */
      const seals = sourceFilesMatching(/seal[-_.]?(image|png|jpg|svg)|signature[-_.]?(image|png|jpg|svg)/i);
      check("admin", "the repository", "there is no seal or signature image to place",
        "no file in src/ or public/ whose name is a seal or signature image",
        seals.length ? seals.slice(0, 4).join(", ") : "none",
        seals.length === 0,
        "search src/ and public/ for a seal or signature image");

      await adminCtx.close();
      await techCtx.close();
      await engCtx.close();
    }
  }

  /* ------------------------------------------------------- failure paths */
  console.log("\n=== FAILURE PATHS ===");
  const admin = probes.admin;
  if (admin && !admin.fault) {
    const ctx = await browser.newContext();
    await ctx.addCookies(cookieFor(admin, server.base));

    /* Missing fields: the create-file action with nothing supplied. */
    const r1 = await ctx.request.post(`${server.base}/api/portal/files`, {
      data: { action: "create_file" },
      failOnStatusCode: false,
    });
    const b1 = await r1.text();
    check("admin", "/api/portal/files", "missing fields are refused with a reason",
      "4xx and a message naming what is missing",
      `HTTP ${r1.status()}: ${b1.slice(0, 90)}`,
      r1.status() >= 400 && r1.status() < 500 && /"error"/.test(b1),
      "POST /api/portal/files with {action:'create_file'} and nothing else");

    /* Unknown action: must be refused, not silently accepted. */
    const r2 = await ctx.request.post(`${server.base}/api/portal/files`, {
      data: { action: "a_verb_that_does_not_exist" },
      failOnStatusCode: false,
    });
    check("admin", "/api/portal/files", "an unknown action is refused",
      "4xx", `HTTP ${r2.status()}`, r2.status() >= 400 && r2.status() < 500,
      "POST /api/portal/files with an invented action");

    /* Double submit: the same create twice, and the second must not duplicate. */
    const payload = {
      action: "create_client",
      kind: "individual",
      name: `Walk Double ${Date.now()}`,
      email: `walk-double-${Date.now()}@${PROBE_DOMAIN}`,
    };
    const d1 = await ctx.request.post(`${server.base}/api/portal/files`, { data: payload, failOnStatusCode: false });
    const d2 = await ctx.request.post(`${server.base}/api/portal/files`, { data: payload, failOnStatusCode: false });
    const { data: dupes } = await db.from("eng_clients").select("id").eq("email", payload.email);
    check("admin", "/api/portal/files", "a double submit does not create two clients",
      "exactly one row for the address",
      `${(dupes ?? []).length} row(s); first HTTP ${d1.status()}, second HTTP ${d2.status()}`,
      (dupes ?? []).length <= 1,
      "POST create_client twice with the same email, then count rows for that address");
    for (const c of dupes ?? []) record("eng_clients", c.id, "double submit probe client");

    await ctx.close();
  }

  /* An unauthenticated request must never reach a portal API. */
  const anon = await browser.newContext();
  const a1 = await anon.request.post(`${server.base}/api/portal/files`, {
    data: { action: "create_file" },
    failOnStatusCode: false,
  });
  check("anonymous", "/api/portal/files", "no session is refused",
    "401 or 403", `HTTP ${a1.status()}`, a1.status() === 401 || a1.status() === 403,
    "POST /api/portal/files with no cookie");
  await anon.close();

  console.log("\n=== TEARDOWN, own SCOPE ===");
  const swept = await destroyProbes(LABEL);
  const sweptC = await destroyCustomerProbes(LABEL);
  console.log(`  staff:    ok=${swept.ok} left=${swept.left}`);
  console.log(`  customer: ok=${sweptC.ok} left=${sweptC.left} kept=${sweptC.keptCount ?? 0}`);
  for (const k of sweptC.kept ?? []) console.log(`    KEPT ${k}`);
  const { data: pg } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const strays = (pg?.users ?? []).filter((u) => (u.email ?? "").endsWith(`@${PROBE_DOMAIN}`));
  console.log(`  auth.users on the probe domain: ${strays.length}`);

  console.log("\n=== ACCESS MATRIX ===");
  const shown = pages.map((p) => p.path);
  console.log(`screen${" ".repeat(34)}${ROLES.map((r) => r.slice(0, 8).padEnd(10)).join("")}`);
  for (const path of shown) {
    const cells = ROLES.map((r) => {
      const v = matrix[r]?.[path] ?? "-";
      return (v === "open" ? "open" : v.startsWith("redirected") ? "redirect" : v).padEnd(10);
    });
    console.log(`${path.padEnd(40)}${cells.join("")}`);
  }

  console.log("\n=== PERMANENT ROWS ===");
  for (const r of permanent) console.log(`  ${r.table.padEnd(24)} ${r.id}  ${r.note}`);

  const failed = results.filter((r) => r.pass === false);
  const untold = results.filter((r) => r.pass === null);
  console.log(
    `\n=== ${results.filter((r) => r.pass === true).length} of ${results.length} passed, ${failed.length} failed, ${untold.length} could not tell ===`,
  );
  for (const u of untold) {
    console.log(`  COULD NOT TELL  ${u.role} | ${u.screen} | ${u.action}`);
    console.log(`     ${u.actual}`);
  }
  for (const f of failed) {
    console.log(`  ${f.role} | ${f.screen} | ${f.action}`);
    console.log(`     expected ${f.expected}`);
    console.log(`     actual   ${f.actual}`);
    console.log(`     repro    ${f.repro}`);
  }
} finally {
  if (browser) await browser.close();
  if (server) await server.stop();
  release();
  console.log("\nserver stopped, lock released");
}
