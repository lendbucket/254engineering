# Dispatch readiness on production, for a sitting

**Prepared 2026-10-06. Not run.** The operator runs it in the Supabase SQL editor
against `fsaryeciduszuahgjbly`, in a sitting, in the three-block shape of
`docs/production-sitting-destructive.md`: read, write, read. Nothing here is
destructive; every write is an insert or an update of one row the operator names.

It carries out rulings 3 and 4 of `docs/rulings-2026-10-06.md`: Robert's
roof-inspections certification from his statement of training on 254-RC-001 v1.1
dated 2026-09-23, and his coverage set to all 254 Texas counties. It also
prepares his credentials, two of which wait on a ruling.

---

## READ THIS FIRST: these writes do not make Robert dispatchable on their own

Dispatch only ever considers profiles whose role is `field_tech`.
`candidateTechs()` in `src/lib/ops-field.ts` reads
`eng_profiles ... .eq("role", "field_tech")`. Robert's profile on production is
`admin`, read by the operator's chat counterpart on 2026-10-06, and since
migration 0018 a profile has exactly one role.

So after every block below has run, a paid roof order still offers to nobody.
One of these has to be ruled first:

| | Option | Cost |
| --- | --- | --- |
| a | A second profile for Robert with role `field_tech`, signing in with a second email address | Two logins for one person. No code change. Field work is attributed to the technician profile and administration to the admin one, which is honest about which hat he wore. |
| b | Change Robert's one profile to `field_tech` | He loses the administrator screens. Not workable while he is the only administrator. |
| c | A code change so an administrator can be dispatched | A change to who may be offered work, which is a behaviour ruling, and it touches the dispatch rule every audit of dispatch asserts. |

**Recommendation: a.** The script below takes the profile id as its one input,
so it serves either a or c unchanged.

---

## Inputs the operator supplies at the sitting

| Placeholder | What it is | Where it comes from |
| --- | --- | --- |
| `PROFILE_ID` | The `eng_profiles.id` the certification, coverage and credentials attach to | Block 1 prints it |
| `ROBERT_ADMIN_EMAIL` | The email on Robert's admin profile, so the verifier is named | Block 1 prints it |
| `DL_EXPIRES` | Driver's licence expiry, `YYYY-MM-DD` | Read off the licence by the operator. The number is never recorded; Gusto holds identity documents |
| `VI_EXPIRES` | Vehicle insurance expiry, `YYYY-MM-DD` | Read off the policy declarations page |

---

## Block 1. Dry run, read only

```sql
-- Who the writes will attach to. Expect Robert, and note his role.
select id, email, display_name, role, status,
       coalesce(array_length(coverage_counties, 1), 0) as counties_now
from public.eng_profiles
where role in ('admin', 'field_tech')
order by role, display_name;

-- The protocol the certification is for. Expect one row: 254-RC-001, 1.1, published.
select id, document_number, version, version_label, status, approved_at, published_at
from public.eng_protocol_templates
where service_slug = 'roof-inspections'
order by version;

-- What already exists for that profile. Expect zero rows in both.
select profile_id, service_slug, status, certified_at
from public.eng_certifications where profile_id = 'PROFILE_ID';

select profile_id, kind, status, expires_on
from public.eng_credentials where profile_id = 'PROFILE_ID';
```

**Stop if** the protocol query does not return exactly one published row for
254-RC-001 version 1.1, or if either of the last two queries returns a row. The
writes below assume a clean start and must not be layered on an unknown one.

---

## Block 2. The writes

### 2a. The roof-inspections certification (ruling 3)

The statement is dated 2026-09-23 with no time, so the time is recorded as the
start of that day in Central time rather than invented.

```sql
insert into public.eng_certifications
  (profile_id, service_slug, template_id, status, attempts, certified_at)
select 'PROFILE_ID', 'roof-inspections', t.id, 'certified', 1,
       timestamptz '2026-09-23 00:00:00-05'
from public.eng_protocol_templates t
where t.service_slug = 'roof-inspections'
  and t.document_number = '254-RC-001'
  and t.version_label = '1.1'
  and t.status = 'published'
on conflict (profile_id, service_slug) do nothing;
```

`score` is left null: no assessment was scored, and a number here would be a
fabricated one.

### 2b. Coverage, all 254 counties (ruling 4)

Generated from `TEXAS_COUNTIES` in `src/lib/ops-counties.ts` and checked name by
name against the independent canonical list in `scripts/coverage-audit.mjs`: 254
each, no difference in either direction. Dispatch compares on the name with any
trailing "County" removed and case ignored (`normalizeCounty` in
`src/lib/ops-dispatch.ts`), which is the form below.

```sql
update public.eng_profiles
set coverage_counties = array[
  'Anderson', 'Andrews', 'Angelina', 'Aransas', 'Archer', 'Armstrong', 'Atascosa', 'Austin',
  'Bailey', 'Bandera', 'Bastrop', 'Baylor', 'Bee', 'Bell', 'Bexar', 'Blanco',
  'Borden', 'Bosque', 'Bowie', 'Brazoria', 'Brazos', 'Brewster', 'Briscoe', 'Brooks',
  'Brown', 'Burleson', 'Burnet', 'Caldwell', 'Calhoun', 'Callahan', 'Cameron', 'Camp',
  'Carson', 'Cass', 'Castro', 'Chambers', 'Cherokee', 'Childress', 'Clay', 'Cochran',
  'Coke', 'Coleman', 'Collin', 'Collingsworth', 'Colorado', 'Comal', 'Comanche', 'Concho',
  'Cooke', 'Coryell', 'Cottle', 'Crane', 'Crockett', 'Crosby', 'Culberson', 'Dallam',
  'Dallas', 'Dawson', 'DeWitt', 'Deaf Smith', 'Delta', 'Denton', 'Dickens', 'Dimmit',
  'Donley', 'Duval', 'Eastland', 'Ector', 'Edwards', 'El Paso', 'Ellis', 'Erath',
  'Falls', 'Fannin', 'Fayette', 'Fisher', 'Floyd', 'Foard', 'Fort Bend', 'Franklin',
  'Freestone', 'Frio', 'Gaines', 'Galveston', 'Garza', 'Gillespie', 'Glasscock', 'Goliad',
  'Gonzales', 'Gray', 'Grayson', 'Gregg', 'Grimes', 'Guadalupe', 'Hale', 'Hall',
  'Hamilton', 'Hansford', 'Hardeman', 'Hardin', 'Harris', 'Harrison', 'Hartley', 'Haskell',
  'Hays', 'Hemphill', 'Henderson', 'Hidalgo', 'Hill', 'Hockley', 'Hood', 'Hopkins',
  'Houston', 'Howard', 'Hudspeth', 'Hunt', 'Hutchinson', 'Irion', 'Jack', 'Jackson',
  'Jasper', 'Jeff Davis', 'Jefferson', 'Jim Hogg', 'Jim Wells', 'Johnson', 'Jones', 'Karnes',
  'Kaufman', 'Kendall', 'Kenedy', 'Kent', 'Kerr', 'Kimble', 'King', 'Kinney',
  'Kleberg', 'Knox', 'La Salle', 'Lamar', 'Lamb', 'Lampasas', 'Lavaca', 'Lee',
  'Leon', 'Liberty', 'Limestone', 'Lipscomb', 'Live Oak', 'Llano', 'Loving', 'Lubbock',
  'Lynn', 'Madison', 'Marion', 'Martin', 'Mason', 'Matagorda', 'Maverick', 'McCulloch',
  'McLennan', 'McMullen', 'Medina', 'Menard', 'Midland', 'Milam', 'Mills', 'Mitchell',
  'Montague', 'Montgomery', 'Moore', 'Morris', 'Motley', 'Nacogdoches', 'Navarro', 'Newton',
  'Nolan', 'Nueces', 'Ochiltree', 'Oldham', 'Orange', 'Palo Pinto', 'Panola', 'Parker',
  'Parmer', 'Pecos', 'Polk', 'Potter', 'Presidio', 'Rains', 'Randall', 'Reagan',
  'Real', 'Red River', 'Reeves', 'Refugio', 'Roberts', 'Robertson', 'Rockwall', 'Runnels',
  'Rusk', 'Sabine', 'San Augustine', 'San Jacinto', 'San Patricio', 'San Saba', 'Schleicher', 'Scurry',
  'Shackelford', 'Shelby', 'Sherman', 'Smith', 'Somervell', 'Starr', 'Stephens', 'Sterling',
  'Stonewall', 'Sutton', 'Swisher', 'Tarrant', 'Taylor', 'Terrell', 'Terry', 'Throckmorton',
  'Titus', 'Tom Green', 'Travis', 'Trinity', 'Tyler', 'Upshur', 'Upton', 'Uvalde',
  'Val Verde', 'Van Zandt', 'Victoria', 'Walker', 'Waller', 'Ward', 'Washington', 'Webb',
  'Wharton', 'Wheeler', 'Wichita', 'Wilbarger', 'Willacy', 'Williamson', 'Wilson', 'Winkler',
  'Wise', 'Wood', 'Yoakum', 'Young', 'Zapata', 'Zavala'
]::text[]
where id = 'PROFILE_ID';
```

### 2c. Credentials: the two that apply to anybody who drives to a property

A credential row records that a document exists and when it lapses, never a copy
of it. `storage_key` stays null; the operator has read the document and Gusto or
the operator's own records hold it. `verified_by` is the operator's admin
profile, which on Robert's own credentials is self-verification and is recorded
as such rather than hidden.

```sql
insert into public.eng_credentials
  (profile_id, kind, label, expires_on, status, verified_at, verified_by)
select 'PROFILE_ID', k.kind, k.label, k.expires_on::date, 'verified', now(),
       (select id from public.eng_profiles where role = 'admin' and email = 'ROBERT_ADMIN_EMAIL')
from (values
  ('drivers_license',   'Texas driver licence, read by the operator',            'DL_EXPIRES'),
  ('vehicle_insurance', 'Vehicle insurance, declarations page read by the operator', 'VI_EXPIRES')
) as k(kind, label, expires_on);
```

### 2d. HELD: the W-9 and the independent contractor agreement

**Not run until ruled.** Dispatch requires all four kinds
(`REQUIRED_FOR_DISPATCH` in `src/lib/ops-credentials.ts`). For an owner of the
LLC doing the inspection himself, a W-9 and an independent contractor agreement
are documents for paying an outside contractor, and recording them as verified
for the owner would be recording two things that are not true. The question and
the recommendation are in the session report of 2026-10-06; this block stays
empty until the ruling.

---

## Block 3. Verification, read only, as its own statements

```sql
select service_slug, status, certified_at, template_id
from public.eng_certifications where profile_id = 'PROFILE_ID';
-- Expect one row: roof-inspections, certified, 2026-09-23 05:00:00+00.

select role, array_length(coverage_counties, 1) as counties,
       'Nueces' = any(coverage_counties) as has_nueces
from public.eng_profiles where id = 'PROFILE_ID';
-- Expect counties 254 and has_nueces true. Role is whatever option a, b or c left.

select kind, status, expires_on, storage_key is null as holds_no_document
from public.eng_credentials where profile_id = 'PROFILE_ID' order by kind;
-- Expect drivers_license and vehicle_insurance, verified, future expiry, true.
```

**What is still owed afterwards:** the role decision above, and the 2d ruling.
Until both are settled, dispatch for a roof order still finds nobody, and the
screen at `/portal/files` will say so when a paid order reaches dispatch.
