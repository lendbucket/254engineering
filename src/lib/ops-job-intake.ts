import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit, writeAuditOrRefuse } from "./ops-audit";
import { verifyFreshCode } from "./ops-mfa";
import { verifyOwnPassword } from "./ops-auth";
import { isOwnerAdmin, OWNER_OVERRIDE, OWNER_OVERRIDE_ACTION } from "./owner-override";
import { createClient, createFile, transitionFile, type Author } from "./ops-crm";
import { can, type Actor } from "./ops-authz";
import { sendPaymentLink } from "./ops-job-billing";
import { catalogFor, orderBlockedReason } from "@data/catalog";
import { quoteFor } from "./ops-orders";
import { resolveCounty, twiaStatus, windstormAreaRefusal } from "./ops-counties";
import { isOpen } from "./launch";
import { isKnown } from "./ops-money";
import { fieldsFor, missingFor } from "@data/intake-fields";
import { defaultAnswersFor } from "./ops-file-inputs";
import {
  blockers,
  applyIntakeUploads,
  decidePrice,
  isNoCharge,
  landsAt,
  noChargeRefusal,
  paymentOptions,
  type IntakeChannel,
  type PaymentIntent,
} from "./job-intake-rules";

/**
 * TAKING A JOB OVER THE TELEPHONE.
 *
 * The rules are in job-intake-rules.ts and are pure. This module reads rows,
 * calls those rules, and writes the answer down, exactly as ops-partners does
 * for attribution.
 *
 * WHY THIS IS NOT placeOrder
 * --------------------------
 * placeOrder is the CUSTOMER's door: it takes money, and `orderBlockedReason`
 * refuses it outright while registration is pending, in those words. Routing
 * the operator through it would mean the firm cannot write down a job somebody
 * telephoned about until the day it launches, which is not a compliance
 * position, it is an inability to keep records.
 *
 * The gate still applies to the MONEY. paymentOptions refuses every paid route
 * during prelaunch and leaves exactly one open, and it says why. What the
 * operator gets in the meantime is a complete, priced, dispatchable file that
 * nobody has been charged for, which is what the firm actually has.
 *
 * WHY IT REACHES THE SAME PLACE THE CUSTOMER PATH DOES
 * ----------------------------------------------------
 * Section 1.5's acceptance test is that a job ordered on the website and the
 * same job taken by telephone produce files carrying identical information. So
 * this uses the same catalog, the same quoteFor, the same resolveCounty, the
 * same createFile and the same transitionFile. The only thing it does
 * differently is who is standing at the door.
 */

export type TakeJobInput = {
  /** An existing client, or the details to create one. */
  clientId?: string | null;
  newClient?: {
    kind: "organization" | "individual";
    name: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    clientType?: string | null;
  };

  serviceSlug: string;
  /** The catalog tier. Required when the line sells more than one. */
  tier: string;

  propertyAddress: string;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
  twiaOverride?: boolean;

  urgency?: "standard" | "expedited" | "emergency";
  dueAt?: string | null;
  notes?: string | null;

  channel: IntakeChannel;
  /** When the call happened, if not now. */
  takenAt?: string | null;

  /** Only when the operator changed it. Null means take the catalog's. */
  priceCents?: number | null;
  priceOverrideReason?: string | null;
  /** A fresh authenticator code, required only for a client price of zero. */
  noChargeCode?: string | null;
  /** The owner override alone (src/lib/owner-override.ts): his password in place of the code. */
  noChargePassword?: string | null;

  paymentIntent: PaymentIntent;
  paymentNote?: string | null;

  /**
   * The catalog's own questions, answered.
   *
   * Keyed by field id from data/intake-fields.ts. The screen renders whatever
   * fieldsFor returns and posts it back here, so this module never has a list
   * of its own to drift from the definition.
   */
  answers?: Record<string, string>;

  /**
   * Documents the firm attached while taking the job (0078), each answering one
   * file field, uploaded beforehand under intake/<draftId>/<fieldId>/.
   */
  draftId?: string | null;
  uploads?: { fieldId: string; bucket: string; storageKey: string; contentType?: string | null; byteSize?: number | null }[];
};

/** The bucket intake documents land in, which is the one order uploads use. */
const INTAKE_BUCKET = "eng-uploads";

/** What a file answer says in value_text, so the outstanding list reads it as answered. */
export const ATTACHED_AT_INTAKE = "Attached by the firm when the job was taken.";

export type TakeJobResult =
  | {
      ok: true;
      fileId: string;
      fileNumber: string;
      clientId: string;
      landedAt: string;
      /** Present when the file could not be moved out of intake, with the reason. */
      landingWarning?: string;
      /** Present when "Send a payment link" was chosen and the link did not go out, with the reason. */
      paymentLinkWarning?: string;
    }
  | { ok: false; error: string; field?: string };

/**
 * Clients matching a query, for the dedupe search.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * The gate 0 walk found three duplicate "Stripe Probe" clients on development
 * differing only by timestamp, because nothing has ever looked before creating.
 * The failure mode Section 1 item 2 names, the same solar installer becoming
 * four clients, has already happened to probe data.
 *
 * Name, email, phone and city, because those are what a person on a telephone
 * can offer. Phone is compared with punctuation stripped: nobody says a number
 * the way it was typed in.
 */
export async function searchClients(query: string, limit = 8) {
  const db = supabaseAdmin();
  if (!db) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const digits = q.replace(/\D/g, "");
  const like = `%${q.replace(/[%_]/g, "")}%`;

  const filters = [`name.ilike.${like}`, `email.ilike.${like}`, `city.ilike.${like}`];
  if (digits.length >= 4) filters.push(`phone.ilike.%${digits}%`);

  const { data } = await db
    .from("eng_clients")
    .select("id, kind, name, client_type, email, phone, city, created_at")
    .eq("status", "active")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

/**
 * The price the catalog says for this job, with the coastal line kept separate.
 *
 * Exported because the intake screen needs to SHOW it before anything is
 * written, and the screen and the write must not compute it twice.
 */
export function priceForJob(serviceSlug: string, tier: string, county: string | null) {
  const entry = catalogFor(serviceSlug, tier);
  if (!entry) return null;

  const twia = county ? twiaStatus(county) === "designated" : false;
  const quote = quoteFor(entry, twia, county ?? undefined);

  const coastal = quote.lines.find((l) => l.label === "Coastal county");

  return {
    entry,
    quote,
    twia,
    totalCents: quote.totalCents,
    coastalCents: coastal?.amountCents ?? null,
    unavailable: quote.unavailable,
  };
}

export async function takeJob(
  actor: Author,
  input: TakeJobInput,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<TakeJobResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  /*
   * THE CATALOG PRICE AS IT IS, FOR ANYBODY WITHOUT pricing.override_at_intake.
   * Operator ruling, 2026-10-20: phone intake by the two staff levels uses the
   * catalog price, no override. files.create used to carry the override on its
   * own; it moved to its own grant in 0079, which admin and sales keep.
   *
   * FIRST, BEFORE ANY OTHER CHECK. A typed price of any kind is refused here,
   * zero included, so a no-charge job is stopped at the first line for these
   * roles rather than reached through every validation below. The screen sends
   * no price for them at all, so a price arriving is not something they did by
   * accident.
   */
  if (input.priceCents !== null && input.priceCents !== undefined && !can(actor as unknown as Actor, "pricing.override_at_intake")) {
    return {
      ok: false,
      error: "Your role takes the catalog price as it is. An administrator can change a price.",
      field: "priceCents",
    };
  }

  /*
   * A PAYMENT LINK IS THE ONLY ROUTE FOR SOMEBODY WHO MAY SEND ONE AND NOT
   * CHARGE. Operator ruling, 2026-10-20: the rep's phone intake sends a payment
   * link, never a no-charge job. Opening a job unpaid and invoicing an account
   * are commercial decisions payments.charge carries, so a holder of
   * payments.send_link alone chooses the link or nothing. Under the gate the
   * link is unavailable, and the screen says why rather than offering another
   * route.
   */
  const linkOnly =
    can(actor as unknown as Actor, "payments.send_link") && !can(actor as unknown as Actor, "payments.charge");
  if (linkOnly && input.paymentIntent !== "link_sent") {
    return {
      ok: false,
      error: "Your role takes a job by sending the customer a payment link. Choose Send a payment link.",
      field: "paymentIntent",
    };
  }

  const entry = catalogFor(input.serviceSlug, input.tier);
  if (!entry) {
    return { ok: false, error: "That deliverable is not in the catalog.", field: "tier" };
  }

  /*
   * The county is resolved BEFORE anything is written, because the price
   * depends on it: a coastal county carries a surcharge, and a file created
   * first and priced second would be priced against a county nobody had
   * confirmed yet.
   */
  const resolved = resolveCounty({ city: input.city, county: input.county });
  if (!resolved.valid || !resolved.county) {
    return {
      ok: false,
      error:
        "That county could not be determined from the address. Choose one of the 254 so the file can be dispatched.",
      field: "county",
    };
  }
  /* The same refusal every door gives, read from this job's own county. */
  const outsideArea = windstormAreaRefusal(input.serviceSlug, resolved.county);
  if (outsideArea) return { ok: false, error: outsideArea, field: "county" };

  /*
   * The order stage questions are as blocking as the property address, because
   * that is what the stage means. Dispatch and seal stage questions are not
   * checked here: a job is deliberately allowed to be opened incomplete, and
   * what is outstanding is recorded rather than refused.
   */
  /*
   * The account's standing answers fill the gaps, and the operator wins every
   * collision. A default is what this client usually says, not what they said
   * on this call, so anything typed on the screen overrides it.
   *
   * Read before the blockers are computed, so a field the account already
   * answers does not stop a job being taken.
   */
  const defaults = await defaultAnswersFor(input.clientId ?? null);
  const answers: Record<string, string> = { ...defaults, ...(input.answers ?? {}) };

  /*
   * A FILE FIELD IS ANSWERED BY A FILE, AND BY NOTHING ELSE. 0078.
   *
   * Any text posted against a file field is dropped first, so a sentence can
   * never satisfy a document the signed protocol requires. Then each upload is
   * checked: it answers a file field this deliverable asks, it is in the intake
   * bucket, and its key is under this intake's own draft and that field. Only
   * then does the field count as answered.
   */
  const uploads = input.uploads ?? [];
  const filed = applyIntakeUploads({
    fileFieldIds: fieldsFor(input.serviceSlug, input.tier).filter((f) => f.kind === "file").map((f) => f.id),
    uploads,
    draftId: input.draftId ?? null,
    answers,
    bucket: INTAKE_BUCKET,
    attachedText: ATTACHED_AT_INTAKE,
  });
  if (!filed.ok) return { ok: false, error: filed.error, field: filed.field };
  Object.keys(answers).forEach((k) => delete answers[k]);
  Object.assign(answers, filed.answers);

  const missingToOrder = missingFor(input.serviceSlug, input.tier, answers, "order");
  if (missingToOrder.length) {
    return { ok: false, error: `${missingToOrder[0].label}.`, field: missingToOrder[0].id };
  }

  const missing = blockers({
    clientId: input.clientId ?? (input.newClient ? "pending" : null),
    serviceSlug: input.serviceSlug,
    tier: input.tier,
    propertyAddress: input.propertyAddress,
    city: input.city ?? "",
    county: input.county ?? "",
    channel: input.channel,
  });
  if (missing.length) return { ok: false, error: missing[0] };

  const priced = priceForJob(input.serviceSlug, input.tier, resolved.county);
  const catalogCents = priced && isKnown(priced.totalCents) ? priced.totalCents : null;

  const decision = decidePrice({
    catalogCents,
    enteredCents: input.priceCents ?? null,
    reason: input.priceOverrideReason ?? null,
  });
  /*
   * Narrowed on "error" rather than on "ok". The refusal variant is the only
   * one carrying an error, while "ok" is absent from the two success shapes, so
   * checking for it leaves the compiler unable to rule the refusal out below.
   */
  if ("error" in decision) {
    return { ok: false, error: decision.error, field: "priceCents" };
  }

  /*
   * The money gate, checked here as well as rendered on the screen. The screen
   * decides which buttons to draw; this decides what may actually be recorded,
   * and a client that posted a paid intent during prelaunch is refused rather
   * than trusted.
   */
  const options = paymentOptions({
    prelaunch: !isOpen(),
    accountCanInvoice: await accountCanInvoice(input.clientId ?? null),
    priced: catalogCents !== null,
  });
  const chosen = options.find((o) => o.intent === input.paymentIntent);
  if (input.paymentIntent !== "unset" && (!chosen || !chosen.available)) {
    return {
      ok: false,
      error: chosen?.because ?? "That payment route is not available for this job.",
      field: "paymentIntent",
    };
  }

  /*
   * ------------------------------------------------------ a job at no charge
   *
   * Operator ruling, 2026-10-16. A client price of zero needs the administrator
   * role, a fresh code from the administrator's own authenticator, a typed
   * reason, and an audit row written BEFORE anything else is, so no client and
   * no file can exist for a no-charge job that has no record. The audit row is
   * written with writeAuditOrRefuse, which refuses the act when the row cannot
   * be written rather than logging and carrying on as writeAudit does.
   */
  const clientCents = decision.overridden ? decision.cents : catalogCents;
  let noChargeEventId: string | null = null;
  if (isNoCharge(clientCents)) {
    const refused = noChargeRefusal({
      actorId: actor.id,
      actorRole: actor.role,
      reason: decision.overridden ? decision.reason : (input.priceOverrideReason ?? null),
      paymentIntent: input.paymentIntent,
      code: input.noChargeCode ?? null,
      password: input.noChargePassword ?? null,
    });
    if (refused) return { ok: false, error: refused, field: "priceCents" };

    /*
     * THE OWNER OVERRIDE, operator ruling 2026-10-19 (src/lib/owner-override.ts).
     * The owner's administrator id, and no other, re-enters his password in
     * place of the authenticator code, and the use is recorded BEFORE the
     * no-charge record, through writeAuditOrRefuse, so an override that could
     * not be recorded is an act that did not happen. Every other id takes the
     * fresh code exactly as before.
     */
    let factor: { kind: "authenticator"; verifiedAt: string } | { kind: "owner_password"; overrideEventId: string };
    if (isOwnerAdmin(actor.id)) {
      const pw = await verifyOwnPassword(actor.id as string, input.noChargePassword ?? "");
      if (!pw.ok) return { ok: false, error: pw.error, field: "noChargePassword" };
      const used = await writeAuditOrRefuse({
        actor,
        action: OWNER_OVERRIDE_ACTION,
        entityType: "profile",
        entityId: actor.id as string,
        summary: "Owner override used: password re-entered in place of the authenticator code, for a job at no charge",
        diff: { override: "no_charge_password", act: "job.no_charge", ruled_on: OWNER_OVERRIDE.ruledOn },
        ...context,
      });
      if (!used.ok) return { ok: false, error: used.error, field: "noChargePassword" };
      factor = { kind: "owner_password", overrideEventId: used.id };
    } else {
      const fresh = await verifyFreshCode(actor.id as string, input.noChargeCode ?? "", "A job at no charge");
      if (!fresh.ok) return { ok: false, error: fresh.error, field: "noChargeCode" };
      factor = { kind: "authenticator", verifiedAt: fresh.verifiedAt };
    }

    const recorded = await writeAuditOrRefuse({
      actor,
      action: "job.no_charge",
      entityType: "file",
      entityId: null,
      summary: `No-charge ${entry.name} authorised for ${input.propertyAddress}, ${resolved.county} County`,
      diff: {
        reason: decision.overridden ? decision.reason : (input.priceOverrideReason ?? "").trim(),
        catalog_price_cents: catalogCents,
        client_price_cents: 0,
        ...(factor.kind === "authenticator"
          ? { second_factor_verified_at: factor.verifiedAt }
          : { owner_override_event_id: factor.overrideEventId }),
        property_address: input.propertyAddress,
        service: input.serviceSlug,
        deliverable: input.tier,
      },
      ...context,
    });
    if (!recorded.ok) return { ok: false, error: recorded.error, field: "priceCents" };
    noChargeEventId = recorded.id;
  }

  // ------------------------------------------------------------ the client
  let clientId = input.clientId ?? null;
  if (!clientId) {
    if (!input.newClient?.name?.trim()) {
      return { ok: false, error: "Choose or create the client.", field: "clientId" };
    }
    const made = await createClient(actor, {
      kind: input.newClient.kind,
      name: input.newClient.name.trim(),
      email: input.newClient.email?.trim() || null,
      phone: input.newClient.phone?.trim() || null,
      city: input.newClient.city?.trim() || null,
      clientType: input.newClient.clientType || null,
    });
    if (!made.ok) return { ok: false, error: made.error, field: "clientId" };
    clientId = made.id;
  }

  // -------------------------------------------------------------- the file
  const file = await createFile(
    actor,
    {
      clientId,
      serviceSlug: input.serviceSlug,
      deliverable: input.tier,
      propertyAddress: input.propertyAddress,
      city: input.city ?? null,
      county: resolved.county,
      postalCode: input.postalCode ?? null,
      urgency: input.urgency ?? "standard",
      dueAt: input.dueAt ?? null,
      notes: input.notes ?? null,
      twiaOverride: input.twiaOverride,
      clientPriceCents: decision.overridden ? decision.cents : catalogCents,
      catalogPriceCents: catalogCents,
      coastalSurchargeCents:
        priced && isKnown(priced.coastalCents) ? priced.coastalCents : null,
      priceOverrideReason: decision.overridden ? decision.reason : null,
      intakeChannel: input.channel,
      intakeTakenAt: input.takenAt ?? null,
      /*
       * "Send a payment link" is recorded as link_sent ONLY BY sendPaymentLink,
       * below, once a link has actually been raised and queued to the customer.
       * Found 2026-10-20: this used to write link_sent straight from the
       * choice, and nothing on this path sent anything, so a file said a link
       * had gone out when none had. That is the customer_link.issued defect in
       * a payment column. Latent until launch, because the gate makes the link
       * unavailable before then.
       */
      paymentIntent: input.paymentIntent === "link_sent" ? "unset" : input.paymentIntent,
      paymentNote: input.paymentNote ?? null,
    },
    context,
  );
  if (!file.ok) return { ok: false, error: file.error };

  /*
   * The answers, written against the field ids the definition uses.
   *
   * source is "firm" because an operator typed them while somebody talked. The
   * customer flow will write "customer" for the same fields, and the difference
   * matters when an access arrangement turns out to be wrong: what the customer
   * said and what the firm wrote down are different claims.
   */
  /*
   * Recorded with the source they actually came from. An answer that arrived
   * from the account's standing preferences was not something the operator was
   * told on this call, and labelling it "firm" would make a stored default look
   * like a fresh confirmation.
   */
  const typed = input.answers ?? {};
  const uploadFor = (fieldId: string) => uploads.find((u) => u.fieldId === fieldId);
  const supplied =Object.entries(answers).filter(([, v]) => typeof v === "string" && v.trim() !== "");
  if (supplied.length) {
    const known = new Set(fieldsFor(input.serviceSlug, input.tier).map((f) => f.id));
    const rows = supplied
      .filter(([id]) => known.has(id))
      .map(([field_id, value_text]) => ({
        file_id: file.id,
        field_id,
        value_text: value_text.trim(),
        source: field_id in typed || uploadFor(field_id) ? "firm" : "customer",
        recorded_by: actor.id,
        /* A document the firm attached carries where it landed (0078). */
        ...(uploadFor(field_id)
          ? {
              bucket: uploadFor(field_id)!.bucket,
              storage_key: uploadFor(field_id)!.storageKey,
              content_type: uploadFor(field_id)!.contentType ?? null,
              byte_size: uploadFor(field_id)!.byteSize ?? null,
            }
          : {}),
      }));

    if (rows.length) {
      const { error } = await db.from("eng_file_inputs").insert(rows);
      /*
       * A failed write here does NOT fail the job. The file exists, it is
       * priced and it is about to be dispatched; losing the gate code is worth
       * a log line and a chase, not throwing away a job somebody is on the
       * telephone about.
       */
      if (error) {
        console.error(`[intake] ${file.fileNumber}: answers not saved: ${error.message}`);
      }
    }
  }

  // ------------------------------------------------------- where it lands
  const target = landsAt(entry.orderType);
  let landingWarning: string | undefined;

  if (target !== "intake") {
    /*
     * Through transitionFile, never a raw status write. That is the rule
     * files-audit now enforces, and it exists because ops-payments spent three
     * phases moving files with a raw update that skipped the grammar.
     */
    const moved = await transitionFile(
      actor,
      file.id,
      target,
      `Taken by ${input.channel === "phone" ? "telephone" : input.channel} and released.`,
      context,
    );
    if (!moved.ok) landingWarning = moved.error;
  }

  /*
   * The audit row names the channel and the person, because "who took this
   * call" is the question asked when a customer says they were quoted
   * something different.
   */
  await writeAudit({
    actor,
    action: "job.taken",
    entityType: "file",
    entityId: file.id,
    summary:
      `${file.fileNumber} taken by ${input.channel} for ${entry.name}, ` +
      `${resolved.county} County` +
      (decision.overridden ? ", at an overridden price" : ""),
    diff: {
      channel: input.channel,
      deliverable: input.tier,
      payment_intent: input.paymentIntent,
      ...(decision.overridden
        ? { catalog_price_cents: catalogCents, client_price_cents: decision.cents }
        : {}),
      /* The authorisation written before the file, so the two rows find each other. */
      ...(noChargeEventId ? { no_charge_event_id: noChargeEventId } : {}),
    },
    ...context,
  });

  /*
   * THE LINK, SENT RATHER THAN RECORDED. sendPaymentLink raises the order,
   * starts the checkout, queues the customer's email from its template, and
   * only then writes link_sent onto the file. A failure leaves the file at
   * unset and says why, so nobody believes a customer was asked to pay who
   * was not. The job itself stands either way: somebody is on the telephone
   * about it.
   */
  let paymentLinkWarning: string | undefined;
  if (input.paymentIntent === "link_sent") {
    const sent = await sendPaymentLink(actor, file.id);
    if (!sent.ok) paymentLinkWarning = `The job was taken and the payment link was not sent: ${sent.error}`;
  }

  return {
    ok: true,
    fileId: file.id,
    fileNumber: file.fileNumber,
    clientId,
    landedAt: landingWarning ? "intake" : target,
    ...(landingWarning ? { landingWarning } : {}),
    ...(paymentLinkWarning ? { paymentLinkWarning } : {}),
  };
}

/**
 * Does this client have an account with invoicing terms and room to use them?
 *
 * Absence of an account is a clear no rather than an error: most clients are
 * homeowners who will never have one.
 */
async function accountCanInvoice(clientId: string | null): Promise<boolean> {
  if (!clientId) return false;
  const db = supabaseAdmin();
  if (!db) return false;

  /* Oldest first, for the reason ops-job-billing gives: one client, one
   * account per site, and the first opened is the one billed against. This
   * decides whether a job may be taken on terms, so two accounts reading as
   * none refused a customer who has an account. */
  const { data: rows, error } = await db
    .from("eng_customer_accounts")
    .select("id, status, billing_mode, credit_limit_cents")
    .eq("client_id", clientId)
    /*
     * A superseded duplicate carries its own credit limit, and taking work
     * against it would let one organisation owe the firm twice its limit.
     */
    .is("superseded_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error(`[intake] could not read the account for client ${clientId}: ${error.message}`);
    return false;
  }
  const data = (rows ?? [])[0] ?? null;

  if (!data) return false;
  if (data.status !== "active") return false;
  return data.billing_mode === "invoice";
}

/** Re-exported so a screen and the write agree on what is orderable. */
export { orderBlockedReason };
