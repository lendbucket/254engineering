import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor, MIN_PASSWORD_LENGTH } from "@/lib/ops-auth";
import { actionsFor, can, holdsLicence, roleLabel } from "@/lib/ops-authz";
import { mfaStateFor } from "@/lib/ops-mfa";
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
  const mfa = await mfaStateFor(actor!.id);

  const rows: [string, string][] = [
    ["Name", actor!.display_name],
    ["Email", actor!.email],
    ["Role", roleLabel(actor!.role)],
    ["Phone", actor!.phone ?? "Not recorded"],
  ];

  if (actor!.role === "engineer") {
    rows.push(["Texas PE license", actor!.license_number ?? "Not recorded"]);
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

          {/*
            TWO-STEP VERIFICATION, REACHABLE FROM HERE. Added 2026-10-07: until
            then the enrolment screen was reached only at sign in or by typing its
            address, and the engineer's sealing is refused until he has a
            verified second factor (ruling 2 of 2026-10-06).
          */}
          <Panel
            title="Two-step verification"
            description={
              mfa.enrolled
                ? "Set up. A code from your authenticator app is asked for at sign in."
                : "Not set up. It protects your account with a code from an authenticator app."
            }
          >
            {mfa.enrolled ? null : (
              <Link
                href="/portal/mfa/enrol"
                className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)]"
              >
                Set up two-step verification
              </Link>
            )}
          </Panel>

          {holdsLicence(actor, "documents.seal") ? (
            <Panel
              title="Seal and signature"
              description="The images you apply when you seal a document. Stored by you, never shown on any screen."
            >
              <Link
                href="/portal/profile/seal"
                className="inline-flex min-h-[var(--tap-target)] items-center text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
              >
                Manage your seal and signature
              </Link>
            </Panel>
          ) : null}

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
