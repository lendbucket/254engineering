# The roofer application walk, 2026-11-05

Run on a local production build of `feat/roofer-application` (webpack, `next start` on port 3311) pointed at development, as Robert ruled (3a). Two test applications from support+roofer-test-1@ and support+roofer-test-2@wattsmithelectric.com, and a probe admin from the existing probe helper (3b, 3c). All test records were removed afterwards and read back (day-queue, bundle 108). The copy shows the gate state that build's environment reads. Each step is at 390 and 1280 unless noted.

| File | What it shows |
| --- | --- |
| `01-page-390.png`, `01-page-1280.png` | `/roofing-partners`: the hero, the services strip, the partner account, how approval works, what the firm looks for, the closing band |
| `02-form-empty-390.png`, `02-form-empty-1280.png` | `/roofing-partners/apply`: step 1 of 3, empty |
| `03-form-step1-390.png` | Step 1 filled on a phone: the company, the owner, email, phone, office city |
| `04-form-step2-390.png` | Step 2 on a phone: counties by type-ahead with region shortcuts, crews, roofs a year, the work mix, services, monthly volume |
| `05-form-step3-390.png` | Step 3 on a phone: general liability, the certificate attached, two references |
| `06-confirmation-390.png`, `06-confirmation-1280.png` | `/roofing-partners/apply/received`: what happens next |
| `07-admin-home-390.png`, `07-admin-home-1280.png` | The admin home: "Roofer applications to review: 2" in work due now, and the two roofer prospects in follow-ups due |
| `08-review-list-390.png`, `08-review-list-1280.png` | `/portal/roofer-applications`: both applications waiting for a decision |
| `09-review-application-1-390.png`, `09-review-application-1-1280.png` | Application 1: every answer, the certificate link, dialable references, Print, the reason box with approve and decline |
| `10-approved-390.png`, `10-approved-1280.png` | Application 1 after approval: the decision, who, when and the reason, and the account opened through door 2 |
| `12-review-list-after-390.png`, `12-review-list-after-1280.png` | The list after the decisions: one approved, one declined |
| `13-email-approved-390.png`, `13-email-approved-1280.png` | The approval email (`roofer.approved`) with the set password button, rendered from its queued HTML |
| `14-email-declined-390.png`, `14-email-declined-1280.png` | The decline email (`roofer.declined`), plain and carrying no reason, rendered from its queued HTML |

**Delivery was not tested** (Robert's rule 3): this PC holds no Resend key. Both emails are shown as queued.
