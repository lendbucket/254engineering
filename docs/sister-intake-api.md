# The sister intake API

**Built 2026-09-07, in the closeout, before the database cutover and because of
it. Operator ruling: the sisters POST a lead rather than writing Supabase.**

This is the reference a session in `sealedengineering` or `stampmyplans` works
from. It is written here because the endpoint is here; both sibling briefs point
at it.

---

## What it replaces, and why that mattered

Both sister deployments hold a Supabase **service role key** for the project
this firm calls production, and write `eng_leads` directly. Three deployments
share one database's master credential, and 254's portal reads all three brands'
leads with no site filter, because it is deliberately the shared inbox.

That coupling is what made the cutover a coordination problem rather than a
deploy. From `docs/production-cutover-plan.md`, step 8b:

> Cut over 254 alone and the sisters keep writing to the old project while the
> only screen anybody opens reads the new one. No error, no gap in a sequence,
> nothing to notice, and it surfaces as a customer who was never called back.

The plan listed three answers. This is the third: the sisters stop holding a
service role key at all and post a lead to an endpoint instead. After it is
wired up, a sister pointed at the wrong place gets an error it can see.

---

## The endpoint

```
POST https://254engineering.com/api/intake/lead
Content-Type: application/json
x-intake-key: <the key for this brand>
```

### The body

Every field is optional except that a lead must carry **an email address or a
telephone number**. An enquiry nobody can answer is a row rather than a lead.

```jsonc
{
  "form": "contact",        // or "waitlist". Anything else is refused.
  "name": "Dana Ruiz",
  "email": "dana@example.com",
  "phone": "361 555 0100",
  "company": "Ruiz Roofing",
  "city": "Corpus Christi",
  "service": "Windstorm WPI-8",
  "message": "Needs a WPI-8 on a re-roof, insurer is asking for it by the 20th.",
  "landingPath": "/windstorm",
  "referrer": "https://www.google.com/",
  "userAgent": "…",
  "utmSource": "google",
  "utmMedium": "organic",
  "utmCampaign": "…"
}
```

**There is no field for which brand this is, and adding one would not work.**
The brand is read off the key. A body carrying `"site": "254"` changes nothing:
the row is written as the brand whose key signed the request, and the audit
asserts exactly that case by sending it.

### What comes back

| Status | Body | What it means |
| --- | --- | --- |
| 200 | `{ ok: true, id, duplicate: false, site }` | Written. The operator has it. |
| 200 | `{ ok: true, id, duplicate: true, site }` | An identical submission inside ten minutes. The first one stands; no second notification was sent. |
| 400 | `{ ok: false, error }` | The submission is not a lead. The error says which part. Do not retry unchanged. |
| 401 | `{ ok: false, error }` | The key is not one. Do not retry. |
| 404 | `{ ok: false }` | No key is configured on the receiving deployment. Indistinguishable from a route that does not exist, deliberately. |
| 429 | `{ ok: false, error }` | More than twenty in a minute from this brand. Nothing was saved. Back off and retry. |
| 503 | `{ ok: false, error, emailed, retry, contact }` | The write failed. **Read `emailed`.** |

### The 503 is the one to implement carefully

`emailed: true` means the enquiry reached the operator's inbox even though no
row was written. A person has it. Do not lose it, and do not present the visitor
with a failure.

`emailed: false` with `retry: true` means nothing left this platform. Retry, and
if it keeps failing, put the enquiry in front of a human by whatever means that
site has, using the `contact` address in the response.

The reason for answering a failure honestly here, rather than the reassuring
success 254's own forms give a person, is that **the caller is a server**. A
person told "we have it" is being reassured; a server told that stops retrying
and drops the enquiry it is holding.

---

## The key

One per brand, set as an environment variable **on this deployment**, and given
to the sister to put in its own:

| Brand | Variable here | The sister sends it as |
| --- | --- | --- |
| Sealed Engineering | `INTAKE_KEY_SEALED` | `x-intake-key` |
| StampMyPlans | `INTAKE_KEY_STAMP` | `x-intake-key` |

At least 24 characters. Anything shorter authenticates nobody, so a placeholder
somebody types while wiring it up cannot accidentally work. Comparison is
constant time over a hash, and every configured key is checked even after a
match, so the timing does not say which brand hit.

Rotating a key is: set the new value here, redeploy, set it there, redeploy.
There is no revocation screen and there is deliberately no table of keys: there
are two callers, and a table would buy revocation without a deploy at the price
of a migration, an admin surface and another thing to misconfigure.

**Production and Preview keys are the operator's to set.** Development has its
own in `.env.local`, which is what lets `sister-intake-audit` exercise the real
write path rather than reasoning about it.

---

## What the sister has to change

1. **Stop writing `eng_leads`.** Whatever posts the contact and waitlist forms
   should POST here instead.
2. **Delete the Supabase credentials** from that deployment once the posts are
   landing: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. That is the point of
   the exercise. A deployment that no longer needs a database master key should
   not hold one.
3. **Keep the honest failure states.** The site's own form must not tell a
   visitor their enquiry was received when this endpoint said 503 with
   `emailed: false`.
4. **Do not retry a 400 or a 401 unchanged.** Both are refusals about the
   request rather than about the moment.

Once (1) and (2) are done, that sister is no longer part of the cutover window.
It writes nothing to the shared project, so 254 can move databases without it.

---

## What it does not do, and will not

- **It does not take orders.** `form` is `contact` or `waitlist`. An order is a
  different act with a payment attached, and the ordering API is keyed per
  customer account rather than per brand.
- **It does not read anything.** There is no GET half. A GET is a 405.
- **It does not accept a brand from the caller.** See above.
- **It does not deduplicate across brands.** The same words from two sites are
  two enquiries, because they are two businesses' customers.

---

## How it is verified

`scripts/sister-intake-audit.mjs`, in the suite. Thirty two checks: the key
resolution and its refusals as pure functions, what counts as a lead, the dedupe
fingerprint, and then the live path end to end against a running server, which
posts a real lead with a body claiming the wrong brand, reads the row back out
of the database, retries it, and removes the probe rows afterwards with the
removal verified.

The security model was injected: a route that trusted the body was caught, and
the injection also showed why the row is read rather than the response believed.
The endpoint answered "sealed" while writing "254", so the check that reads the
database failed and the check that read the answer passed. There is now a check
that the two agree.
