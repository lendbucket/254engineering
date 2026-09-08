# Multi factor authentication: the design, and the decisions inside it

**Phase 12 Section 1. Written 2026-09-07, before the build.**

The prototype's sign in screen promised MFA and the platform did not have it.
That promise was removed as a false claim during the design port, which was
right. This makes it true instead.

Two operator rulings were taken before anything was written, because the brief
asks for both rather than letting a session decide them:

| Question | Ruling, 2026-09-07 |
| --- | --- |
| Is MFA required on the engineer role? | **Required**, superseded the same day. Section 5. |
| What is the break glass path? | **A one time environment variable reset.** |

Both are argued in sections 5 and 6 below, including what they cost.

---

## 1. TOTP, and what is deliberately absent

**TOTP, not SMS.** SMS is phishable, it puts a vendor in the authentication
path, and it costs money per message. An authenticator app is what a buyer
expects and what an auditor asks about.

**The parameters are the boring ones on purpose:** SHA1, six digits, a thirty
second period. Not because they are the strongest available, but because they
are what every authenticator app implements without configuration. A platform
that picks SHA256 and eight digits is a platform whose enrolment screen
sometimes produces codes that do not work, on a device the firm cannot debug.

**A one step drift window, so a code is accepted for the period before and the
period after.** Clocks disagree. A zero drift implementation rejects perhaps a
tenth of honest attempts, which teaches people to distrust the mechanism, and
this only widens the guess space from one code to three.

**What is absent, and it is absent on purpose.** No SMS fallback, no email
fallback, no "trust this device for thirty days", and no push approval. Each of
those is a second authentication path, and a second path is the one an attacker
uses. Recovery codes are the only alternative route and they are covered in
section 4.

---

## 2. The session boundary, which is where the brief puts the enforcement

> Enforced at the session boundary, not at the screen. A session that has not
> satisfied the second factor is not a session.

**That sentence is implemented literally rather than approximately**, and it is
the most important decision in this document.

The cookie gains a factor field. A password alone mints a **pending** session; a
verified code mints a **full** one. Then:

- `readOpsSession` returns a session **only for a full one.** A pending cookie
  reads as null, exactly like a forged one or an expired one.
- `readPendingSession` is a separate function, and the only things that call it
  are the challenge screen and the endpoint that verifies a code.

**Why that shape.** Every existing caller of `readOpsSession` refuses a pending
session with no change to itself: the proxy over every portal route, and
`currentActor` behind every server action and route handler. There is no list of
protected routes to keep in step with a list of MFA exempt ones, because there is
no such list. A route added tomorrow is covered by construction.

The alternative, a boolean on the actor that each screen checks, is the shape
this repository has been finding defects in all week. It would work everywhere
somebody remembered it and nowhere else, and the failure would be silent.

**The audit does the negative half rather than trusting the argument.** It takes
a pending session and attempts **every portal route the surface inventory
declares**, page and API, and requires refusal from all of them. The inventory
is `scripts/lib/surfaces.mjs`, which exists so that a route added without being
declared fails a check, so this cannot quietly stop covering new screens.

**The cookie format changes, so every current session ends at deploy.** Four
segments become five, and a four segment cookie is refused rather than assumed
to be pre MFA and let through. Anything else would be a downgrade attack: strip
the factor field and be treated as legacy. Everyone signs in again once, which
is the correct price.

---

## 3. Enrolment, and the ordering that prevents a lockout

The brief's item 2 asks for a QR code and a secret shown once, **verified by a
code before it is stored**, so an unverified secret can never lock somebody out.

The order matters and is worth writing down, because the obvious order is wrong:

1. Generate a secret. **Hold it in the pending enrolment row, not as the active
   one.**
2. Show the QR code and the secret text, once.
3. The person enters a code from their app.
4. **Only if it verifies** does the enrolment become active.

The wrong order stores the secret first and then asks for confirmation. A person
who scans nothing, or scans it into an app on a phone they then lose, is locked
out of an account that now demands a factor they never had.

**The secret is shown as text beside the QR code**, because a QR code cannot be
entered by hand and somebody setting up a desktop authenticator has no camera
pointed at their own screen.

**Recovery codes are generated at the same moment as step 4**, not later, and
the screen that shows them is the same one that confirms enrolment. Enrolment
completing without recovery codes existing is the state that turns a lost phone
into a lost account.

### The secret at rest

**Encrypted, with `MFA_ENCRYPTION_KEY`, and the reasoning is worth stating
because the easy answer is that it does not matter.**

The easy answer: anybody holding the service role key can already read every
table and create an administrator, so encrypting one column protects nothing.
That is true of an attacker with the live key and false of the case that
actually happens, which is a database copy separated from the environment that
produced it. A backup, an export, a snapshot handed to somebody for debugging.
The key lives in Vercel and the rows live in Postgres, so a copy of one without
the other is inert.

**The cost is a new way to be locked out, and it is not hidden.** A missing or
changed key means no code can be verified. So it fails closed and loudly, in the
same shape `OPS_SESSION_SECRET` already uses: `mfaStatus()` says exactly what is
wrong, the sign in screen says it plainly rather than rejecting codes as if they
were wrong, and the operator status surface reports it. **Rotating that key
un-enrols everybody**, which is a real operation with a real consequence, and it
is written down here rather than discovered.

---

## 4. Recovery codes

Ten codes, generated at enrolment, shown once, **stored hashed**, single use,
and counted so a person can see how many remain.

- **Hashed, with the same function the platform already uses for passwords.**
  A recovery code is a credential; a table of them in plaintext is a table of
  passwords.
- **Single use, enforced by marking the row rather than by deleting it**, so the
  audit trail can say which code was used and when. A deleted row is a fact
  nobody can produce afterwards.
- **The remaining count is visible on the account screen**, because the useful
  moment to notice you have two left is before you need the last one.
- **Regenerating replaces all ten and invalidates the old set.** A partial
  regeneration would mean two live sets and no clear answer to how many codes
  exist.

---

## 5. The per role setting, and the engineer ruling

`eng_roles` gains a requirement column: **required, optional, or off.**

| Role | Requirement | Why |
| --- | --- | --- |
| `admin` | optional | Required in 0024. **Operator ruling, 2026-09-07**, applied by 0025. |
| `engineer` | optional | Required in 0024. The same ruling and the same migration. |
| everything else | optional | Enrolment is offered, not compelled. |

**THE DEFAULT IS AN OFFER AND THE REQUIREMENT IS STILL THERE.** The ruling
argued below was made and then reconsidered within the day, and both halves are
kept for the reason CLAUDE.md keeps the Newsreader ruling: a decision that
vanishes without a trace looks like a decision nobody made.

What changed is which roles are set, not what the setting does. A role moved
back to `required` gets exactly the enforcement argued for below, and
`mfa-audit` proves that on every run by creating a role that requires a factor,
signing an account in under it, and requiring the portal to refuse it. The firm
will want this on before it holds real client data, and the point of doing this
as two rows rather than by deleting the mechanism is that turning it back on is
one update rather than a rebuild under pressure.

What somebody on an optional role meets instead: the enrolment screen, reached
with a FULL session and carrying a Not now link, so the offer is in front of
them every time they sign in without a factor and never blocks them. The full
session is deliberate. The alternative, a pending session plus a button that
promotes it, would mean building the one endpoint in this flow worth attacking:
an endpoint whose whole job is upgrading a half authenticated cookie. Nothing
is withheld from somebody whose role does not require a factor, so declining is
navigation rather than a privilege change.

**Somebody who already has a factor is still challenged for it**, whatever
their role now says. The sign in path checks enrolment before it reads the
requirement, and that order is load bearing: reversed, editing a role would
become a way to switch off somebody else's second factor.

**The engineer ruling, and what it costs.** That role carries the licence.
`holdsLicence` compares against it, and its holder is the person whose seal and
signature go on work the firm delivers. A compromised engineer account is not a
data breach, it is a regulatory event: somebody else acting inside the account of
a named Professional Engineer, on the firm's regulatory record.

The cost is real and is stated rather than minimised. **A PE cannot review
anything until they have an authenticator app and their recovery codes.** That is
friction at exactly the moment somebody is trying to start work, and it falls on
the one person the firm most needs to be able to work. The operator weighed that
and chose required, then weighed the same cost against an empty room and chose
the offer. Nobody holds client data yet, so the wall was being paid for in full
and protecting nothing. That calculation reverses the moment the first real
client record lands, and the reversal is one update.

**A role set to required affects people who have not enrolled**, so the
requirement cannot simply lock them out. A person in that position signs in with
their password, is not given a session, and is sent to enrolment: they can enrol
and nothing else. That is the only route through, and it is the same pending
session the challenge uses, so it inherits the same enforcement.

**Changing this setting is an access change and writes the audit trail**, like
every other change on the roles screen. Turning MFA off for a role is the single
most consequential edit that screen can make.

---

## 6. Break glass, which is a decision rather than an oversight

**The question:** the operator loses their second factor and their recovery
codes. What happens?

**The ruling, 2026-09-07: a one time environment variable reset.**

Setting `MFA_BREAK_GLASS` in the Vercel Production scope to a value naming one
account and a one time token lets that account clear its own second factor on
its next sign in, after its password. The operator then removes the variable.

**Why this one.** Recovery requires access to the Vercel account, which is a
second credential the operator already holds and an attacker with a stolen
password does not. It adds no permanent bypass to the product, needs no second
administrator to exist, and it is deliberately slow: it requires a deploy,
because a deployment's environment is snapshotted at creation.

**What it costs, stated plainly.**

- **While it is set, it is a live bypass.** So the value is single use, the
  account is named in it rather than the variable applying to anybody, using it
  clears the enrolment and forces re-enrolment, and **the operator status
  surface reports loudly while the variable is present.** A break glass left set
  is the hazard, and it is made visible rather than trusted to be tidied.
- **It does not survive losing Vercel too.** If both the second factor and the
  Vercel account are gone, the firm is locked out and recovery is a database
  statement run by whoever holds the service role key. That is written into the
  runbook at `docs/disaster-recovery.md` rather than left to be worked out.

**The three that were rejected, because the reasons are what make this one
right:**

1. **No break glass at all.** The strongest posture, and it makes a lost phone
   an unrecoverable incident for a firm with one administrator. Correct for a
   company with a security team, wrong for this one.
2. **A second administrator can clear it.** Practical and the common answer, and
   it means compromising any one administrator defeats MFA for all of them. It
   also does not help today: the firm has one administrator.
3. **Direct database surgery only, documented.** No new code and no bypass to
   abuse, which is genuinely attractive. It is what happens anyway when Vercel is
   gone too, so it is the fallback rather than the plan, and requiring the
   service role key for an ordinary lost phone puts the most powerful credential
   the firm has into a routine procedure.

---

## 7. What writes the audit trail

The brief's item 6, and one addition it implies.

- Enrolment completed
- Enrolment cleared by the person themselves
- **An administrator disabling somebody else's second factor**
- A recovery code used, and how many remain
- Recovery codes regenerated
- A role's requirement changed
- **The break glass being used**, which is the one nobody should ever see and
  everybody should be able to find

**An administrator disabling somebody else's second factor reads as the
privileged act it is**, naming both people, because it is the action an attacker
inside an administrator account would take first.

**Failed code attempts are rate limited and are not each an audit row.** They go
through the existing limiter, in **a separate bucket from sign in**, for the
reason recorded in the account creation scoping: a shared bucket lets somebody
lock a real person out of signing in by hammering the other path with their
address.

---

## 8. What this section does not build

- **No SSO.** Ruled out by the operator.
- **No WebAuthn or passkeys.** A better factor and a larger surface, and TOTP is
  what the brief asks for and what a buyer's questionnaire names.
- **No MFA on the customer or partner portals.** Different principals, different
  cookies, and neither can move money or change permissions. Recorded in
  `BACKLOG.md` rather than assumed to be out of scope forever.
- **No device trust or remembered browsers**, for the reason in section 1.
