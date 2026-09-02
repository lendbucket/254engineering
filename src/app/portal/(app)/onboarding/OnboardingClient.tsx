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
  "min-h-[44px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate";
const primary =
  "inline-flex min-h-[44px] items-center justify-center rounded-[3px] bg-brass px-4 text-[14px] font-bold text-slate-ink transition-colors hover:bg-brass-light disabled:opacity-50";
const ghost =
  "inline-flex min-h-[44px] items-center justify-center rounded-[3px] border border-limestone-line px-4 text-[14px] font-semibold text-slate hover:border-slate disabled:opacity-50";

async function post(payload: Record<string, unknown>) {
  const res = await fetch("/api/portal/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string; blockers?: string[]; token?: string; onboardingId?: string; credentials?: number; linked?: boolean }
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
      <p className="text-[13.5px] leading-[1.5] font-semibold text-[#a3241c]">{message}</p>
      {blockers && blockers.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {blockers.map((b) => (
            <li key={b} className="text-[13px] leading-[1.5] text-[#a3241c]">
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
export function InviteButton({ applicationId, defaultRole }: { applicationId: string; defaultRole: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState(defaultRole.toLowerCase().includes("engineer") ? "engineer" : "field_tech");

  if (token) {
    const url = `${window.location.origin}/onboarding/${token}`;
    return (
      <div className="mt-3 rounded-[3px] border border-limestone-line border-l-[3px] border-l-brass bg-limestone px-3 py-3">
        <p className="text-[13px] font-semibold text-slate">Invitation link, shown once</p>
        <p className="mt-1.5 font-mono text-[12px] leading-[1.5] break-all text-slate">{url}</p>
        <p className="mt-2 text-[12.5px] leading-[1.5] text-slate-muted">
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
          <label htmlFor={`role-${applicationId}`} className="block text-[13px] font-semibold text-slate">
            Invite as
          </label>
          <select
            id={`role-${applicationId}`}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`${field} mt-1.5`}
          >
            <option value="field_tech">Field technician</option>
            <option value="engineer">Professional Engineer</option>
          </select>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const body = await post({ action: "invite_from_application", applicationId, role });
              setToken(body.token ?? null);
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
  none: "text-slate-muted",
  current: "text-slate-muted",
  expiring: "text-[#7a4c05]",
  expired: "text-[#a3241c]",
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
      <p className={`mt-2 text-[13px] ${TONE[state]}`}>
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
          <label htmlFor={`issued-${itemKey}`} className="block text-[12.5px] font-semibold text-slate">
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
          <label htmlFor={`expires-${itemKey}`} className="block text-[12.5px] font-semibold text-slate">
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
        <p className="mt-1.5 text-[13px] font-semibold text-[#a3241c]">
          {label} has already expired. Dispatch refuses anybody whose required documents have lapsed.
        </p>
      ) : state === "expiring" ? (
        <p className="mt-1.5 text-[13px] text-[#7a4c05]">
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
        <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Coverage</p>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-slate-muted">
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
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Coverage</p>
      <p className="mt-1.5 max-w-[70ch] text-[13px] leading-[1.55] text-slate-muted">
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
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[3px] border border-limestone-line bg-limestone px-2.5 text-[13px] font-semibold text-slate hover:border-slate"
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
        <label htmlFor="county-search" className="block text-[13px] font-semibold text-slate">
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
          <label htmlFor="base-city" className="block text-[13px] font-semibold text-slate">
            Base city
          </label>
          <input id="base-city" value={city} onChange={(e) => setCity(e.target.value)} className={`${field} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="base-county" className="block text-[13px] font-semibold text-slate">
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
  ready,
  blockers,
  activatedAt,
  profileId,
}: {
  onboardingId: string;
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

  if (activatedAt) {
    return (
      <div>
        <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Activated</p>
        <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.55] text-slate-muted">
          The account exists and the credentials are on file. This person is not certified for any
          service line yet, so dispatch will not offer them work until they pass a protocol check.
          That is the gate working, not a missing step.
        </p>
        {profileId ? (
          <a
            href="/portal/techs"
            className="mt-3 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-slate underline underline-offset-4"
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
      <div className="rounded-[3px] border border-limestone-line border-l-[3px] border-l-brass bg-limestone px-3 py-3">
        <p className="text-[13px] font-semibold text-slate">Account created</p>
        {url ? (
          <>
            <p className="mt-1.5 font-mono text-[12px] leading-[1.5] break-all text-slate">{url}</p>
            <p className="mt-2 text-[12.5px] leading-[1.5] text-slate-muted">
              Their one time link to set a password. Shown once and not stored.
            </p>
            <button type="button" onClick={() => void navigator.clipboard.writeText(url)} className={`${ghost} mt-2`}>
              Copy the link
            </button>
          </>
        ) : (
          <p className="mt-1.5 text-[13px] leading-[1.55] text-slate-muted">
            That address already had credentials on this project, so it was linked rather than given
            a new password. They sign in with the password they already use.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Activate</p>
      <p className="mt-1.5 max-w-[70ch] text-[13px] leading-[1.55] text-slate-muted">
        Creates the account, copies every accepted document into their credentials with the expiry
        dates recorded above, sets the coverage, and issues a one time link to set a password. It
        does not certify them for anything.
      </p>

      {!ready ? (
        <div className="mt-3">
          <p className="text-[13px] font-bold tracking-[0.1em] text-brass-ink uppercase">Not ready</p>
          <ul className="mt-2 flex flex-col gap-1">
            {blockers.map((b) => (
              <li key={b} className="text-[13.5px] leading-[1.5] text-slate-muted">
                {b}
              </li>
            ))}
          </ul>
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
            const body = await post({ action: "activate", onboardingId });
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
        {busy ? "Activating" : "Activate this technician"}
      </button>
    </div>
  );
}
