"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExpiryState } from "@/lib/ops-credentials";

/**
 * The controls on the onboarding screen.
 *
 * All of them post and refresh rather than holding a local copy. The server is
 * the only thing that knows whether a county is one of the 254 or whether the
 * last document was accepted thirty seconds ago in another tab.
 */

const field =
  "min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-slate";
const primary =
  "inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:opacity-50";
const ghost =
  "inline-flex min-h-[44px] items-center justify-center rounded-[2px] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--ink)] hover:border-slate disabled:opacity-50";

async function post(payload: Record<string, unknown>) {
  const res = await fetch("/api/portal/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        blockers?: string[];
        token?: string;
        onboardingId?: string;
        credentials?: number;
        linked?: boolean;
        delivered?: "email" | "hand";
        sentTo?: string;
        emailFailed?: string | null;
      }
    | null;
  if (!res.ok || !body?.ok) {
    const err = new Error(body?.error ?? "That did not work.") as Error & { blockers?: string[] };
    err.blockers = body?.blockers ?? [];
    throw err;
  }
  return body;
}

function Problem({ message, blockers }: { message: string | null; blockers?: string[] }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-3">
      <p className="text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">{message}</p>
      {blockers && blockers.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {blockers.map((b) => (
            <li key={b} className="text-[14px] leading-[1.5] text-[var(--ink)]">
              {b}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Invite somebody from an application.
 *
 * The link comes back exactly once and is shown here. There is no way to see it
 * again, because the database holds a hash of it and not the token: a "resend
 * the same link" feature would require storing the token, which is the thing the
 * whole design avoids. Issuing a fresh link is the supported route.
 */
export function InviteButton({
  applicationId,
  defaultRole,
  technicianOnly = false,
}: {
  applicationId: string;
  defaultRole: string;
  /** technicians.onboard without profiles.create: the server refuses any other role, so the screen offers none. */
  technicianOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailFailed, setEmailFailed] = useState<string | null>(null);
  const [deliverBy, setDeliverBy] = useState<"email" | "hand">("email");
  const [role, setRole] = useState(
    !technicianOnly && defaultRole.toLowerCase().includes("engineer") ? "engineer" : "field_tech",
  );

  if (sentTo) {
    return (
      <div className="mt-3 border-t-2 border-[var(--ink)] pt-3">
        <p className="text-[14px] font-semibold text-[var(--ink)]">Invitation emailed to {sentTo}</p>
        <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--secondary)]">
          The email carries their onboarding link. If it does not arrive, issue a new invitation by hand.
        </p>
      </div>
    );
  }

  if (token) {
    const url = `${window.location.origin}/onboarding/${token}`;
    return (
      <div className="mt-3 border-t-2 border-[var(--ink)] pt-3">
        {emailFailed ? (
          <p role="alert" className="mb-2 text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
            The email could not be queued ({emailFailed}). Send them this link instead.
          </p>
        ) : null}
        <p className="text-[14px] font-semibold text-[var(--ink)]">Invitation link, shown once</p>
        <p className="mt-1.5 text-[12px] leading-[1.5] break-all text-[var(--ink)]">{url}</p>
        <p className="mt-2 text-[13px] leading-[1.5] text-[var(--secondary)]">
          Send this to them. It is not stored and cannot be shown again; if it is lost, issue a new
          one.
        </p>
        <button type="button" onClick={() => void navigator.clipboard.writeText(url)} className={`${ghost} mt-2`}>
          Copy the link
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label htmlFor={`role-${applicationId}`} className="block text-[14px] font-semibold text-[var(--ink)]">
            Invite as
          </label>
          <select
            id={`role-${applicationId}`}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`${field} mt-1.5`}
          >
            <option value="field_tech">Field technician</option>
            {technicianOnly ? null : <option value="engineer">Professional Engineer</option>}
          </select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label htmlFor={`deliver-${applicationId}`} className="block text-[14px] font-semibold text-[var(--ink)]">
            Send the link
          </label>
          <select
            id={`deliver-${applicationId}`}
            value={deliverBy}
            onChange={(e) => setDeliverBy(e.target.value === "hand" ? "hand" : "email")}
            className={`${field} mt-1.5`}
          >
            <option value="email">By email, to the address on the application</option>
            <option value="hand">By hand: show me the link once</option>
          </select>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const body = await post({ action: "invite_from_application", applicationId, role, deliverBy });
              if (body.delivered === "email" && body.sentTo) setSentTo(body.sentTo);
              else {
                setEmailFailed(body.emailFailed ?? null);
                setToken(body.token ?? null);
              }
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "That did not work.");
            } finally {
              setBusy(false);
            }
          }}
          className={primary}
        >
          {busy ? "Inviting" : "Invite to onboard"}
        </button>
      </div>
      <Problem message={error} />
    </div>
  );
}

const TONE: Record<ExpiryState, string> = {
  none: "text-[var(--secondary)]",
  current: "text-[var(--secondary)]",
  expiring: "text-[var(--ink)]",
  expired: "text-[var(--ink)]",
};

/**
 * The expiry date on a document.
 *
 * Typed by whoever is looking at the card. Nothing reads the document: there is
 * no OCR in this system and there will not be, because an expiry date a machine
 * pulled off a phone photograph is a date nobody checked, and this one gates
 * whether somebody is dispatched.
 */
export function ItemDates({
  onboardingId,
  itemKey,
  label,
  issuedOn,
  expiresOn,
  state,
  locked,
}: {
  onboardingId: string;
  itemKey: string;
  label: string;
  issuedOn: string | null;
  expiresOn: string | null;
  state: ExpiryState;
  locked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState(issuedOn ?? "");
  const [expires, setExpires] = useState(expiresOn ?? "");

  if (locked) {
    return (
      <p className={`mt-2 text-[14px] ${TONE[state]}`}>
        {expiresOn ? `Expires ${expiresOn}` : "No expiry recorded"}
      </p>
    );
  }

  return (
    <form
      className="mt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await post({
            action: "set_item_dates",
            onboardingId,
            itemKey,
            issuedOn: issued || null,
            expiresOn: expires || null,
          });
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[130px]">
          <label htmlFor={`issued-${itemKey}`} className="block text-[13px] font-semibold text-[var(--ink)]">
            Issued
          </label>
          <input
            id={`issued-${itemKey}`}
            type="date"
            value={issued}
            onChange={(e) => setIssued(e.target.value)}
            className={`${field} mt-1`}
          />
        </div>
        <div className="min-w-[130px]">
          <label htmlFor={`expires-${itemKey}`} className="block text-[13px] font-semibold text-[var(--ink)]">
            Expires
          </label>
          <input
            id={`expires-${itemKey}`}
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className={`${field} mt-1`}
          />
        </div>
        <button type="submit" disabled={busy} className={ghost}>
          {busy ? "Saving" : "Save dates"}
        </button>
      </div>
      {state === "expired" ? (
        <p className="mt-1.5 text-[14px] font-semibold text-[var(--ink)]">
          {label} has already expired. Dispatch refuses anybody whose required documents have lapsed.
        </p>
      ) : state === "expiring" ? (
        <p className="mt-1.5 text-[14px] text-[var(--ink)]">
          Expiring within 45 days. This warns on the roster and does not stop them working.
        </p>
      ) : null}
      <Problem message={error} />
    </form>
  );
}

/**
 * Coverage, gathered during onboarding rather than typed again at activation.
 *
 * Every county is checked against the canonical 254 on the server. A typo is not
 * cosmetic: dispatch matches on the county string, so a misspelled entry
 * silently excludes the technician from every job in a place they cover while
 * the roster shows their coverage as set.
 */
export function CoverageForm({
  onboardingId,
  counties,
  baseCity,
  baseCounty,
  allCounties,
  locked,
}: {
  onboardingId: string;
  counties: string[];
  baseCity: string | null;
  baseCounty: string | null;
  allCounties: string[];
  locked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>(counties);
  const [city, setCity] = useState(baseCity ?? "");
  const [county, setCounty] = useState(baseCounty ?? "");
  const [query, setQuery] = useState("");

  if (locked) {
    return (
      <div>
        <p className="portal-label">Coverage</p>
        <p className="mt-2 text-[14px] leading-[1.55] text-[var(--secondary)]">
          {counties.length} count{counties.length === 1 ? "y" : "ies"}: {counties.join(", ")}. Change
          this on the technician roster now that the account exists.
        </p>
      </div>
    );
  }

  const matches = query
    ? allCounties.filter((c) => c.toLowerCase().startsWith(query.toLowerCase()) && !chosen.includes(c)).slice(0, 8)
    : [];

  return (
    <div>
      <p className="portal-label">Coverage</p>
      <p className="mt-1.5 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
        Where this technician would work. A technician with none is offered nothing and would sit in
        the roster looking available, so activation refuses until there is at least one.
      </p>

      {chosen.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {chosen.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => setChosen((prev) => prev.filter((x) => x !== c))}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[2px] border border-[var(--border)] bg-white px-2.5 text-[14px] font-semibold text-[var(--ink)] hover:border-slate"
              >
                {c}
                <span aria-hidden="true">x</span>
                <span className="sr-only">Remove {c}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <label htmlFor="county-search" className="block text-[14px] font-semibold text-[var(--ink)]">
          Add a county
        </label>
        <input
          id="county-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing"
          className={`${field} mt-1.5`}
        />
        {matches.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {matches.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => {
                    setChosen((prev) => [...prev, c]);
                    setQuery("");
                  }}
                  className={ghost}
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="base-city" className="block text-[14px] font-semibold text-[var(--ink)]">
            Base city
          </label>
          <input id="base-city" value={city} onChange={(e) => setCity(e.target.value)} className={`${field} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="base-county" className="block text-[14px] font-semibold text-[var(--ink)]">
            Base county
          </label>
          <input
            id="base-county"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className={`${field} mt-1.5`}
          />
        </div>
      </div>

      <Problem message={error} />

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await post({
              action: "set_coverage",
              onboardingId,
              counties: chosen,
              baseCity: city,
              baseCounty: county,
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "That did not work.");
          } finally {
            setBusy(false);
          }
        }}
        className={`${primary} mt-4`}
      >
        {busy ? "Saving" : "Save coverage"}
      </button>
    </div>
  );
}

/**
 * Activation.
 *
 * The one irreversible step in this phase: it creates a real account, writes the
 * credentials dispatch reads, and puts somebody into the pool of people who can
 * be sent to a stranger's property. The blockers are shown before the button
 * rather than after it, because a refusal that arrives on click is one somebody
 * clicks four times.
 */
export function ActivatePanel({
  onboardingId,
  role,
  ready,
  blockers,
  activatedAt,
  profileId,
}: {
  onboardingId: string;
  role: "engineer" | "field_tech";
  ready: boolean;
  blockers: string[];
  activatedAt: string | null;
  profileId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const engineer = role === "engineer";

  if (activatedAt) {
    return (
      <div>
        <p className="portal-label">Activated</p>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
          {engineer
            ? "The account exists with the license number on the profile and the license, with its expiry, on file as a verified credential."
            : "The account exists and the credentials are on file. This person is not certified for any service line yet, so dispatch will not offer them work until they pass a protocol check. That is the gate working, not a missing step."}
        </p>
        {profileId && !engineer ? (
          <a
            href="/portal/techs"
            className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
          >
            See them on the roster
          </a>
        ) : null}
      </div>
    );
  }

  if (token || linked) {
    const url = token ? `${window.location.origin}/portal/set-password?token=${token}` : null;
    return (
      <div className="border-t-2 border-[var(--ink)] pt-3">
        <p className="text-[14px] font-semibold text-[var(--ink)]">Account created</p>
        {url ? (
          <>
            <p className="mt-1.5 text-[12px] leading-[1.5] break-all text-[var(--ink)]">{url}</p>
            <p className="mt-2 text-[13px] leading-[1.5] text-[var(--secondary)]">
              Their one time link to set a password. Shown once and not stored.
            </p>
            <button type="button" onClick={() => void navigator.clipboard.writeText(url)} className={`${ghost} mt-2`}>
              Copy the link
            </button>
          </>
        ) : (
          <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--secondary)]">
            That address already had credentials on this project, so it was linked rather than given
            a new password. They sign in with the password they already use.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="portal-label">Activate</p>
      <p className="mt-1.5 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
        Creates the account, copies every accepted document into their credentials with the expiry
        dates recorded above, sets the coverage, and issues a one time link to set a password. It
        does not certify them for anything.
      </p>

      {!ready ? (
        <div className="mt-3">
          <p className="portal-label">Not ready</p>
          <ul className="mt-2 flex flex-col gap-1">
            {blockers.map((b) => (
              <li key={b} className="text-[14px] leading-[1.5] text-[var(--secondary)]">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {engineer ? (
        <div className="mt-4 max-w-[320px]">
          <label htmlFor={`licence-${onboardingId}`} className="block text-[14px] font-semibold text-[var(--ink)]">
            Texas PE license number
          </label>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-[var(--secondary)]">
            From the license you accepted above. It goes on the profile; the expiry recorded on that item becomes the license credential.
          </p>
          <input
            id={`licence-${onboardingId}`}
            name="licenseNumber"
            inputMode="numeric"
            autoComplete="off"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className={`${field} mt-1.5`}
          />
        </div>
      ) : null}

      <Problem message={error} blockers={failed} />

      <button
        type="button"
        disabled={busy || !ready}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setFailed([]);
          try {
            const body = await post({ action: "activate", onboardingId, ...(engineer ? { licenseNumber } : {}) });
            setToken(body.token ?? null);
            setLinked(Boolean(body.linked));
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "That did not work.");
            setFailed((err as Error & { blockers?: string[] }).blockers ?? []);
          } finally {
            setBusy(false);
          }
        }}
        className={`${primary} mt-4`}
      >
        {busy ? "Activating" : engineer ? "Activate this engineer" : "Activate this technician"}
      </button>
    </div>
  );
}

/**
 * ACCEPT OR REJECT ONE ITEM, P1 2026-11-01. The buttons drawn are exactly the
 * decisions the server would allow (decisionsOffered, passed in from the page),
 * a rejection asks for its reason before anything is sent, and the result says
 * whether the person's email was queued.
 */
export function ItemDecision({
  onboardingId,
  itemKey,
  label,
  offered,
}: {
  onboardingId: string;
  itemKey: string;
  label: string;
  offered: ("accepted" | "rejected")[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (offered.length === 0) return null;

  async function decide(decision: "accepted" | "rejected") {
    if (decision === "rejected" && !reason.trim()) {
      setError("Say why it is rejected. The reason is what the person is told.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide_item", onboardingId, itemKey, decision, reason }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; emailed?: boolean; emailError?: string } | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? "That did not save.");
      setNote(body.emailed ? "Saved, and the person's email is queued." : `Saved. The email to the person could not be queued: ${body.emailError ?? "no reason given"}. Tell them another way.`);
      setRejecting(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {offered.includes("accepted") ? (
          <button type="button" disabled={busy} onClick={() => void decide("accepted")} className={ghost}>
            Accept {label}
          </button>
        ) : null}
        {offered.includes("rejected") && !rejecting ? (
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={ghost}>
            Reject {label}
          </button>
        ) : null}
      </div>
      {rejecting ? (
        <div className="mt-2 max-w-[520px]">
          <label htmlFor={`reject-${onboardingId}-${itemKey}`} className="block text-[14px] font-semibold text-[var(--ink)]">
            Why it is rejected (the person is told this)
          </label>
          <textarea
            id={`reject-${onboardingId}-${itemKey}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className={`${field} mt-1.5 py-2`}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void decide("rejected")} className={primary}>
              {busy ? "Sending" : "Reject and tell them"}
            </button>
            <button type="button" disabled={busy} onClick={() => { setRejecting(false); setError(null); }} className={ghost}>
              Keep it as it is
            </button>
          </div>
        </div>
      ) : null}
      <Problem message={error} />
      {note ? <p role="status" className="mt-2 text-[14px] leading-[1.5] text-[var(--ink)]">{note}</p> : null}
    </div>
  );
}

/**
 * IDENTITY AND I-9: THE DOCUMENT TYPE SEEN, WHO AND WHEN. P1, 2026-11-01. No
 * upload and no number: a type from the list, and the server stamps who and
 * when. A recorded check can be cleared with a reason, which clears all three.
 */
export function VerificationPanel({
  onboardingId,
  check,
  title,
  types,
  recorded,
  locked,
}: {
  onboardingId: string;
  check: "identity" | "i9";
  title: string;
  types: { value: string; label: string }[];
  recorded: { typeLabel: string | null; byName: string | null; at: string | null } | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState("");
  const [clearing, setClearing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await post({ onboardingId, check, ...payload });
      setClearing(false);
      setReason("");
      setType("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-3">
      <p className="text-[14px] font-semibold text-[var(--ink)]">{title}</p>
      {recorded ? (
        <>
          <p className="mt-0.5 text-[14px] leading-[1.5] text-[var(--ink)]">
            Verified: {recorded.typeLabel ?? "a document type this screen does not know"} seen by {recorded.byName ?? "a profile that could not be named"}, {recorded.at}.
          </p>
          {!locked && !clearing ? (
            <button type="button" onClick={() => setClearing(true)} className={`${ghost} mt-2`}>
              Clear this record
            </button>
          ) : null}
          {clearing ? (
            <div className="mt-2 max-w-[520px]">
              <label htmlFor={`clear-${onboardingId}-${check}`} className="block text-[14px] font-semibold text-[var(--ink)]">
                Why it is being cleared
              </label>
              <input id={`clear-${onboardingId}-${check}`} value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1.5`} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={busy || !reason.trim()} onClick={() => void send({ action: "clear_verification", reason })} className={primary}>
                  {busy ? "Clearing" : "Clear it"}
                </button>
                <button type="button" disabled={busy} onClick={() => setClearing(false)} className={ghost}>
                  Keep it
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : locked ? (
        <p className="mt-0.5 text-[14px] leading-[1.5] text-[var(--secondary)]">Not recorded.</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <label htmlFor={`type-${onboardingId}-${check}`} className="block text-[13px] font-semibold text-[var(--ink)]">
              Document type seen
            </label>
            <select id={`type-${onboardingId}-${check}`} value={type} onChange={(e) => setType(e.target.value)} className={`${field} mt-1`}>
              <option value="">Choose what you saw</option>
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" disabled={busy || !type} onClick={() => void send({ action: "record_verification", documentType: type })} className={primary}>
            {busy ? "Recording" : "Record as verified"}
          </button>
        </div>
      )}
      <Problem message={error} />
    </div>
  );
}
