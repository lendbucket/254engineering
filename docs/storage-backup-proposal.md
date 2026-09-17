# A backup for stored files, and the map between a file and its record

Written 2026-09-15, overnight, as Phase 14's storage item. **A proposal. Nothing
here is built, no migration is written, no vendor is chosen, and nothing was
created or spent.** The gap it answers is in `docs/disaster-recovery.md` section
2b; this document is what closing it would take.

---

## 1. What the provider says, read tonight rather than remembered

From Supabase's own documentation, fetched 2026-09-15:

- **Database backups** (`/docs/guides/platform/backups`): "Database backups do not
  include objects you store via the Storage API, as the database only includes
  metadata about these objects. Restoring an old backup does not restore objects
  you deleted after that backup."
- **Download objects** (`/docs/guides/storage/management/download-objects`): "File
  metadata is stored separately from the actual files. It lives in the
  `storage.buckets` and `storage.objects` tables in your Postgres database."
- The same page: Storage "exposes an S3-compatible endpoint", usable with the AWS
  CLI or rclone.

**That answers the question section 2b left open, and the answer is the worse
one.** 2b said it was not established whether "not in database backups" meant
the bytes, the rows, or both. It means the bytes. The rows describing each object
live in Postgres and ARE backed up. So a rewind does not merely leave
`eng_documents` pointing at a missing file: it restores `storage.objects` rows
that describe files which no longer exist. After a rewind, the storage schema's
own listing says the file is there.

---

## 2. What is actually stored, measured tonight

Counts and sizes only. No object names were read, so no filename carrying a
person's name entered this session.

**Production, firm-owned buckets:** 2 objects, 155,628 bytes, both in
`eng-uploads`, both `application/pdf`.

| Created | Bytes | Referenced by a row |
| --- | --- | --- |
| 2026-08-28 | 193 | **No. Nothing in the database points at it.** |
| 2026-09-03 | 155,435 | Yes, and only from inside `eng_applications.payload`, a JSON document |

The 193-byte file predates development's creation on 2026-09-02, when audits
still wrote to production, which makes it plausibly probe residue. **That is a
hypothesis**, and nothing tonight established it.

**Development:** `eng-evidence` holds 98 objects, 15,680 bytes, written
2026-09-03, and **not one is referenced by a row**: the 8 evidence rows carry no
`storage_key` at all. `eng_onboarding_items` holds 16 rows with a `storage_key`,
and `eng-onboarding` is empty, so **all 16 point at nothing**. The other three
buckets are empty.

**So a reconciliation would have something to say on both projects today, in both
directions**: an object no row names (production 1, development 98) and a row
naming no object (development 16). No check in this repository reads either.

---

## 3. THE MAP IS LARGER THAN THE ONE WRITTEN DOWN, AND PART OF IT IS NOT IN ANY COLUMN

`docs/disaster-recovery.md` 2b lists six tables that point at storage. Asking the
schema for every column shaped like a storage pointer, then reading the code that
writes each bucket, finds nine places:

| Where the pointer lives | Bucket recorded on the row? | Bucket by | In 2b |
| --- | --- | --- | --- |
| `eng_documents.storage_key` | yes, `bucket` | the row | yes |
| `eng_order_inputs.storage_key` | yes, `bucket` | the row | yes |
| `eng_partner_asset_versions.storage_key` | yes, `bucket` | the row | yes |
| `eng_partner_submissions.storage_key` | yes, `bucket` | the row | yes |
| `eng_evidence_items.storage_key`, `thumb_key` | **no** | `src/lib/ops-engineer.ts` convention, `eng-evidence` | yes |
| `eng_onboarding_items.storage_key` | **no** | `src/lib/onboarding-uploads.ts` constant, `eng-onboarding` | yes |
| **`eng_credentials.storage_key`** | **no** | not established tonight | **no** |
| **`eng_messages.attachments`**, a JSON array | **no** | `src/lib/ops-threads.ts` constant, `eng-messages` | **no** |
| **`eng_applications.payload`** at `resume.path`, `certifications.path`, `licenseDocument.path` | **no** | `src/lib/uploads.ts` constant, `eng-uploads` | **no** |

**The last row is the one that matters today.** The only file this firm stores on
production that any record points at is named from inside a JSON answer blob, in
a table no storage mapping mentions. A reconciliation built from 2b's six tables
would report that file as an orphan, and a restore built from them would not know
to bring it back.

**Five of the nine carry no bucket.** A restore performed by somebody reading only
the database cannot tell which bucket those keys belong to; the answer is a
constant in application code.

---

## 4. The proposal

### 4.1 The map becomes a declaration, and the board derives the candidates

`scripts/lib/storage-pointers.mjs`: one entry per place a row names an object,
with the table, the column or JSON path, the bucket or the file holding the bucket
convention, and whether the object is regulatory (a sealed document, evidence) or
not. The same declared inventory idiom as `surfaces.mjs`.

A board check derives the candidates from the schema, the way `copy-project.mjs`'s
completeness check derives tables from the migrations: every column matching the
pointer shape must be declared or listed as not a pointer with a reason. **The
three missing rows above are exactly what that check would have caught.** A JSON
path cannot be found from column names, so the check also asserts every
`storage.from("eng-...")` call site in `src/` belongs to a declared entry.

### 4.2 The bucket goes on the row

A migration adding `bucket` to the five tables that lack it, backfilled from the
declared convention, **before there is evidence to backfill**. Cheapest now:
production holds no evidence, no onboarding documents, no credentials and no
message attachments.

### 4.3 A scheduled copy, through the S3 endpoint, to storage the firm controls

- Incremental: an object whose key, size and checksum are already at the
  destination is not sent again, so egress follows new uploads, not the total.
- **Never deletes at the destination.** An object deleted at the source is marked
  deleted in the manifest and kept, because "restoring an old backup does not
  restore objects you deleted after that backup" is the failure being closed.
- Outside the provider, so the copy survives the provider being unreachable,
  which is point 2 of the cutover plan's step 15.

### 4.4 A manifest travels WITH the bytes, not only in the database

Each run writes a manifest beside the objects: bucket, key, size, content type,
SHA-256, source `created_at`, **and every row that points at the object**, as
table, row id and column or path. It lives at the destination because the
database is the thing a rewind rolls back; a mapping stored only in the database
restores to the same wrong moment as everything else.

### 4.5 Reconciliation both ways, after every copy

Every declared pointer resolves to an object, and every object in an `eng-` bucket
is named by a declared pointer. Either direction alone misses half. A
disagreement raises a task for a person, not a log line. It needs `raiseSystemTask`, which **cannot insert today**
(see `BACKLOG.md`, the system principal entry), so that ruling comes first.

### 4.6 The restore, written before it is needed

After a database rewind: read the restored pointers, compare them to the latest
manifest, copy back every object a restored row names, and write down each
pointer that could not be satisfied. Timed, for the same reason section 4 of
`docs/disaster-recovery.md` times the database restore.

---

## 5. What it costs, from published prices

**Volume today: 155,628 bytes on production, about 0.00015 GB.** Every figure
below is a list price read tonight, and the vendor is the operator's choice.

| Line | Price, and where it was read | At today's volume |
| --- | --- | --- |
| Supabase egress for the copy | $0.09 per GB uncached beyond the Pro plan's 250 GB monthly quota; `/docs/guides/platform/manage-your-usage/egress` | $0 |
| Supabase storage at the source | $0.0213 per GB-month beyond 100 GB on Pro; `/docs/guides/storage/pricing` | unchanged, nothing added |
| Cloudflare R2 as the destination | $0.015 per GB-month, first 10 GB-month free; Class A $4.50 and Class B $0.36 per million requests, 1 million and 10 million free; egress free; `developers.cloudflare.com/r2/pricing` | $0 |
| A second Supabase project as the destination | about $10.18 a month, the figure the provider quoted for a clone on 2026-09-14 | about $10.18 |
| The scheduled job's compute | **not priced tonight** | unknown |

**The formula, so nobody invents a volume.** With `V` GB stored and `N` GB of new
uploads a month, on R2: storage `max(0, V - 10) x $0.015` a month, requests well
inside the free tier at this firm's scale, and Supabase egress free until the
month's total egress, across every service in the organisation, passes 250 GB.
At 100 GB stored, R2 storage is $1.35 a month.

**The second-project option costs more than the whole R2 option would at 600 GB,
and shares a provider with the thing it backs up.** That comparison is the one
the operator will be asked to rule on.

---

## 6. What this does not decide

- The vendor, the account, and who holds its credentials. A new credential goes
  into `src/config/credential-inventory.ts` with its environments.
- How long deleted objects are kept at the destination. That is a retention
  ruling, and a sealed document's evidence is the kind of record
  `retention-policy.ts` treats as kept forever.
- Whether the 193-byte file on production is residue to remove. Nothing is removed
  on this proposal's authority.
