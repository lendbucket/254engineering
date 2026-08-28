import { listLeads } from "@/lib/admin-data";
import { AdminShell, Chip, Panel, TableWrap, Td, Th } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

function when(iso: string) {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminLeadsPage() {
  const leads = await listLeads();
  return (
    <AdminShell
      title="Leads"
      lede={`${leads.length} most recent, newest first. Contact and waitlist submissions across every site.`}
    >
      <Panel>
        {leads.length === 0 ? (
          <p className="text-[14.5px] text-slate-muted">No leads yet.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Site</Th>
                <Th>Form</Th>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Interest</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap tabular-nums text-slate-muted">{when(l.created_at)}</Td>
                  <Td>{l.site}</Td>
                  <Td><Chip status={l.form} /></Td>
                  <Td className="font-semibold text-slate">{l.name}</Td>
                  <Td>
                    <a href={`mailto:${l.email}`} className="text-slate underline decoration-brass underline-offset-4">
                      {l.email}
                    </a>
                    {l.phone ? <span className="block text-slate-muted">{l.phone}</span> : null}
                    {l.city ? <span className="block text-slate-muted">{l.city}</span> : null}
                  </Td>
                  <Td className="max-w-[28rem]">
                    {l.service ? <span className="block font-medium">{l.service}</span> : null}
                    {l.message ? <span className="block text-slate-muted">{l.message}</span> : null}
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
