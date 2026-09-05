import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { createClient, createFile, transitionFile, type Author } from "./ops-crm";
import { catalogFor, orderBlockedReason } from "@data/catalog";
import { quoteFor } from "./ops-orders";
import { resolveCounty, twiaStatus } from "./ops-counties";
import { isPrelaunch } from "./launch";
import { isKnown } from "./ops-money";
import { fieldsFor, missingFor } from "@data/intake-fields";
import {
  blockers,
  decidePrice,
  landsAt,
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
};

export type TakeJobResult =
  | {
      ok: true;
      fileId: string;
      fileNumber: string;
      clientId: string;
      landedAt: string;
      /** Present when the file could not be moved out of intake, with the reason. */
      landingWarning?: string;
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

  /*
   * The order stage questions are as blocking as the property address, because
   * that is what the stage means. Dispatch and seal stage questions are not
   * checked here: a job is deliberately allowed to be opened incomplete, and
   * what is outstanding is recorded rather than refused.
   */
  const answers = input.answers ?? {};
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
    prelaunch: isPrelaunch(),
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
      paymentIntent: input.paymentIntent,
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
  const supplied = Object.entries(answers).filter(([, v]) => typeof v === "string" && v.trim() !== "");
  if (supplied.length) {
    const known = new Set(fieldsFor(input.serviceSlug, input.tier).map((f) => f.id));
    const rows = supplied
      .filter(([id]) => known.has(id))
      .map(([field_id, value_text]) => ({
        file_id: file.id,
        field_id,
        value_text: value_text.trim(),
        source: "firm",
        recorded_by: actor.id,
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
    },
    ...context,
  });

  return {
    ok: true,
    fileId: file.id,
    fileNumber: file.fileNumber,
    clientId,
    landedAt: landingWarning ? "intake" : target,
    ...(landingWarning ? { landingWarning } : {}),
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

  const { data } = await db
    .from("eng_customer_accounts")
    .select("id, status, billing_mode, credit_limit_cents")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!data) return false;
  if (data.status !== "active") return false;
  return data.billing_mode === "invoice";
}

/** Re-exported so a screen and the write agree on what is orderable. */
export { orderBlockedReason };
