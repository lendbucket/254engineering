/**
 * POSSIBLE DUPLICATE CLIENTS: TWO CLIENTS SHARING AN EMAIL ADDRESS.
 *
 * Robert's answer 8 to the evening report of 2026-11-17 (6963018405), on the
 * staff walk's defect of 2026-10-03: a second client at the same address is a
 * real second client (a household and a landlord are both real), so there is
 * no unique constraint, and the clients screen marks a POSSIBLE duplicate when
 * two clients share an address. "Address" is the email address: it is what
 * createClient's double click guard compares, and it is what a client record
 * carries (eng_clients has no street address).
 *
 * Pure, so the rule is proven without a database. Compared trimmed and without
 * regard to case, because "Bob@Example.com" and "bob@example.com " reach the
 * same inbox. A client with no email is never a possible duplicate of another
 * client with no email: nothing is shared.
 */

/** The address as it is compared: trimmed and lowercased, or null when there is none. */
export function comparableEmail(raw: string | null | undefined): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  return email ? email : null;
}

/** The comparable emails held by more than one distinct client among the rows given. */
export function sharedEmails(rows: { id: string; email: string | null }[]): Set<string> {
  const holders = new Map<string, Set<string>>();
  for (const row of rows) {
    const email = comparableEmail(row.email);
    if (!email) continue;
    const ids = holders.get(email) ?? new Set<string>();
    ids.add(row.id);
    holders.set(email, ids);
  }
  return new Set([...holders].filter(([, ids]) => ids.size > 1).map(([email]) => email));
}
