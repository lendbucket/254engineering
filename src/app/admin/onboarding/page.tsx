import Link from "next/link";
import { requireAdmin } from "@/lib/admin-data";
import { listOnboardings } from "@/lib/onboarding";
import { AdminShell, Chip, Panel, TableWrap, Td, Th } from "@/components/admin/shell";
import { NewOnboarding } from "./NewOnboarding";

export const dynamic = "force-dynamic";

function when(iso: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "";
}

export default async function AdminOnboardingPage() {
  await requireAdmin();
  const rows = await listOnboardings();

  return (
    <AdminShell
      title="Onboarding"
      lede="Every person invited to the secure onboarding flow, newest first."
    >
      <NewOnboarding />

      <Panel className="mt-[18px]">
        {rows.length === 0 ? (
          <p className="text-[14.5px] text-slate-muted">
            Nobody has been invited yet. Create one above.
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Invited</Th>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Link expires</Th>
                <Th>Open</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap tabular-nums text-slate-muted">
                    {when(r.invited_at)}
                  </Td>
                  <Td className="font-semibold text-slate">
                    {r.person_name}
                    <span className="block font-normal text-slate-muted">{r.email}</span>
                  </Td>
                  <Td>{r.role === "engineer" ? "Professional Engineer" : "Field Technician"}</Td>
                  <Td>
                    <Chip status={r.status} />
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-slate-muted">
                    {when(r.invite_expires_at)}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/onboarding/${r.id}`}
                      className="inline-flex min-h-[36px] items-center font-semibold text-slate underline decoration-brass underline-offset-4"
                    >
                      Review
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </AdminShell>
  );
}
