# The sitting staged by the overnight run of 2026-10-07 into 2026-10-08

Written 2026-10-08 on `feat/protocols-v1-1`. **Nothing here is run by a
session.** The operator's counterpart runs each step, development first and
production second, and pastes the output back. **Every read-back has a
prediction, and one that does not match stops the sitting at that step.** No
statement below contains either word the Supabase connector refuses.

**One migration only: 0065, the seven v1.1 protocols as drafts.** The other work
of the night (the credentials screen, coverage counties, certification
recording, the People audit fix) carries no migration. Certification recording
stores its steps as audit events, an interim decision in
`docs/rulings-2026-10-06.md` section 9 for the operator's review.

## What 0065 does

It inserts one `eng_protocol_templates` row per document, for 254-WP-001,
254-WS-001, 254-MH-001, 254-SL-001, 254-PL-001, 254-RS-001 and 254-DS-001, each
at version label `1.1`, status **`draft`** (0049: the engineer has not signed),
carrying the SHA-256 of its PDF. It changes no table, column, constraint,
index, trigger or function, so **the shape fingerprint and every count stay
where they are**, and the read-back is the rows. Each insert is guarded by
`not exists` and followed by an assertion that exactly one draft row names that
document at v1.1 with its digest, so a second apply changes nothing and a miss
rolls back.

**It opens no line.** A draft row holds no signature date, approver or
publication date. Offered lines stay `roof-inspections` only, in
`src/config/launch-conditions.ts`. Aman signs each protocol in the portal; that
signature is a seal record and needs nothing from this migration.

## Step 0, before 0065, on each database

```sql
select md5(string_agg(sig, '|' order by sig)) as shape, count(*) as columns
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
```

**Predict:** shape `aff578e18d558ee5af26fb2cb8c9eb88`, **1170** columns, on
production (it took 0061 to 0064 on 2026-10-07 and read back this figure) and on
development, if development holds 0061 to 0064. **If development reads anything
else, stop:** it is not at 0064 and 0065 is not the next migration for it.

```sql
select document_number, version, version_label, status
from eng_protocol_templates
where document_number in ('254-WP-001','254-WS-001','254-MH-001','254-SL-001','254-PL-001','254-RS-001','254-DS-001')
order by document_number;

select service_slug, max(version) as highest_version
from eng_protocol_templates
where service_slug in ('windstorm-wpi-8','manufactured-home-foundation-certifications','solar-structural-letters',
                       'structural-letters','repair-specifications','residential-light-commercial-design')
group by service_slug order by service_slug;
```

**Predict:** the first returns **no rows**. The second is recorded rather than
predicted, because nothing in the repository says what template rows those five
lines already hold on each database; each new row's version is that line's
highest plus one, at the moment it is inserted.

## Step 1, development: apply 0065

Through the connector's `apply_migration`, named
`0065_seven_protocols_enter_as_drafts`, the file as written. It has one comment
block at the top and per-document comment lines; leave them in or out, as the
connector allows. Every statement goes as written.

## Step 2, development: read back

```sql
select document_number, version, version_label, status, document_sha256,
       document_signed_at is null as unsigned, firm_name_on_document
from eng_protocol_templates
where document_number in ('254-WP-001','254-WS-001','254-MH-001','254-SL-001','254-PL-001','254-RS-001','254-DS-001')
order by document_number;
```

**Predict:** exactly **seven** rows, each `1.1`, `draft`, `unsigned` true,
`254 Engineering Services`, with these digests:

| Document | document_sha256 |
| --- | --- |
| 254-DS-001 | `37dd6b2e44155108df1daa681277332ddb64450a0f58813979e538da469ee22b` |
| 254-MH-001 | `5c88c73d9815cfae6825ef82d4368dd66a98dce746deed91b3c351cf2df09d4a` |
| 254-PL-001 | `f1ff2e5883aac06ac1b468a74ea09535c074a468a31de4c04297bf4c74b11387` |
| 254-RS-001 | `c7913d6637f2a08b1cd09a49c1767c682895db864143005a07bba99def8c2dd2` |
| 254-SL-001 | `7bac29a7021086a7a40906021de5be9c2c2efaba747db33877410dd7b5c4e8f3` |
| 254-WP-001 | `e7515b42a3d319483c40dc2ded4d07527f8ada932410d64ad69ec9c45ccb3040` |
| 254-WS-001 | `f4cbe248957298bbae6d968350d3732ef3197b46684959c6ec083f494f3ed6b5` |

and each `version` one more than step 0's highest for its line, with 254-WS-001
one more than 254-WP-001 (the file inserts WP-001 first and they share
`windstorm-wpi-8`). Then the step 0 shape query again. **Predict:** unchanged,
`aff578e18d558ee5af26fb2cb8c9eb88`, 1170 columns.

## Steps 3 and 4, production: the same apply and the same read back

The same `apply_migration`, then the step 2 queries. **Predict:** the same seven
rows and digests, versions by the same rule from production's own step 0
figures, the shape unchanged at `aff578e18d558ee5af26fb2cb8c9eb88` across 1170
columns.

**Then the ledger**: the session writes 0065's development and production
records in `supabase/applied.mjs` from the pasted output, and the branch merges
only after that, under the operator's word: a migration on main is never
pending.

## Run 2026-10-08, by the counterpart: every prediction held

Applied to both databases through `apply_migration`, the file as written
without its header comment, and read back on each.

| | Production | Development |
| --- | --- | --- |
| Rows | Seven, v1.1, draft, unsigned, 254 Engineering Services | The same seven |
| Digests | As tabled above | The same |
| 254-WP-001 version | 1 | 2 |
| 254-WS-001 version | 2 | 3 |
| The other five | 1 each | 1 each |
| Shape | `aff578e18d558ee5af26fb2cb8c9eb88`, 1170, unchanged | unchanged |

Development's two windstorm versions are one higher because it already held a
`windstorm-wpi-8` version 1 row. On each database every version is one above
its line's highest, which is the prediction. Recorded in `supabase/applied.mjs`.

## What the session could not check

That development holds 0061 to 0064. The ledger says the counterpart applied
them there on 2026-10-07; step 0's shape reading is what confirms it before
anything is applied.
