import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { DB_NOW } from "./db-now";
import { emailRefusal, normaliseAddress } from "./email-address";
import { issueCustomerToken } from "./customer-auth";
import { recordSystemAudit } from "./system-work";
import { SYSTEM_ACTOR_EMAIL, SYSTEM_ACTOR_ROLE, SYSTEM_ACTOR } from "./system-actor";
import {
  doorFor,
  VERIFICATION_TTL_WORDS,
  type AccountOrigin,
} from "./account-doors";

/**
 * THE ONE PLACE A CUSTOMER ACCOUNT IS CREATED.
 *
 * Phase 13 Section 1. Operator ruling: an account is one thing however it is
 * created, every path produces the same record with a different origin, and a
 * check proves the three converge.
 *
 * WHY ONE FUNCTION RATHER THAN THREE HANDLERS THAT EACH INSERT
 * -------------------------------------------------------------
 * Three inserts are three answers to what an account IS, and they diverge in
 * the direction of whoever wrote each one last. The chain is not trivial
 * either: a customer user needs an account, an account needs a client, and each
 * of those has required columns with no defaults. A door that got the chain
 * slightly wrong would produce an account that exists and cannot be billed, or
 * one attached to a client nobody can find.
 *
 * So there is one function, the doors differ in what they pass, and
 * `scripts/accounts-audit.mjs` asserts that a route creating a customer user
 * and not declared in ACCOUNT_DOORS is a red board.
 *
 * WHAT THE THREE DOORS ACTUALLY DIFFER IN
 * ----------------------------------------
 * Three things, and everything else is identical:
 *
 *   the ORIGIN written on the row
 *   whether a PASSWORD is set here or by a link the person opens
 *   WHO the audit trail names
 *
 * The last is the one worth stating. A self service account is created by the
 * person signing up, and naming the operator would be false. An operator
 * created account is created by the operator, and naming the customer would be
 * worse than false: it would put words in the mouth of somebody who was on the
 * telephone. Where the platform acts for itself, the system principal is named,
 * which is what it exists for.
 */

export type CreateAccountInput = {
  email: string;
  displayName: string;
  phone?: string | null;
  /** The organisation. Absent for a person, which is the common case. */
  organisation?: string | null;
  origin: AccountOrigin;
  /**
   * An existing client to hang the account on, rather than opening a new one.
   *
   * THE CHECKOUT DOOR NEEDS THIS AND THE OTHER TWO MUST NOT USE IT. An order
   * already created a client for the person who placed it, so opening a second
   * one here would put the same human in this firm's records twice, with their
   * orders split between the two and no way to tell afterwards which was which.
   *
   * Absent for the doors where nobody has ordered anything yet, because there
   * is nothing to attach to and inventing a link would be worse than making a
   * row.
   */
  clientId?: string | null;
  /**
   * Who is doing this, for the audit trail.
   *
   * `null` means the platform itself, and the row is attributed to the system
   * principal rather than to nobody. An anonymous write into an append only
   * trail is the thing the system principal was built to prevent.
   */
  actor: { id: string; email: string; role: string } | null;
};

export type CreateAccountResult =
  | {
      ok: true;
      customerUserId: string;
      accountId: string;
      /** The signed link, or null where the door sets no password. */
      link: { token: string; expiresIn: string } | null;
    }
  | { ok: false; error: string };

export async function createCustomerAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const door = doorFor(input.origin);

  /*
   * THE ADDRESS IS CHECKED HERE RATHER THAN AT EACH DOOR, so all three refuse
   * identically. A cap enforced on the public form and not on the operator's
   * screen is a cap that holds until the day somebody pastes a long address
   * into the portal, which is exactly the shape of the MFA lockout this phase
   * opened by fixing.
   */
  const refusal = emailRefusal(input.email);
  if (refusal) return { ok: false, error: refusal };

  const email = normaliseAddress(input.email);
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "An account needs a name." };

  /*
   * ONE ACCOUNT PER ADDRESS, AND THE REFUSAL IS DELIBERATELY UNHELPFUL.
   *
   * "That address already has an account" tells anybody who asks which
   * addresses are customers here, which is the enumeration the rate limit
   * exists to slow down and this sentence would hand over for free.
   *
   * So the door tells the CALLER the truth and the caller decides what the
   * stranger sees. The self service route answers the same way whether or not
   * the address existed, and sends mail to the existing account rather than
   * creating a second one.
   */
  const { data: existing } = await db
    .from("eng_customer_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: false, error: "already_exists" };

  /*
   * THE CHAIN, IN ORDER, BECAUSE EACH NEEDS THE ONE BEFORE IT.
   *
   * There is no transaction here and that is worth naming rather than hiding:
   * PostgREST gives one statement at a time. A failure between the client and
   * the account leaves a client with no account, which is inert, findable and
   * harmless, and is a far better outcome than the alternative shape where a
   * customer user exists pointing at nothing.
   *
   * The order is chosen so that every partial state is inert. Nothing a person
   * can sign into exists until the last insert succeeds.
   */
  /*
   * THE CLIENT, WHICH IS EITHER FOUND OR MADE.
   *
   * Found for the checkout door, because placing the order already made one and
   * a second would split one person's history across two records. Made for the
   * other two, because nothing exists to attach to yet.
   *
   * A clientId that names no row is a caller error rather than a reason to
   * silently open a new client: that would produce exactly the duplicate this
   * parameter exists to prevent, in the one case where somebody had tried to
   * avoid it.
   */
  let clientId = input.clientId ?? null;
  if (clientId) {
    const { data: found } = await db.from("eng_clients").select("id").eq("id", clientId).maybeSingle();
    if (!found) return { ok: false, error: "That client does not exist, so the account was not created." };
  } else {
    const { data: client, error: clientError } = await db
      .from("eng_clients")
      .insert({
        /*
         * "organization", NOT "company", AND THE DATABASE IS THE AUTHORITY.
         *
         * eng_clients_kind_check allows exactly 'organization' and
         * 'individual'. This said "company", which typechecked, built, and was
         * refused by Postgres the first time a door was walked:
         *
         *   new row for relation "eng_clients" violates check constraint
         *   "eng_clients_kind_check"
         *
         * Nothing in TypeScript could have caught it, because the column is
         * text and the rule lives in the database, which is the right place for
         * it: convertClientToAccount reads this exact value to decide whether a
         * client may become an account, and a third spelling would have made
         * two parts of this platform disagree about what a company is.
         */
        kind: input.organisation ? "organization" : "individual",
        name: input.organisation?.trim() || displayName,
        status: "active",
      })
      .select("id")
      .single();
    if (clientError || !client) {
      return { ok: false, error: clientError?.message ?? "The client record could not be created." };
    }
    clientId = client.id as string;
  }

  const { data: account, error: accountError } = await db
    .from("eng_customer_accounts")
    .insert({ site: "254", client_id: clientId, status: "active" })
    .select("id")
    .single();
  if (accountError || !account) {
    return { ok: false, error: accountError?.message ?? "The account could not be created." };
  }

  /*
   * INVITED, NOT ACTIVE, AND FOR EVERY DOOR.
   *
   * 0043 refuses an ACTIVE self service account with no proven address, so this
   * one has no choice. The other two could be active immediately and are not,
   * because status should mean the same thing on every row: an account becomes
   * active when somebody has proved they can open its mail, and that is true of
   * an operator created account the moment the set password link is used.
   *
   * A status that means "ready" on two doors and "waiting" on a third is a
   * column nobody can filter on.
   */
  const { data: user, error: userError } = await db
    .from("eng_customer_users")
    .insert({
      account_id: account.id,
      email,
      display_name: displayName,
      phone: input.phone?.trim() || null,
      status: "invited",
      account_role: "owner",
      origin: input.origin,
      email_verified_at: null,
    })
    .select("id")
    .single();
  if (userError || !user) {
    return { ok: false, error: userError?.message ?? "The account holder could not be created." };
  }

  /*
   * THE LINK. Both doors that produce one produce the SAME kind, because in
   * both cases the person is choosing a password for the first time and
   * proving the address by opening the mail. Calling one "verification" and the
   * other "set password" would be two tokens doing one job.
   */
  const issued = await issueCustomerToken(user.id, "set_password");
  if (!issued) {
    return { ok: false, error: "The account was created and its sign in link could not be issued." };
  }

  /*
   * THE AUDIT ROW NAMES WHOEVER ACTUALLY DID IT.
   *
   * The system principal where the platform acted for itself, so an auditor
   * reading the trail can tell platform raised work from a person's without
   * asking anybody. That is the whole reason it exists.
   */
  const summary = `Account opened for ${email} through ${input.origin}, by ${door.actor}.`;
  if (input.actor) {
    await writeAudit({
      actor: input.actor,
      action: "customer_account.create",
      entityType: "customer_user",
      entityId: user.id,
      summary,
      diff: { origin: input.origin, account_id: account.id },
    });
  } else {
    await recordSystemAudit({
      action: "customer_account.create",
      entityType: "customer_user",
      entityId: user.id,
      summary,
      diff: { origin: input.origin, account_id: account.id },
    });
  }

  return {
    ok: true,
    customerUserId: user.id,
    accountId: account.id,
    link: { token: issued.token, expiresIn: VERIFICATION_TTL_WORDS },
  };
}

/**
 * A FRESH LINK FOR AN ACCOUNT THAT ALREADY EXISTS.
 *
 * The self service door answers identically whether an address is new or
 * already holds an account, and that answer is only honest if the second case
 * does something useful. This is that something: the existing account is left
 * exactly as it is, and a fresh set password link goes to its address.
 *
 * WHY IT DOES NOT SAY WHETHER IT FOUND ONE, to its caller or to anybody else.
 * It returns null for an address with no account and for an address it could
 * not read, and the caller sends the same sentence either way. A caller that
 * could tell those apart would eventually branch on it, and the branch is the
 * oracle.
 *
 * THE PERSON WHO OWNS THE ADDRESS IS THE ONLY ONE WHO LEARNS ANYTHING, which is
 * the property that matters: they get a working link, and somebody guessing
 * addresses gets an identical page and an email they cannot read.
 */
export async function issueLinkForExistingAccount(
  address: string,
): Promise<{ token: string; displayName: string; customerUserId: string } | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data: user } = await db
    .from("eng_customer_users")
    .select("id, display_name, status")
    .eq("email", normaliseAddress(address))
    .maybeSingle();
  if (!user) return null;

  /*
   * A SUSPENDED ACCOUNT GETS NOTHING, and the caller still says the same
   * sentence. Mailing a working link into an account somebody deliberately
   * closed would be this door undoing a decision made on another one.
   */
  if (user.status === "suspended") return null;

  const issued = await issueCustomerToken(user.id as string, "set_password");
  if (!issued) return null;

  /*
   * ISSUED, AND NOTHING ELSE, BECAUSE ISSUING IS ALL THIS FUNCTION DID.
   *
   * Until 2026-09-15 this row said "A sign up attempt named an address ... and a
   * fresh set password link was SENT to it". It was written here, when the token
   * is issued, before the caller had queued any email, and queueEmail reports a
   * failure without throwing. So the append only trail could say a link was sent
   * that never left, and it asserted a sign up attempt, which is a fact about the
   * caller written inside the callee. The Phase 14 rank 9 exercise proved it by
   * writing four such rows on development, ids 17809 to 17812, where no sign up
   * happened and nothing was sent. Those rows cannot be removed; they are named
   * as known false in docs/overnight-2026-09-15.md. Operator ruling: fix the code
   * that writes it.
   *
   * The enqueue outcome is recorded by the caller that performs it, through
   * recordLinkEmailQueued below, so each row states only what its writer knows.
   */
  await recordSystemAudit({
    action: "customer_account.link_reissued",
    entityType: "customer_user",
    entityId: user.id as string,
    summary:
      "A fresh set password link was issued for an existing account. Nothing was created. Whether an email carrying it was queued is recorded separately, by the caller that queues it.",
  });

  return { token: issued.token, displayName: (user.display_name as string) ?? "", customerUserId: user.id as string };
}

/**
 * What happened when a set password link was handed to the queue, recorded by
 * the code that did the handing.
 *
 * "Queued", never "sent": the queue accepting a job is not a message leaving,
 * and the email job records the provider's acceptance on its own row when that
 * happens. A failed enqueue is written as a failure, because a trail that is
 * silent about a link nobody received reads as a link that went.
 */
export async function recordLinkEmailQueued(
  customerUserId: string,
  result: { ok: true; id: number; duplicate: boolean } | { ok: false; error: string },
): Promise<void> {
  await recordSystemAudit({
    action: result.ok ? "customer_account.link_email_queued" : "customer_account.link_email_not_queued",
    entityType: "customer_user",
    entityId: customerUserId,
    summary: result.ok
      ? `An email carrying the set password link was queued${result.id > 0 ? ` as job ${result.id}` : ""}${result.duplicate ? ", matching one already waiting" : ""}. Queued is not sent; the job records delivery.`
      : `The email carrying the set password link could not be queued, so it was not sent: ${result.error}`,
  });
}

/**
 * Mark the address proven and let the account act.
 *
 * Called when a set password link is used, which is the moment the address is
 * proven: somebody opened mail sent to it. There is no separate verification
 * step and no code to type, which is the operator's ruling.
 */
export async function markAddressProven(customerUserId: string): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;

  const { error } = await db
    .from("eng_customer_users")
    .update({ email_verified_at: DB_NOW, status: "active", updated_at: DB_NOW })
    .eq("id", customerUserId);

  if (error) return false;

  await recordSystemAudit({
    action: "customer_account.address_proven",
    entityType: "customer_user",
    entityId: customerUserId,
    summary: "The address was proven by opening the signed link, and the account became active.",
  });
  return true;
}

/** Re-exported so a caller never reaches past this module for the principal. */
export { SYSTEM_ACTOR, SYSTEM_ACTOR_EMAIL, SYSTEM_ACTOR_ROLE };
