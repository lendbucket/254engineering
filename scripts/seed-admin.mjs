/**
 * Create the first administrator.
 *
 *   npx tsx scripts/seed-admin.mjs "Robert Reyna" ceo@36west.org
 *
 * WHY THIS EXISTS AS A SCRIPT AND NOT A SETUP PAGE
 * ------------------------------------------------
 * Account creation is admin only, which leaves the obvious problem that the
 * first admin has nobody to create them. The usual answer is a setup wizard that
 * is open until somebody claims it, and that is a public account creation
 * endpoint sitting on a production site waiting for whoever finds it first.
 *
 * A script that requires the service role key solves the same problem with no
 * public surface at all. It refuses to run once an admin exists, so it cannot be
 * used a second time to mint a quiet second owner.
 *
 * THE AUTH TABLE IS SHARED WITH THE OTHER APPS ON THIS PROJECT
 * ------------------------------------------------------------
 * Every table this platform owns carries the eng_ prefix because the Supabase
 * project hosts several unrelated applications. auth.users has no prefix and
 * cannot have one. So the address given here may already exist, and if it does
 * the existing user is LINKED and its password is left completely alone: it is
 * the same credential another application uses, and resetting it here would lock
 * somebody out of something else without telling them why.
 */
import { auditClient, describeTarget } from "./lib/db-target.mjs";
import { createHash, randomBytes } from "node:crypto";

const [, , nameArg, emailArg] = process.argv;
if (!nameArg || !emailArg) {
  console.error('Usage: npx tsx scripts/seed-admin.mjs "Full Name" email@example.com');
  process.exit(1);
}

/*
 * Seeding the real first administrator is one of the few things that genuinely
 * belongs against production, so this is expected to be run with
 * ALLOW_PRODUCTION_DB=1. The guard still makes that a deliberate act rather than
 * whatever SUPABASE_URL happened to hold.
 */
const db = auditClient("seed-admin");
if (!db) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
console.error(`seeding against ${describeTarget(process.env.SUPABASE_URL)}`);

const { count } = await db
  .from("eng_profiles")
  .select("id", { count: "exact", head: true })
  .eq("role", "admin");

if ((count ?? 0) > 0) {
  console.error(
    `An administrator already exists (${count}). Create further accounts from the portal, under People.`,
  );
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();

let userId = null;
for (let page = 1; page <= 20 && !userId; page++) {
  const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (!data?.users?.length) break;
  const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (hit) userId = hit.id;
  if (data.users.length < 200) break;
}

const linked = Boolean(userId);

if (!userId) {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (error || !created?.user) {
    console.error("Could not create the auth user:", error?.message);
    process.exit(1);
  }
  userId = created.user.id;
}

const { error: profileError } = await db.from("eng_profiles").insert({
  id: userId,
  email,
  display_name: nameArg.trim(),
  role: "admin",
  // A linked account already has a working password, so there is nothing to
  // invite them to do and no reason to hold them at "invited".
  status: linked ? "active" : "invited",
});
if (profileError) {
  // Only delete the auth user if this script created it. Deleting a
  // pre-existing one would take away another application's access.
  if (!linked) await db.auth.admin.deleteUser(userId).catch(() => {});
  console.error("Could not create the profile:", profileError.message);
  process.exit(1);
}

const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3225").replace(/\/$/, "");

let link = null;
if (!linked) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const { error: tokenError } = await db.from("eng_auth_tokens").insert({
    profile_id: userId,
    purpose: "set_password",
    token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
    expires_at: expiresAt.toISOString(),
  });
  if (tokenError) {
    console.error("The account exists but the link could not be issued:", tokenError.message);
    process.exit(1);
  }
  link = `${base}/portal/set-password?token=${encodeURIComponent(token)}`;
}

await db.from("eng_audit_events").insert({
  actor_id: userId,
  actor_email: email,
  actor_role: "admin",
  action: "profile.seed_first_admin",
  entity_type: "profile",
  entity_id: userId,
  summary: linked
    ? `Linked the existing account ${email} as the first administrator, from scripts/seed-admin.mjs`
    : `Seeded the first administrator ${email}, from scripts/seed-admin.mjs`,
});

console.log("");
console.log("First administrator ready.");
console.log(`  Name    : ${nameArg}`);
console.log(`  Email   : ${email}`);
if (linked) {
  console.log("  Password: unchanged, and deliberately so. This address already had");
  console.log("            credentials on this Supabase project, shared with another");
  console.log("            application, so nothing was reset. Sign in with the password");
  console.log("            you already use for it.");
  console.log(`  Sign in : ${base}/portal/login`);
} else {
  console.log(`  Link    : ${link}`);
  console.log("  Expires : in 72 hours, and it works once.");
}
console.log("");
console.log("Everyone else is created inside the portal, under People.");
