# Roofer partner sign up, account first: the walk, 2026-11-06

Robert's rework of 2026-11-06, item 6, with his answers 1 to 4. Question 5 (the set password rule, kept) was answered as relayed by the chat counterpart in 6694338950; that is also how the code already behaves.

**What was walked:**
- **The build:** `feat/roofer-account-first` at `0bc2ed6`, a local production build with webpack, served on port 3344, pointed at development. 0117 was on development since 20:07 UTC (6694338950).
- **LAUNCH_MODE=live was set for this local process only**, at build and at start. It is the operator's switch, and production runs live. On this machine's development environment it is the only unmet launch condition, so without it door 1 reads shut and step one shows the closed sentence. No file was changed for it.
- **The address:** `support+roofer-test-2@wattsmithelectric.com`.
  - A first run used test-1. That address still holds the account from the 2026-11-05 walk, so its step one took the existing address path, exactly as designed: the same answer, a fresh link queued (`account.welcome`), and no application attached.
  - That job (45968) was removed and read back gone before the rerun.
- **The walk's emails:** read from the queue and rendered. Delivery was not tested, under standing rule 3. The logo shows as a broken image only because each message was opened as a local file.

| Shot | What it shows |
| --- | --- |
| 01-landing (390, 1280) | `/roofing-partners`: "Become a 254 roofing partner", "Create your partner account", the three steps |
| 02-step-one (390, 1280) | `/roofing-partners/apply`: four fields, "Step 1 of 3", the contact box with Robert's phone, email and Book a call |
| 03-step-one-filled-390 | Step one on a phone, filled |
| 04-check-your-email (390, 1280) | Step two, "Check your email", with Robert's booking line |
| 05-email-step-one (390, 1280) | The step one email: the account open, and the button that sets the password |
| 06-set-password-390 | The link opened on the phone |
| 07-sign-in-390 | Sign in once, under the set password rule |
| 08-account-status-card-390 | `/account`: "Your partner account is being reviewed. Finish your profile to speed it up.", 0 of 3 |
| 09-work-saved-390, 10-insurance-saved-390 | Each section saved on its own, the certificate uploaded |
| 11-profile-complete-390 | "Profile complete", every section Done |
| 12-admin-home (390, 1280) | A probe admin's home |
| 13-review-list (390, 1280) | The review list with the Profile column, "Profile complete" |
| 14-review-account (390, 1280) | The account under review, with every answer and the certificate |
| 15-approved (390, 1280) | After "Approve the partner account", with a written reason |
| 16-account-approved-390 | The roofer's card after approval: approved, Robert in touch about partner pricing |
| 17-email-approved (390, 1280) | The approval email: "Hi Walk", the welcome, no password link |

**Read back on development:**
- step one wrote the application, with the account `d8185842` and a roofer prospect carrying a due now `review_application`;
- each section stamped its done time, and the certificate sits under the application's own prefix;
- the approval named the account it already had, with the reason.

**Torn down and read back:**
- the account superseded, as probe accounts are; its customer user stays on it, as with the 2026-11-05 walk;
- the certificate removed;
- the prospect removed, its application and source cascading: 0 applications left;
- the walk's three email jobs removed;
- the probe admin removed: 0 left.

**Seen in these shots and fixed after them:** on the Insurance section the "Next" link pointed back to "Your work". It now goes forward to the next unfinished section, wrapping only after the last. The walk was taken before that fix, so 08 shows the old link.
