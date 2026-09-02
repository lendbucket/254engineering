import Link from "next/link";
import { countsBySite } from "@/lib/admin-data";
import { AdminShell, Panel, TableWrap, Td, Th } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * Counts across all three brands, because one Supabase project holds all three
 * and this is the one screen where that is useful rather than incidental. The
 * site list comes from the data, so a fourth brand appears here without an edit.
 */
export default async function AdminDashboard() {
  const counts = await countsBySite();
  const total = counts.reduce(
    (a, c) => ({
      leads: a.leads + c.leads,
      applications: a.applications + c.applications,
      onboardings: a.onboardings + c.onboardings,
    }),
    { leads: 0, applications: 0, onboardings: 0 },
  );

  return (
    <AdminShell
      title="Dashboard"
      lede="Every record across the three brands this project holds. Counts are live, not cached."
    >
      <div className="grid gap-[18px] sm:grid-cols-3">
        {[
          ["Leads", total.leads, "/admin/leads"],
          ["Applications", total.applications, "/admin/applications"],
          ["Onboardings", total.onboardings, "/admin/onboarding"],
        ].map(([label, value, href]) => (
          <Link
            key={label as string}
            href={href as string}
            className="group rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-5 transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_24px_rgba(20,49,93,0.14)]"
          >
            <span className="block text-[11.5px] font-bold tracking-[0.1em] text-brass-ink uppercase">
              {label as string}
            </span>
            <span className="mt-2 block font-display text-[38px] leading-none font-extrabold tabular-nums text-slate">
              {value as number}
            </span>
          </Link>
        ))}
      </div>

      <Panel title="By site" className="mt-[18px]">
        {counts.length === 0 ? (
          <p className="text-[14.5px] text-slate-muted">
            No records yet, or the database is not reachable from this deployment.
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Site</Th>
                <Th>Leads</Th>
                <Th>Applications</Th>
                <Th>Onboardings</Th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.site}>
                  <Td className="font-semibold text-slate">{c.site}</Td>
                  <Td className="tabular-nums">{c.leads}</Td>
                  <Td className="tabular-nums">{c.applications}</Td>
                  <Td className="tabular-nums">{c.onboardings}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Configuration" className="mt-[18px]">
        <p className="text-[14.5px] leading-[1.7] text-slate-muted">"Accounts are managed in the portal under People."</p>
      </Panel>
    </AdminShell>
  );
}
