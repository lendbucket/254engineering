"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = {
  key: string;
  name: string;
  landing_path: string;
  is_system: boolean;
  description: string | null;
  grants: string[];
  holders: { id: string; display_name: string; email: string; status: string }[];
};

const label = "block text-[13.5px] font-semibold text-[var(--navy)]";
const field =
  "mt-1.5 h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)] focus:border-[var(--navy)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20";
const hint = "mt-1.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]";

export function RolesClient({
  roles,
  groups,
  licensed,
  selfId,
}: {
  roles: Role[];
  groups: { name: string; actions: string[] }[];
  licensed: { role: string; actions: string[]; why: string };
  selfId: string;
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState({ key: "", name: "", landingPath: "/portal", description: "" });

  const open = roles.find((r) => r.key === openKey) ?? null;

  function edit(role: Role) {
    setOpenKey(role.key);
    setDraft(new Set(role.grants));
    setSaid(null);
  }

  async function post(body: unknown, done: string) {
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/portal/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => null);
      if (out?.ok) {
        setSaid({ tone: "ok", text: done });
        router.refresh();
      } else {
        setSaid({ tone: "bad", text: out?.error ?? "That did not work." });
      }
    } catch {
      setSaid({ tone: "bad", text: "The network dropped that. Nothing changed." });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {said ? (
        <p
          className={`rounded-[3px] border px-3 py-2.5 text-[13.5px] leading-[1.55] ${
            said.tone === "ok"
              ? "border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)]"
              : "border-[var(--danger)] bg-white font-semibold text-[var(--danger)]"
          }`}
        >
          {said.text}
        </p>
      ) : null}

      {/* ------------------------------------------------- what cannot be granted */}
      <section className="rounded-[4px] border border-[var(--gold)] bg-[var(--gold-wash)] p-4 sm:p-5">
        <p className="portal-kicker">Not permissions</p>
        <h2 className="mt-1 font-display text-[1.05rem] font-semibold leading-[1.3] text-[var(--navy)]">
          What no role can be given
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {licensed.actions.map((a) => (
            <li
              key={a}
              className="rounded-[3px] border border-[var(--border)] bg-white px-2.5 py-1 font-mono text-[12.5px] text-[var(--ink)]"
            >
              {a}
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-[68ch] text-[13.5px] leading-[1.6] text-[var(--ink)]">{licensed.why}</p>
      </section>

      {/* -------------------------------------------------------------- the roles */}
      {roles.map((role) => (
        <section key={role.key} className="rounded-[4px] border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[1.05rem] font-semibold leading-[1.3] text-[var(--navy)]">
                  {role.name}
                </h2>
                <span className="rounded-[3px] border border-[var(--border)] px-2 py-0.5 font-mono text-[12px] text-[var(--secondary)]">
                  {role.key}
                </span>
                {role.is_system ? (
                  <span className="rounded-[3px] bg-[var(--canvas)] px-2 py-0.5 text-[12px] font-semibold text-[var(--secondary)]">
                    Built in
                  </span>
                ) : null}
                {role.key === licensed.role ? (
                  <span className="rounded-[3px] bg-[var(--gold-wash)] px-2 py-0.5 text-[12px] font-semibold text-[var(--ink)]">
                    Carries the licence
                  </span>
                ) : null}
              </div>
              <p className={hint}>
                {role.grants.length} permission{role.grants.length === 1 ? "" : "s"}, lands on{" "}
                <span className="font-mono">{role.landing_path}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => (openKey === role.key ? setOpenKey(null) : edit(role))}
              className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-4 text-[13.5px] font-bold text-[var(--navy)] hover:bg-[var(--canvas)]"
            >
              {openKey === role.key ? "Close" : "Edit permissions"}
            </button>
          </div>

          {/* who holds it */}
          <div className="mt-3">
            <p className="portal-kicker">Held by</p>
            {role.holders.length === 0 ? (
              <p className={hint}>Nobody. The role exists and is ready to assign.</p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {role.holders.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-2 text-[13.5px] text-[var(--ink)]">
                    <span className="font-semibold text-[var(--navy)]">{h.display_name}</span>
                    <span className="text-[var(--secondary)]">{h.email}</span>
                    {h.status !== "active" ? (
                      <span className="rounded-[3px] bg-[var(--canvas)] px-2 py-0.5 text-[12px] font-semibold text-[var(--secondary)]">
                        {h.status}
                      </span>
                    ) : null}
                    {h.id === selfId ? (
                      <span className="text-[12px] font-semibold text-[var(--secondary)]">this is you</span>
                    ) : null}
                    <select
                      aria-label={`Move ${h.display_name} to another role`}
                      value={role.key}
                      disabled={busy}
                      onChange={(e) =>
                        post(
                          { action: "set_user_role", userId: h.id, roleKey: e.target.value },
                          `${h.display_name} moved to ${e.target.value}.`,
                        )
                      }
                      className="ml-auto h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-2 text-[12.5px]"
                    >
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* the grants */}
          {openKey === role.key && open ? (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              {groups.map((group) => (
                <div key={group.name} className="mb-4">
                  <p className="portal-kicker">{group.name}</p>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {group.actions.map((a) => (
                      <label
                        key={a}
                        className="flex min-h-[var(--tap-target)] cursor-pointer items-center gap-2.5 rounded-[3px] px-2 hover:bg-[var(--canvas)]"
                      >
                        <input
                          type="checkbox"
                          checked={draft.has(a)}
                          onChange={(e) => {
                            const next = new Set(draft);
                            if (e.target.checked) next.add(a);
                            else next.delete(a);
                            setDraft(next);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="font-mono text-[12.5px] text-[var(--ink)]">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    post(
                      { action: "set_grants", roleKey: role.key, grants: [...draft] },
                      `${role.name} updated. It takes effect on their next request.`,
                    )
                  }
                  className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-50"
                >
                  {busy ? "Saving" : "Save permissions"}
                </button>
                {!role.is_system && role.holders.length === 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post({ action: "delete_role", roleKey: role.key }, `${role.name} deleted.`)}
                    className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] border border-[var(--danger)] bg-white px-4 text-[13.5px] font-bold text-[var(--danger)] hover:bg-[var(--canvas)]"
                  >
                    Delete this role
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ))}

      {/* ------------------------------------------------------------ a new role */}
      <section className="rounded-[4px] border border-[var(--border)] bg-white p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--navy-hover)]"
        >
          {creating ? "Cancel" : "Create a role"}
        </button>

        {creating ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rkey" className={label}>Key</label>
              <input
                id="rkey"
                value={newRole.key}
                onChange={(e) => setNewRole({ ...newRole, key: e.target.value })}
                className={field}
              />
              <p className={hint}>Lower case letters, digits and underscores. It cannot be changed later.</p>
            </div>
            <div>
              <label htmlFor="rname" className={label}>Name</label>
              <input
                id="rname"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="rland" className={label}>Where they land after signing in</label>
              <input
                id="rland"
                value={newRole.landingPath}
                onChange={(e) => setNewRole({ ...newRole, landingPath: e.target.value })}
                className={field}
              />
              <p className={hint}>
                Required. A role without one would silently inherit somebody else&apos;s home screen.
              </p>
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  post(
                    { action: "create_role", ...newRole },
                    `${newRole.name || newRole.key} created with no permissions. Give it some below.`,
                  )
                }
                className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-50"
              >
                {busy ? "Creating" : "Create the role"}
              </button>
              <p className={hint}>
                It starts with nothing granted, which is the safe direction: a role that could do
                everything the moment it existed would be one somebody assigned before reading it.
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
