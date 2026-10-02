"use client";

import { useState } from "react";

/**
 * The self service sign up form.
 *
 * WHAT IT DOES NOT DO, AND THE ABSENCES ARE THE DESIGN
 * ----------------------------------------------------
 * No password field. A password typed here would have to be held somewhere
 * between this form and the address being proven, and the only honest places to
 * hold it are the session and the database, both of which mean this platform
 * stores a credential for an address nobody has shown they can open. The link
 * is where a password is chosen, on a screen reached only from that address.
 *
 * No "already have an account?" branch on the result. The server answers one
 * sentence whatever happened, and a form that rendered a different state for
 * the two cases would put the oracle back in the browser after the route was
 * careful to keep it out.
 *
 * THE RESULT REPLACES THE FORM RATHER THAN SITTING UNDER IT. A form still
 * standing after a successful submit invites a second submit, and the second
 * one is the request that gets rate limited.
 *
 * ===========================================================================
 * RESTYLED TO DESIGN V10, 2026-09-29. PRESENTATION ONLY.
 * ===========================================================================
 *
 * FOUR THINGS THE DESIGN DRAWS ARE NOT HERE, AND THE ABSENCES ARE DELIBERATE.
 * V10-signup shows a "who is ordering" radio group, a first and last name pair,
 * a password field, a terms checkbox and a text message opt in. Every one of
 * them is a field this platform does not collect, and the operator ruled on
 * 2026-09-29 that stage 1 is look only: where a design shows a step the product
 * lacks, today's step is kept and styled rather than the design's step being
 * built.
 *
 * The password is the one worth naming twice, because it reads as an omission
 * and is a decision. The paragraph at the top of this file has said since the
 * form was written why a password typed here cannot be held honestly, and the
 * design showing one does not answer that argument. It is in the follow up list
 * with the other five.
 *
 * WHAT CHANGED IS THE SHAPE. V10 rule 1: no boxes. Labels sit above inputs on
 * white with a hairline border, the submit is a full width navy bar, and the
 * sent state is a plain block of text rather than a tinted panel, because V10
 * carries status in weight rather than in colour.
 */
/*
 * One field style, written once.
 *
 * The 16px minimum is not a type choice: iOS zooms the viewport on focus for
 * anything under it, and the root layout deliberately does not lock zoom,
 * because locking it is an accessibility failure. `--tap-target` is the
 * platform's WCAG 2.5.8 floor and mobile-audit measures it.
 */
const FIELD =
  "min-h-[var(--tap-target)] w-full rounded-[3px] border border-[var(--color-limestone-edge)] bg-white px-3 text-[16px] text-[var(--color-ink)]";

export function SignUpForm() {
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  /* Off screen, never filled by a person. See the route's honeypot note. */
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="mt-7 border-t border-[var(--color-limestone-line)] pt-6">
        <p role="status" className="text-[16px] leading-[1.6] font-semibold text-[var(--color-ink)]">
          {sent}
        </p>
        <p className="mt-2 text-[15px] leading-[1.6] text-[var(--color-ink-quiet)]">
          The link lasts 3 days. If it has expired by the time you open it, sign in and the page
          will send you a fresh one.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-7 flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/account/sign-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, organisation, email, phone, website }),
          });
          const data = (await res.json().catch(() => null)) as
            | { ok?: boolean; error?: string; message?: string }
            | null;
          if (!res.ok || !data?.ok) {
            setError(data?.error ?? "That did not work. Try again.");
            return;
          }
          setSent(data.message ?? "Check your email.");
        } catch {
          setError("The network did not answer. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">Your name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">
          Company <span className="font-normal text-[var(--color-ink-quiet)]">(optional)</span>
        </span>
        <input
          name="organisation"
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          autoComplete="organization"
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">Email address</span>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          required
          aria-describedby={error ? "sign-up-error" : undefined}
          aria-invalid={error ? true : undefined}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">
          Telephone <span className="font-normal text-[var(--color-ink-quiet)]">(optional)</span>
        </span>
        <input
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          inputMode="tel"
          className={FIELD}
        />
      </label>

      {/*
        THE HONEYPOT. Hidden from people and from assistive technology, and
        named for something a bot expects to fill. aria-hidden and tabIndex
        together are what keep it out of a screen reader's way; display:none
        alone is skipped by some bots too, which defeats the point.
      */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {/*
        THE ERROR LOSES ITS COLOUR AS WELL AS ITS BOX. Operator ruling,
        2026-10-02, and this note is the one the other forms point at.

        THE SENTENCE THAT USED TO SIT HERE said the error "keeps its colour and
        loses its box", and argued it from red on white measuring 5.9:1. That was
        wrong, and how it was wrong is worth more than the fix.

        DESIGN_V10.md line 29: "No status colors. No red, green or amber anywhere
        in the UI. Urgency is shown with weight (bold) and words, never with
        color, dots, badges or tinted boxes. Brand navy and gold are the only
        colors."

        The old note was never a reading of that line. It was an argument about
        CONTRAST, which answers a different question: whether red is legible, not
        whether red is permitted. Both can be true at once and the spec had
        already decided the second. Worse, the note got quoted: three other forms
        said "see the note on the sign up form" and inherited a conclusion nobody
        had checked against the document.

        That is this repository's commonest failure in a new costume. A claim
        written to serve an argument is not an observation, and a session reading
        this file took the code's own comment as the authority over the spec,
        which is what happened on 2026-10-01.

        WHAT CARRIES IT INSTEAD, and it is enough. Ink at #161B22, weight 600, a
        2px ink left rule, and aria-live with role alert. A rule is structure
        rather than colour, so it survives the ruling, and it is what stops a
        failure reading as body copy. The words do the rest: an error says what is
        wrong and what to do about it.

        AND IT IS BETTER FOR SOMEBODY WHO CANNOT SEE THE DIFFERENCE. Red at
        5.9:1 told a person with deuteranopia nothing the weight was not already
        telling them. The colour was never carrying the meaning; it only looked
        as though it was.
      */}
      {error ? (
        <p
          id="sign-up-error"
          role="alert"
          aria-live="assertive"
          className="border-l-2 border-[var(--color-ink)] pl-3 text-[15px] leading-[1.55] font-semibold text-[var(--color-ink)]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-1 flex min-h-[var(--tap-target)] w-full items-center justify-center rounded-[3px] bg-[var(--color-slate)] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Sending" : "Create the account"}
      </button>

      <p className="text-[14px] leading-[1.6] text-[var(--color-ink-quiet)]">
        You choose a password from the link we send. Nobody here can see it, and the account cannot
        do anything until that link is opened.
      </p>
    </form>
  );
}
