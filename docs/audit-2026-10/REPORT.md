# Product audit, October 2026

Report only. Nothing here changes the product; findings are ranked
blocks-launch, before-the-20th, or later, and a decision with two reasonable
answers goes on the decisions list rather than being taken.

Started 2026-10-09 after main reached 804fc29 with the not-yet-V10 list at
zero.

## Preflight: nothing this audit does can reach a real person or a real service

### What the operator's counterpart read on the development database

- No edge functions.
- No `pg_net` or `http` extension.
- No database function or trigger that makes an outbound call.

So the one remaining outbound path from development is **Supabase Auth's own
email**: password reset, confirmation and magic link.

### The rules this audit follows for Supabase Auth (operator, 2026-10-09)

- Every auth test, every brute force attempt and every seeded account uses
  only `@audit-probe.invalid` addresses.
- No reset, confirmation or link is ever triggered for any real address that
  exists in development, including robertreyna88@yahoo.com and ceo@36west.org.
- Seeded users are created through the admin API with the email already
  confirmed (`email_confirm: true`), so no confirmation mail is queued.

### What the code can make Supabase Auth send: nothing

Read from the source on 2026-10-09, every call into Supabase Auth:

| Call | Where | Sends mail? |
| --- | --- | --- |
| `auth.signInWithPassword` | `src/lib/ops-auth.ts` (sign in, and re-checking a current password) | No |
| `auth.admin.createUser` | `src/lib/ops-auth.ts`, with `email_confirm: true` | No |
| `auth.admin.updateUserById` | `src/lib/ops-auth.ts` (password set by the platform) | No |
| `auth.admin.listUsers`, `deleteUser` | `src/lib/ops-auth.ts` | No |
| `auth.admin.createUser` | `scripts/lib/portal-probe.mjs`, with `email_confirm: true` | No |

No call to `resetPasswordForEmail`, `signInWithOtp`, `signUp`,
`inviteUserByEmail`, `generateLink` or `resend` exists anywhere in `src/` or
`scripts/`. Staff password resets and customer links are the platform's own
tokens, sent through its own email path, below.

### The process.env scan: every name the application reads

Derived from the source, not listed by hand: `process.env.X`,
`process.env["X"]`, a local `env("X")` helper, and a constant handed to
`process.env[...]`, across the 488 files of `src/` and `data/`. 36 names.
Cross-checked against `src/config/credential-inventory.ts`, the declaration
`soc2-audit` keeps in step with the environment files. Whether development's
`.env.local` sets each was read by NAME ONLY; no value was read into any
output.

Names that can reach an outside service:

| Name | Set in development | What it would reach |
| --- | --- | --- |
| `RESEND_API_KEY` | **no** | email (Resend). Unset, the platform logs `[notify] skipped ... RESEND_API_KEY is not set` and sends nothing; seen in the board's own server log |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **no** | Stripe. Unset, no charge or refund can be made |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `*_RELEASE` | **no** | error telemetry |
| `CRON_SECRET` | **no** | the scheduled routes' bearer; not outbound |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | the **development** project, which `scripts/lib/db-target.mjs` refuses to swap for production without `ALLOW_PRODUCTION_DB=1` |
| `NEXT_PUBLIC_SITE_URL` | yes | the site's own origin, for links in messages that are not sent |

**SMS and Checkr: no path exists.** No Twilio, SMS or Checkr name appears in
the source or in the credential declaration; neither integration is built.

`ALLOW_REAL_EMAIL_SENDS` is declared and read by nothing in the source; it is
unset.

### Process

The scan script, the auth call list and the env names were each re-derived on
the day rather than copied from an earlier note. A later change that adds an
outbound integration adds a name the scan would show.
