# Finding: where a partner appears with or under a 254 mark

Operator ruling of 2026-10-15, recorded as a standing direction: **partners do
not operate under any 254 mark. A partner sells under its own business name
only.** Every partner-facing and customer-facing surface shows the partner's own
name and logo, plus the disclosure that engineering is performed and sealed by
254 Engineering LLC, Firm F-29811. The name and number come from the register
(`firmName()`, `registrationLine()`), never typed.

**Findings only; nothing changed.** Read from main at 828939f. The inventory was
gathered by a read-only search, then the load-bearing lines were re-read in the
source before being written here. The live partner asset register and the
partner agreements are database rows, and only their seeded demonstration text
is in the repository. What production holds was not read.

## The short answer

No surface puts a partner's name inside a 254 mark, such as "X 254 Partners".
What exists is **the partner shown inside 254's frame**: 254's wordmark heads
the page and the partner's name sits in the text. The partner's own logo is
shown to no customer anywhere. Five places are built for co-branding, which the
ruling rules out.

Two shared pieces carry most of the disclosure today:

- `performingFirmLine()` (`src/lib/partner-copy.ts:179-190`) derives the firm
  name. While the firm is not open it reads "... is the firm of record for work
  referred through this program, and is the firm that will perform and seal it."
- `registrationStatement()` (`src/lib/launch.ts:1074`) reads "254 Engineering
  LLC is a Texas registered engineering firm, TBPELS Firm Registration F-29811."

Both already say who performs and seals the work, and both are derived. Under
the ruling they stay, with the partner's own identity put first.

## Surface by surface

### 1. The partner order page, `/order/referred/[code]`

`src/app/(order)/order/referred/[code]/page.tsx`, inside the order layout
`src/app/(order)/layout.tsx`.

| Element | Today | Under the ruling |
| --- | --- | --- |
| Browser title (:41) | "Referred by {organisation} \| 254 Engineering" | The partner's own name. The 254 brand as a page suffix is a 254 mark heading the partner's page |
| Header (layout :42) | 254 `Wordmark` at 84px, linking to 254's home | The partner's name and approved logo. 254 appears only in the disclosure |
| Eyebrow and H1 (:67, :69) | "Referred by {organisation}"; "Engineering work, referred by {organisation}" | The partner's name stays. The H1 can be read as the partner supplying engineering work (see the copy section) |
| Partner logo | **Not rendered.** The page has no logo reference at all | Rendered, once approved |
| Disclosure (:72, per line :96, footer) | `performingFirmLine()`; `partnerAttributionLine()` per line, e.g. "Roof certifications by 254 Engineering, TBPELS Firm F-29811"; `registrationLine()` in the footer | "Engineering is performed and sealed by 254 Engineering LLC, Firm F-29811", derived. The per-line attribution uses the brand "254 Engineering" rather than the registrant |

The steps after it (`/order/start/[slug]`, `/order/[reference]`) use the same
254 chrome, title "... | 254 Engineering", and do not show the partner at all.
Under the ruling, whether a customer who arrived through a partner should stay
in the partner's frame through checkout is a question for you (question 2).

### 2. The partner portal, `src/app/partner/**`

| Screen | Today | Under the ruling |
| --- | --- | --- |
| Every tab title (`partner/layout.tsx:10`) | "Referral partners \| 254 Engineering" | The portal is 254's own tool for its partners, not a surface the partner sells under, so a 254 title here is not the partner operating under a 254 mark. Recorded for your ruling (question 3) |
| App shell (`partner/(app)/layout.tsx`) | Partner organisation name and "Referral partner" in the header (:74, :79); `performingFirmLine()` (:122) and a 20px 254 `Wordmark` (:125) in the footer | Same reading as the title |
| Sign-in and set password | 254 `Wordmark` (:41, :44), `performingFirmLine()` | Same reading |
| Overview, "Your logo" panel (`(app)/page.tsx:155`) | "It shows on your order page beside the firm's name once the firm approves it." | **False today, whatever the ruling**: the order page never renders the logo. Under the ruling it shows as the partner's own mark, not beside 254's |
| Materials (`(app)/materials/page.tsx:75-78`) | Panel "The line that goes on everything", carrying `performingFirmLine()` | Becomes the required disclosure line, derived |
| Materials, submit form (`SubmitForm.tsx:79`) | Option "Artwork carrying both marks" | Co-branding. Removed or reworded to the partner's own artwork |

### 3. Partner emails

**None exist.** No template in `src/lib/email-templates.ts` names a partner. The
partner set-password link is delivered by hand (`ops-partners-admin.ts:470,
:480`). Customer emails for an order that came through a partner do not mention
the partner, and carry 254's sender and footer as every order email does.

### 4. Receipts and Stripe

| Item | Today | Under the ruling |
| --- | --- | --- |
| `src/config/partner-billing.ts:40` `productName` | "254 Engineering partner program". **Nothing reads it** (one occurrence in `src`). Billing is disabled | Your ruling 6 of the same day: receipt name "254 Partners", on Craftline Brands LLC's own Stripe account. Held, as ordered |
| Labels sent to Stripe (`partner-billing-rules.ts:250, :258`) | "Partner program, monthly", "Partner program setup" | No 254 mark today |
| `docs/partner-billing-plan.md:47, :123-128` | Plans one Stripe Product "254 Engineering partner program" and partner receipts reading "254 Engineering" | Superseded by ruling 6; the plan doc is stale |
| Account settings (`src/config/stripe-console.ts:191-193`) | 254's account: legal name 254 Engineering LLC, public name "254 Engineering", descriptor "254 ENGINEERING" | Correct for the firm's own customers, including a partner's customer: the customer is paying the firm. Partner billing moves off this account under ruling 6 |

### 5. The partner logo upload

`src/lib/partner-branding.ts`, `src/app/api/partner/branding/route.ts`,
`partner/(app)/LogoUpload.tsx`: PNG, JPEG or WebP, approved or refused by the
firm. It is rendered only on the partner overview and the staff partner detail
(`portal/(app)/partners/[id]/page.tsx:50`). **No customer sees it.** Under the
ruling it is the partner's mark on the order page.

### 6. The partner assets register

The table is `supabase/migrations/0020_partner_assets.sql`, with code in
`src/lib/ops-partner-assets.ts`. The content is database rows; the repository
holds only the demonstration seed in `scripts/seed-field-demo.mjs`.

| Item | Today | Under the ruling |
| --- | --- | --- |
| Asset kind `logo` (0020:47) | Defined as "the firm's mark, for co branded material": 254's mark handed to partners | Co-branding. The kind would describe the partner's own artwork, or the firm's mark is not distributed |
| Seeded "Who performs the work" (seed :1328-1335) | "...will be carried out by 254 Engineering Services, a Texas firm serving all 254 counties. They contract with the client, hold the engagement, and are the firm of record on every deliverable." plus `registrationStatement()` | The disclosure, with the registrant's name derived. "254 Engineering Services" is the DBA typed by hand. This is defect 14, already ruled for re-approval |
| Seeded "What a referral is, in an email" (seed :1339-1345) | "I have sent your details to 254 Engineering Services, who will contact you directly. They handle the engagement and the engineering from here..." | Right about who performs. Names the firm by DBA, typed |

### 7. Agreement and training

The agreement text is a database row (`eng_partner_agreements`) rendered at
`partner/(app)/agreement/page.tsx:79-82`. The seeded text (seed :1194-1195,
:1204-1205) says "Demo Title Partners refers clients to 254 Engineering
Services. 254 Engineering Services will perform and seal the work..." and "The
partner may use approved marketing material carrying both marks. The partner
may not describe itself as an engineering firm, offer engineering services, or
hold itself out as performing engineering work." The first clause is
co-branding and the second is the rule this ruling relies on. The real agreement
is with counsel. No training copy exists in `src`.

### 8. A public partner program page

**None exists.** The public site only captures a referral code
(`(site)/layout.tsx:61`, the "Referral code" field at `OrderFlow.tsx:568`).
`docs/partner-program-decision.md:16-21` still records the model this ruling
overturns: "The partner promotes 254 Engineering Services under 254's name" and
"a partner facing landing page may carry the partner's logo alongside 254's".
Migration 0013:16-17 describes "referral with constrained co branding". Both are
records of an earlier decision and would carry a supersession note.

## Copy that says or could imply the partner performs engineering

1. **Partner copy checking loosens at trading** (`src/lib/partner-copy.ts:130-145`,
   `scripts/lib/regulatory.mjs:333-336`). `copyVerdict` applies
   `TRADING_GATED`, which carries `we (offer|provide|perform|deliver|issue|inspect|certify)`,
   only `if (!isTrading())`. The comment's reasoning is that "a partner writing
   'we provide' of that firm is stating a fact". Under the ruling, a partner's
   "we" is the partner's own business, so once the firm is trading, partner copy
   reading "we provide engineering" or "we perform inspections" passes. Only
   "we seal" stays blocked until sealing is available. **This is the clearest
   gap.** Partner submissions are accepted for review (`ops-partner-assets.ts:27`),
   so a person still reads each one, but the check no longer helps them.
2. **The order page H1** (`order/referred/[code]/page.tsx:69`), "Engineering
   work, referred by {organisation}". The partner is named as the referrer, but
   the phrase can be read as the partner supplying engineering work. An
   inferred risk, not a statement.
3. **Materials, "What approval does and does not do"**
   (`materials/page.tsx:201-203`): "Using it as written means you are not making
   a claim the firm could not make itself". It measures a partner's claim against
   what the FIRM may say, which invites a partner to make the firm's claims,
   engineering included. An inferred reading.

Checked and found right: the overview's "An entry appears here when the firm
delivers work you referred" (`(app)/page.tsx:225`); the set-password restricted
note ("Nothing can be sealed until an engineer of record is in responsible
charge..."); and the seeded email snippet, which says the firm handles "the
engineering from here".

## Questions for a ruling

1. Partner copy: should `copyVerdict` refuse partner-voice claims of performing
   engineering ("we provide", "we perform", "we inspect") at every stage, not
   only before trading? Recommended yes, with the injection the ruling pattern
   needs.
2. A customer who arrives through a partner: does the partner's frame continue
   through checkout and the order status page, or only on the referral page?
   Recommended: the referral page carries the partner's name and logo and the
   disclosure; checkout and the order status page stay the firm's, because the
   customer contracts and pays the firm.
3. The partner portal is the firm's tool for its partners. May it keep 254's
   title and wordmark? Recommended yes: the partner does not sell under it.
4. Co-branding (the "both marks" artwork option, the `logo` asset kind, the
   agreement clause, the overview promise): remove or reword each to the
   partner's own artwork. Recommended yes, one branch, after counsel has the
   agreement.
