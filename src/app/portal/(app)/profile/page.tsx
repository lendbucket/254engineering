import { notFound } from "next/navigation";
import { currentActor, MIN_PASSWORD_LENGTH } from "@/lib/ops-auth";
import { actionsFor, can, ROLE_LABEL } from "@/lib/ops-authz";
import { PageHead, Panel } from "@/components/portal/surfaces";
import { preferencesFor } from "@/lib/ops-notify";
import { kindsForRole } from "@/lib/ops-comms";
import { PasswordForm } from "./PasswordForm";
import { PreferencesForm } from "./PreferencesForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const actor = await currentActor();
  const stored = actor ? await preferencesFor(actor.id, actor.role) : [];
  if (!can(actor, "profiles.read_self")) notFound();

  const rows: [string, string][] = [
    ["Name", actor!.display_name],
    ["Email", actor!.email],
    ["Role", ROLE_LABEL[actor!.role]],
    ["Phone", actor!.phone ?? "Not recorded"],
  ];

  if (actor!.role === "engineer") {
    rows.push(["Texas PE licence", actor!.license_number ?? "Not recorded"]);
    rows.push(["TDI windstorm appointment", actor!.tdi_appointment ?? "none"]);
  }
  if (actor!.role === "field_tech") {
    rows.push(["Base", actor!.base_city ? `${actor!.base_city}, ${actor!.base_county ?? ""}`.replace(/, $/, "") : "Not recorded"]);
    rows.push([
      "Coverage counties",
      actor!.coverage_counties.length ? actor!.coverage_counties.join(", ") : "None set yet",
    ]);
    rows.push(["Certification", actor!.certification_status ?? "none"]);
  }

  return (
    <>
      <PageHead eyebrow="Your account" title={actor!.display_name} lede="What the platform holds about you, and your password." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Details" description="An administrator maintains these. Ask them to change anything wrong.">
          <dl className="divide-y divide-limestone-line">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
                <dt className="text-[13.5px] font-semibold text-[var(--navy)]">{k}</dt>
                <dd className="text-[13.5px] leading-[1.55] break-words text-[var(--secondary)]">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Password" description="Only you ever know it. Nobody at the firm can see it.">
            <PasswordForm minLength={MIN_PASSWORD_LENGTH} />
          </Panel>

          <Panel
            title="Notifications"
            description="Everything reaches you in the portal. This is what also reaches you by email."
          >
            <PreferencesForm
              preferences={kindsForRole(actor!.role).map((spec) => ({
                kind: spec.kind,
                label: spec.label,
                email: stored.find((p) => p.kind === spec.kind)?.email ?? spec.emailByDefault,
              }))}
            />
          </Panel>

          <Panel
            title="What this role can do"
            description="The same list the platform checks on every request."
          >
            <ul className="flex flex-wrap gap-1.5">
              {actionsFor(actor!.role).map((a) => (
                <li
                  key={a}
                  className="rounded-[3px] border border-[var(--border)] bg-[var(--canvas)] px-2 py-1 font-mono text-[11px] text-[var(--secondary)]"
                >
                  {a}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
