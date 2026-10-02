"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Defaults = {
  billingEmail: string | null;
  billingContact: string | null;
  preferredUrgency: "standard" | "expedited" | "emergency" | null;
  accessInstructions: string | null;
  defaultCounties: string[];
};

type ApiKey = {
  id: string;
  label: string;
  prefix: string;
  rateLimitPerMinute: number | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type Property = {
  id: string;
  label: string | null;
  propertyAddress: string;
  city: string | null;
  county: string;
  postalCode: string | null;
};

/**
 * The settings an owner can change.
 *
 * A member sees the same values, read only, with one sentence saying why. That
 * is better than hiding the screen: somebody who cannot change the standing
 * access instructions still needs to know what they say, because every order
 * they place carries them.
 */
export function SettingsClient({
  defaults,
  properties,
  apiKeys,
  isOwner,
}: {
  defaults: Defaults;
  properties: Property[];
  apiKeys: ApiKey[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    billingContact: defaults.billingContact ?? "",
    billingEmail: defaults.billingEmail ?? "",
    accessInstructions: defaults.accessInstructions ?? "",
    preferredUrgency: defaults.preferredUrgency ?? "",
    defaultCounties: defaults.defaultCounties.join(", "),
  });
  const [prop, setProp] = useState({ label: "", propertyAddress: "", city: "", county: "", postalCode: "" });
  const [keyLabel, setKeyLabel] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function post(payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That did not work.");
        return false;
      }
      setNote("Saved.");
      router.refresh();
      return true;
    } catch {
      setError("The request did not complete.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const field = "mt-1.5 w-full rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[15px] text-[var(--navy)] disabled:bg-[var(--canvas)] disabled:text-[var(--secondary)]";

  return (
    <div>
      {/*
        V10 removes the tinted panel. This explains why the fields below are
        read only, which is information rather than a status, so it carries
        neither a tint nor a colour. The fields are visibly disabled already;
        this says why.

        The comment sits OUTSIDE the ternary deliberately. Inside the
        parenthesised branch it is a second expression where one is allowed,
        which is the mistake CLAUDE.md already records once and which this file
        carried until tsc refused it.
      */}
      {!isOwner ? (
        <p className="mb-6 border-l-2 border-[var(--color-limestone-edge)] pl-3 text-[14px] leading-[1.6] text-[var(--color-ink-quiet)]">
          You can see these because every order you place carries them. Only an account owner can
          change them.
        </p>
      ) : null}

      <section className="rounded-[4px] border border-[var(--border)] bg-white p-5">
        <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">Billing</h2>

        <label htmlFor="billingContact" className="mt-4 block text-[14px] font-bold text-[var(--navy)]">
          Billing contact
        </label>
        <input
          id="billingContact"
          disabled={!isOwner}
          value={form.billingContact}
          onChange={(e) => setForm({ ...form, billingContact: e.target.value })}
          className={field}
        />

        <label htmlFor="billingEmail" className="mt-4 block text-[14px] font-bold text-[var(--navy)]">
          Where statements go
        </label>
        <input
          id="billingEmail"
          type="email"
          disabled={!isOwner}
          value={form.billingEmail}
          onChange={(e) => setForm({ ...form, billingEmail: e.target.value })}
          className={field}
        />
      </section>

      <section className="mt-4 rounded-[4px] border border-[var(--border)] bg-white p-5">
        <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">On every order</h2>

        <label htmlFor="accessInstructions" className="mt-4 block text-[14px] font-bold text-[var(--navy)]">
          Standing access instructions
        </label>
        <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
          Copied into the access notes on every order this account places, where you can still change
          it for one property.
        </p>
        <textarea
          id="accessInstructions"
          rows={3}
          disabled={!isOwner}
          value={form.accessInstructions}
          onChange={(e) => setForm({ ...form, accessInstructions: e.target.value })}
          className={field}
        />

        <label htmlFor="preferredUrgency" className="mt-4 block text-[14px] font-bold text-[var(--navy)]">
          Preferred turnaround
        </label>
        <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
          Recorded on your orders so the firm sees it. It is not a commitment and it does not change
          the price, because the firm does not sell a priced expedited tier yet.
        </p>
        <select
          id="preferredUrgency"
          disabled={!isOwner}
          value={form.preferredUrgency}
          onChange={(e) => setForm({ ...form, preferredUrgency: e.target.value })}
          className={`${field} min-h-[44px]`}
        >
          <option value="">No preference</option>
          <option value="standard">Standard</option>
          <option value="expedited">As soon as the firm can</option>
          <option value="emergency">Urgent</option>
        </select>

        <label htmlFor="defaultCounties" className="mt-4 block text-[14px] font-bold text-[var(--navy)]">
          Counties you usually work in
        </label>
        <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
          Comma separated. Offered when you are filling in a bulk submission.
        </p>
        <input
          id="defaultCounties"
          disabled={!isOwner}
          value={form.defaultCounties}
          onChange={(e) => setForm({ ...form, defaultCounties: e.target.value })}
          className={field}
        />

        {isOwner ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              post(
                {
                  action: "defaults",
                  billingContact: form.billingContact,
                  billingEmail: form.billingEmail,
                  accessInstructions: form.accessInstructions,
                  preferredUrgency: form.preferredUrgency,
                  defaultCounties: form.defaultCounties.split(",").map((c) => c.trim()).filter(Boolean),
                },
                "defaults",
              )
            }
            className="mt-5 inline-flex min-h-[44px] items-center rounded-[3px] bg-slate px-5 text-[14px] font-bold text-white disabled:opacity-45"
          >
            {busy === "defaults" ? "Saving" : "Save"}
          </button>
        ) : null}
      </section>

      <section className="mt-4 rounded-[4px] border border-[var(--border)] bg-white p-5">
        <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">Saved properties</h2>
        <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
          Chosen when you order instead of being retyped. Removing one takes it out of the list and
          leaves every order already placed against it alone.
        </p>

        {properties.length > 0 ? (
          <ul className="mt-4 divide-y divide-limestone-line border-t border-[var(--border)]">
            {properties.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <span className="text-[14px] font-semibold text-[var(--navy)]">
                  {p.label || p.propertyAddress}
                </span>
                <span className="text-[14px] text-[var(--secondary)]">
                  {p.label ? `${p.propertyAddress}, ` : ""}
                  {p.county} County
                </span>
                {isOwner ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => post({ action: "archive-property", propertyId: p.id }, p.id)}
                    className="ml-auto min-h-[44px] text-[14px] font-semibold text-[var(--navy)] underline underline-offset-2"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[14px] text-[var(--secondary)]">Nothing saved yet.</p>
        )}

        {isOwner ? (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="text-[14px] font-bold text-[var(--navy)]">Add one</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                aria-label="Label"
                placeholder="Label, optional"
                value={prop.label}
                onChange={(e) => setProp({ ...prop, label: e.target.value })}
                className="rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[14px] text-[var(--navy)]"
              />
              <input
                aria-label="Address"
                placeholder="Address"
                value={prop.propertyAddress}
                onChange={(e) => setProp({ ...prop, propertyAddress: e.target.value })}
                className="rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[14px] text-[var(--navy)]"
              />
              <input
                aria-label="City"
                placeholder="City"
                value={prop.city}
                onChange={(e) => setProp({ ...prop, city: e.target.value })}
                className="rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[14px] text-[var(--navy)]"
              />
              <input
                aria-label="County"
                placeholder="County"
                value={prop.county}
                onChange={(e) => setProp({ ...prop, county: e.target.value })}
                className="rounded-[3px] border border-[var(--border)] px-3 py-2.5 text-[14px] text-[var(--navy)]"
              />
            </div>
            <button
              type="button"
              disabled={busy !== null || !prop.propertyAddress.trim() || !prop.county.trim()}
              onClick={async () => {
                const ok = await post({ action: "add-property", ...prop }, "add");
                if (ok) setProp({ label: "", propertyAddress: "", city: "", county: "", postalCode: "" });
              }}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-45"
            >
              {busy === "add" ? "Adding" : "Add property"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-[4px] border border-[var(--border)] bg-white p-5">
        <h2 className="border-b-2 border-[var(--color-ink)] pb-3 text-[17px] font-semibold text-[var(--color-ink)]">API keys</h2>
        <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
          For placing orders from your own systems. A key can order only for this organization,
          because the account is read from the key rather than from the request.
        </p>

        {apiKeys.length > 0 ? (
          <ul className="mt-4 divide-y divide-limestone-line border-t border-[var(--border)]">
            {apiKeys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
                <span className="font-mono text-[13px] text-[var(--navy)]">{k.prefix}…</span>
                <span className="text-[14px] font-semibold text-[var(--navy)]">{k.label}</span>
                <span className="text-[13px] text-[var(--secondary)]">
                  {k.revokedAt
                    ? "revoked"
                    : k.lastUsedAt
                      ? `last used ${new Date(k.lastUsedAt).toLocaleDateString("en-US")}`
                      : "never used"}
                </span>
                {isOwner && !k.revokedAt ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => post({ action: "revoke-key", keyId: k.id }, k.id)}
                    className="ml-auto min-h-[44px] text-[14px] font-semibold text-[var(--navy)] underline underline-offset-2"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[14px] text-[var(--secondary)]">No keys yet.</p>
        )}

        {/*
          V10 REMOVES THE TINT AND KEEPS THE EMPHASIS, which is the judgement
          OrderFlow already records about the sentence telling somebody their
          card was not charged. This one says a value is being shown for the
          only time it can ever be shown, so it may not look like the paragraph
          above it. A 2px rule and weight rather than a panel.

          Ink rather than a warning colour, because nothing has gone wrong. An
          amber tint was the old way of saying "read this"; weight says it
          without asking anybody to decode a colour.
        */}
        {freshKey ? (
          <div className="mt-4 border-l-2 border-[var(--color-ink)] pl-4">
            <p className="text-[13px] font-semibold tracking-[0.06em] text-[var(--color-ink)] uppercase">
              Copy this now
            </p>
            <p className="mt-1.5 text-[14px] leading-[1.55] font-semibold text-[var(--color-ink)]">
              This is the only time it can be shown. Only a hash of it is stored, so the firm cannot
              show it to you again and cannot recover it if you lose it.
            </p>
            <code className="mt-2.5 block overflow-x-auto border border-[var(--color-limestone-edge)] px-2.5 py-2 font-mono text-[13px] break-all text-[var(--color-ink)]">
              {freshKey}
            </code>
            <button
              type="button"
              onClick={() => setFreshKey(null)}
              className="mt-2 min-h-[44px] text-[14px] font-semibold text-[var(--color-link)] underline underline-offset-2"
            >
              I have copied it
            </button>
          </div>
        ) : null}

        {isOwner ? (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <label htmlFor="keyLabel" className="block text-[14px] font-bold text-[var(--navy)]">
              Create a key
            </label>
            <input
              id="keyLabel"
              placeholder="What it is for, e.g. ordering from the CRM"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              className={field}
            />
            <button
              type="button"
              disabled={busy !== null || !keyLabel.trim()}
              onClick={async () => {
                setBusy("key");
                setError(null);
                setNote(null);
                try {
                  const res = await fetch("/api/account/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "create-key", label: keyLabel }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.ok) {
                    setError(data.error ?? "That did not work.");
                    return;
                  }
                  setFreshKey(data.key);
                  setKeyLabel("");
                  router.refresh();
                } catch {
                  setError("The request did not complete.");
                } finally {
                  setBusy(null);
                }
              }}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-45"
            >
              {busy === "key" ? "Creating" : "Create key"}
            </button>
          </div>
        ) : null}
      </section>

      {/*
        TWO MESSAGES, TWO TREATMENTS, AND THE DIFFERENCE IS DELIBERATE.

        Neither keeps a colour. DESIGN_V10.md line 29 allows no red, green or
        amber anywhere in the UI, and I got this wrong on 2026-10-01 by citing a
        code comment as the precedent instead of reading that line. The note on
        the sign up form carries the full account.

        Both are ink at weight 600 behind a 2px ink rule, which is structure
        rather than colour. What distinguishes them is the words and the role: an
        error says what is wrong and what to do, a status says what happened.
      */}
      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-4 border-l-2 border-[var(--color-ink)] pl-3 text-[14px] leading-[1.6] font-semibold text-[var(--color-ink)]"
        >
          {error}
        </p>
      ) : null}
      {note ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 border-l-2 border-[var(--color-ink)] pl-3 text-[14px] leading-[1.6] font-semibold text-[var(--color-ink)]"
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
