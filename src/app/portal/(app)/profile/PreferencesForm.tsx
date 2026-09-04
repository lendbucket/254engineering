"use client";

import { useState } from "react";
import { emailIsMandatory, type NotificationKind } from "@/lib/ops-comms";

/**
 * Which notifications reach you outside the portal.
 *
 * WHAT IS NOT ON THIS SCREEN
 * --------------------------
 * A switch for the in app notification. It is the record that the event
 * happened, and a preference that hid it would leave a row nobody can ever see:
 * a hidden product rather than a quieter one. What is offered is control over
 * what interrupts your evening, which is the thing people actually want.
 *
 * The two mandatory kinds are rendered as fixed rather than as a switch that
 * silently refuses to move. A toggle that appears to save and then does nothing
 * is worse than one that is visibly not there, and the reason is printed beside
 * it rather than left as an unexplained absence.
 */
export function PreferencesForm({
  preferences,
}: {
  preferences: { kind: NotificationKind; label: string; email: boolean }[];
}) {
  const [state, setState] = useState(() =>
    Object.fromEntries(preferences.map((p) => [p.kind, p.email])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(kind: NotificationKind, email: boolean) {
    setSaving(kind);
    setError(null);
    const previous = state[kind];
    setState((s) => ({ ...s, [kind]: email }));
    try {
      const res = await fetch("/api/portal/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_preference", kind, email, sms: false }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        // Put it back. A switch that stayed where you left it while the server
        // refused is a switch that lies about the state of the system.
        setState((s) => ({ ...s, [kind]: previous }));
        setError(body?.error ?? "That did not save.");
      }
    } catch {
      setState((s) => ({ ...s, [kind]: previous }));
      setError("The network dropped that. Try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-limestone-line">
        {preferences.map((p) => {
          const fixed = emailIsMandatory(p.kind);
          return (
            <li key={p.kind} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-[13.5px] leading-[1.4] font-semibold text-[var(--navy)]">{p.label}</p>
                {fixed ? (
                  <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
                    Always emailed. This one stops you being offered work, so you are told even if
                    you have turned everything else off.
                  </p>
                ) : null}
              </div>

              {fixed ? (
                <span className="shrink-0 rounded-[3px] border border-[var(--border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--secondary)]">
                  Always on
                </span>
              ) : (
                <label className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={state[p.kind] ?? false}
                    disabled={saving === p.kind}
                    onChange={(e) => void save(p.kind, e.target.checked)}
                    className="h-5 w-5 accent-[var(--navy)]"
                  />
                  <span className="text-[13.5px] font-semibold text-[var(--navy)]">Email</span>
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 max-w-[70ch] text-[12.5px] leading-[1.55] text-[var(--secondary)]">
        Everything appears in the portal whatever you choose here. Text messages are not sent by this
        platform at all yet; the preference exists in the record so that adding a provider later is a
        setting rather than a rebuild, and nothing pretends a message went out that did not.
      </p>
    </div>
  );
}
