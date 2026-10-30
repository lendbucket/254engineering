import "server-only";
import { supabaseAdmin } from "./supabase";
import { readEvery } from "./bounded-read";
import type { RoleKey } from "./ops-authz";

/**
 * EVERY ACCOUNT THAT CAN SIGN IN, for /portal/people and its CSV.
 *
 * The screen read this with one unbounded select, which PostgREST answers
 * with at most a thousand rows and no word that it stopped, while the panel
 * title counted what came back as everybody. One home now, read through
 * readEvery, so the screen and the file cannot disagree about who exists and
 * neither can be cut short in silence.
 */
export type Person = {
  id: string;
  email: string;
  display_name: string;
  role: RoleKey;
  status: "invited" | "active" | "suspended";
  phone: string | null;
  license_number: string | null;
  base_county: string | null;
  coverage_counties: string[];
  last_sign_in_at: string | null;
  created_at: string;
};

export async function readPeople(): Promise<{ ok: true; rows: Person[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<Person>((from, to) =>
    db
      .from("eng_profiles")
      .select("id, email, display_name, role, status, phone, license_number, base_county, coverage_counties, last_sign_in_at, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return read.ok ? { ok: true, rows: read.rows } : { ok: false, error: read.error };
}
