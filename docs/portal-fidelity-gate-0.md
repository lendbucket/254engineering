# Why the portal design port reported itself finished

Phase 11 Section 0. Recorded 2026-09-05, before any of the three fixes.

The operator looked at the shipped portal and reported three things: the set
password screen barely shows the logo, the portal on a phone feels like a
desktop site, and the messaging centre is not enterprise grade. This document
answers only the first question the brief asks, which is why the existing checks
said otherwise.

The short answer is that nothing ever looked at those screens. Not "looked and
judged them acceptable". Looked.

---

## 1. Which routes were in scope, and which were never in the list

`docs/portal-design-port.md` defines its own scope in section 2: **"23 screens.
Routes are under `/portal` unless stated."** That inventory is taken from
`design-reference/portal/254 Portal v2.dc.html`, and the port worked through it
screen by screen.

The prototype draws **Sign in** and a **Forgot** affordance. It does not draw a
set password screen, a suspended state, or an invited state. Searching the
prototype for those screens returns nothing.

So the port's scope was the artifact's scope, and the artifact does not draw the
screens a person meets before they hold a session, apart from sign in.

**The port document, 286 lines, does not contain the strings "set password",
"suspended", "invited" or "restricted" anywhere.** Not as deferred work, not as
out of scope, not as a known gap. They are absent, because they were never
enumerated to be absent from.

| Pre-session surface | Route | In the port inventory | Ported |
| --- | --- | --- | --- |
| Sign in | `/portal/login` | Yes, screen 1 | Yes, deliberately and at length |
| Sign in, suspended | `/portal/login?suspended=1` | No | Inherited from sign in |
| Sign in, after reset | `/portal/login?reset=1` | No | Inherited from sign in |
| Restricted mode notice | on sign in | No | Inherited from sign in |
| Set password, valid link | `/portal/set-password?token=` | No | **No** |
| Set password, dead link | `/portal/set-password` | No | **No** |

The sign in page carries a header comment explaining what was changed and what
deliberately was not, including why the prototype's MFA sentence was dropped.
The set password page carries no such comment, because nobody was working from a
reference when it was written.

### Where the audits actually look

This is the part that matters more than the port's scope, because an audit is
supposed to catch what a workstream misses.

| Audit | Portal routes it visits |
| --- | --- |
| `contrast-audit` | **none.** 17 public marketing routes |
| `mobile-audit` | **none.** 14 public marketing routes |
| `forms-audit` | **none.** `/contact` and `/api/lead` |
| `seo-audit` | none, correctly: the portal is noindex |
| `mobile-overflow-audit` | all of them, at 360 and 390 |

`contrast-audit`'s green line reads "20 templates at 390 and 1280. ALL GREEN."
Those twenty templates are the public site. It has never measured a portal
screen. `forms-audit` claims "every input and state, no silent failures", and it
has never seen the sign in form or the set password form.

So the entire presentation of the operations platform was covered by exactly two
things: `token-audit`, which reads files, and `mobile-overflow-audit`, which
measures one property, horizontal scroll.

The set password screen is measured today for horizontal overflow and nothing
else.

---

## 2. The set password logo, measured

The operator says the logo is barely visible. It is, and the cause is one word.

```
login/page.tsx:63          <Wordmark height={44} priority />
set-password/page.tsx:31   <Wordmark onDark height={44} priority />
```

Both render inside `<main className="portal-surface ...">`, and
`.portal-surface` sets `background: var(--canvas)`, which is `#f4f5f7`. So the
reverse lockup, which is white artwork, is being drawn on a near white ground.

`Wordmark.tsx` documents this exact outcome in its own header: "`logo-dark.png`
renders as almost nothing against a white background, which is expected and is
not a broken file: it is white artwork for dark surfaces."

Measured from the artwork rather than asserted. Every pixel at alpha >= 200 was
bucketed and composited against each ground:

| Asset | Dominant ink | Share of mark | vs `--canvas` #f4f5f7 | vs `--navy` #0f2240 |
| --- | --- | --- | --- | --- |
| `logo.png` | rgb(0,32,96) | 86.3% | **14.00:1** | 1.04:1 |
| `logo-dark.png` | rgb(255,255,255) | 92.0% | **1.10:1** | 16.01:1 |
| both | rgb(208,160,48) gold | ~6% | 2.20:1 | 6.62:1 |

Mean ink across the whole mark: `logo.png` **11.97:1** on canvas.
`logo-dark.png` **1.02:1** on canvas.

**92 percent of the mark on the set password screen is rendering at 1.10:1.**
What remains visible is the gold parallelogram and the gold rule at 2.20:1,
which is itself below AA and is the pairing the standing ruling forbids for
text. The descriptor line under the numerals disappears entirely.

Confirmed from the running application, not from the source: the served markup
on both set password states requests
`/_next/image?url=%2Fbrand%2Flogo-dark.png`, at 87 by 44, while all three sign in
states request `%2Fbrand%2Flogo.png` at the same size.

**This is the undeclared `--gold-wash` token again, in a different costume.** The
same shape: the right asset, the wrong ground, no check that compares the two,
and a result that reads as almost right so nobody stops on it. That defect class
has now appeared three times in this repository.

### Why contrast-audit could not have caught it even if it visited the route

Automated contrast tooling measures text nodes against their computed
background. A logo is an `<img>` with alt text. Axe does not measure whether the
pixels inside an image contrast with what is behind it, and no rule in
`contrast-audit` does either. Adding `/portal/set-password` to that audit's route
list would not have found this.

That is worth saying plainly, because "add the route to contrast-audit" is the
obvious fix and it is not sufficient.

### One further difference on the same screen

Sign in carries the restricted mode notice and the compliance footer. Set
password carries neither. The first thing a new Professional Engineer sees when
they set their password says nothing about the registration being pending. That
is a composition gap rather than a compliance breach, because the gate is
enforced in code regardless, but it is the wrong first impression.

---

## 3. What token compliance proves, and what would actually settle fidelity

`token-audit` passes 69 checks. What each one asserts is that **the files speak
the vocabulary**: the document and the token file define the same colours at the
same values, no component contains a raw hex, every font size and radius comes
from the scale, uppercase is applied by two named classes rather than by
`text-transform` scattered about, the italic face is loaded, numerals are
tabular.

That is a real and useful claim. It is also entirely a claim about **word
choice**, and the port reported it as though it settled **composition**. Those
are different claims. A screen can use every declared token correctly and be
laid out nothing like the design, and a screen can be laid out exactly like the
design while one asset on it is invisible, which is what happened.

Three things follow.

### What is mechanically assertable and is simply not asserted today

1. **Asset on ground.** The generalisation of this defect, and the one worth
   building. For every brand lockup rendered anywhere, compute the mean ink of
   the asset composited over the effective background behind it, and require at
   least 4.5:1. That is exactly the measurement in section 2 above, run as a
   check. It catches the reverse lockup on a light surface, the light lockup on
   navy, and any future asset added with the same mistake. It does not depend on
   anybody remembering which variant belongs where.
2. **Portal routes inside the presentation audits.** `contrast-audit` and
   `mobile-audit` visit no portal route at all. Every screen a signed in person
   uses is outside both. This is a coverage hole with no reasoning behind it,
   only history: the audits were written for the marketing site and the portal
   arrived later.
3. **Portal forms inside `forms-audit`.** The sign in form and the set password
   form are the two forms in this product whose failure is most expensive, and
   neither is exercised.
4. **Vertical fit on pre-session screens at 390.** Already measured while writing
   this: `/portal/login?suspended=1` overflows by 71px and
   `/portal/login?reset=1` by 25px at 390, so the compliance footer is cut off
   mid sentence in exactly the state a suspended person lands in. That is a
   assertable property and nothing asserts it.

### What is not mechanically assertable

Whether a screen is composed like the prototype. Whether the hierarchy reads.
Whether it feels like the application the operator would have paid for.

I am not going to propose a similarity score against the prototype HTML. It
would be a number that moves for reasons unrelated to quality, it would pass on
a screen that is wrong and fail on a screen that is deliberately different, and
the port document already establishes that the prototype is a design for a
smaller platform than the one that exists, so a large and correct divergence is
expected on most screens.

**The honest mechanism is a recorded per screen verdict**: a table of every
portal route with a screenshot at 390 and 1280, a verdict in the operator's
terms, and the date it was judged. It is refreshed when a screen changes. It is
judgment, it is recorded as judgment, and it does not pretend to be a
measurement. The value is that a screen nobody has ever judged is visible as a
blank row rather than as silence, which is precisely what would have caught the
set password screen: it would have had no row.

### What the port should have said

Not "the port is complete". It should have said: the 23 screens the prototype
draws have been ported, the platform has 28 routes the prototype does not draw,
and the pre-session surfaces other than sign in were never compared to anything.
That sentence was available at the time and would have been true.

---

## What this gate recommends

Section 1 as briefed, with one addition: build the asset-on-ground check first
and let it fail on the set password screen before the screen is fixed, so the
check is verified by the defect it was written for rather than by an injection
that imitates it.
