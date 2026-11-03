/*
 * ===========================================================================
 * 0108  LEAST PRIVILEGE FOR THE ENGINEER AND READ ONLY.
 * ===========================================================================
 *
 * Robert, 2026-11-02, approving P2 (issue #1, comment 6567596115) with one
 * addition: "engineer loses clients.list; read_only loses pricing.read,
 * billing.read, ledger.read_all AND clients.list; every CSV export moves to the
 * admin export gate (option a)". The chat counterpart read production's
 * eng_role_grants the same day and it matched the posted table, so these five
 * rows are known to exist there.
 *
 * WHAT IT DOES. Revokes five (role, action) rows and nothing else:
 *
 *   engineer   clients.list
 *   read_only  pricing.read, billing.read, ledger.read_all, clients.list
 *
 * The export gate needs no row: it is LIST_EXPORT_GRANT (accounts.manage),
 * which the administrator alone already holds, asked by every CSV door in code
 * through mayExport in src/lib/list-exports.ts.
 *
 * WHY A DELETE, AND WHY THIS NARROW. eng_role_grants is a row per (role,
 * action) and can() asks whether the row exists, so a revoke is a delete, as
 * 0059 was. Each statement names both columns, so it touches exactly the rows
 * the ruling names and cannot widen into a cleanup. It is plain SQL rather than
 * a DO block, the shape 0059 reached production in through apply_migration.
 *
 * IDEMPOTENT. A second run deletes nothing already gone, and the closing block
 * only reads.
 *
 * WHAT IT DOES NOT TOUCH. admin keeps every grant. No other role changes: the
 * dispatcher, sales, customer service, rep and operations manager keep
 * clients.list, and nobody else held the money grants read_only loses.
 *
 * THE CODE SIDE IS IN THE SAME BRANCH. DEFAULT_ROLES in src/lib/ops-authz.ts
 * declares the same grants, and roles-audit replays this chain in order against
 * that declaration and against its own independent table for all nine roles.
 */

delete from eng_role_grants where role_key = 'engineer'  and action = 'clients.list';
delete from eng_role_grants where role_key = 'read_only' and action = 'pricing.read';
delete from eng_role_grants where role_key = 'read_only' and action = 'billing.read';
delete from eng_role_grants where role_key = 'read_only' and action = 'ledger.read_all';
delete from eng_role_grants where role_key = 'read_only' and action = 'clients.list';

/* The read-back the migration carries itself: none of the five may remain, and admin keeps all four actions. */
do $$
declare
  left_over integer;
  admin_kept integer;
begin
  select count(*) into left_over
    from eng_role_grants
   where (role_key = 'engineer'  and action = 'clients.list')
      or (role_key = 'read_only' and action in ('pricing.read', 'billing.read', 'ledger.read_all', 'clients.list'));
  if left_over <> 0 then
    raise exception '0108: % revoked grant(s) still present', left_over;
  end if;

  select count(*) into admin_kept
    from eng_role_grants
   where role_key = 'admin'
     and action in ('clients.list', 'pricing.read', 'billing.read', 'ledger.read_all');
  if admin_kept <> 4 then
    raise exception '0108: admin holds % of the four actions, expected 4', admin_kept;
  end if;
end
$$;
