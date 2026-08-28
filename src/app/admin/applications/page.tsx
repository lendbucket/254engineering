import { listApplications } from "@/lib/admin-data";
import { signedDownloadUrl } from "@/lib/uploads";
import { AdminShell, Chip, Panel, TableWrap, Td, Th } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

function when(iso: string) {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Applications, with document links minted at render time.
 *
 * WHY THE LINKS ARE MINTED HERE AND NOT STORED
 * --------------------------------------------
 * eng-uploads is private. A stored URL would either be permanent, which is a
 * document anybody who ever saw the link can read forever, or expired, which is
 * a dead link in a table. Minting on render gives a link that works for the
 * operator looking at the page now and stops working shortly after they leave.
 *
 * The page is force-dynamic for the same reason: a cached render would serve a
 * stale signature to the next request and, worse, could serve one operator's
 * signed URLs from an edge cache.
 */
export default async function AdminApplicationsPage() {
  const rows = await listApplications();

  const withDocs = await Promise.all(
    rows.map(async (r) => {
      const payload = (r.payload ?? {}) as Record<string, { path?: string; filename?: string }>;
      const docs: { label: string; filename: string; url: string | null }[] = [];
      for (const [key, label] of [
        ["resume", "Resume"],
        ["licenseDocument", "Licence"],
        ["certifications", "Certifications"],
      ] as const) {
        const file = payload[key];
        if (file?.path) {
          docs.push({
            label,
            filename: file.filename ?? key,
            url: await signedDownloadUrl(file.path, 60 * 30),
          });
        }
      }
      return { ...r, docs };
    }),
  );

  return (
    <AdminShell
      title="Applications"
      lede={`${rows.length} most recent, newest first. Document links are signed and expire in thirty minutes.`}
    >
      <Panel>
        {withDocs.length === 0 ? (
          <p className="text-[14.5px] text-slate-muted">No applications yet.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Role</Th>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Documents</Th>
              </tr>
            </thead>
            <tbody>
              {withDocs.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap tabular-nums text-slate-muted">{when(a.created_at)}</Td>
                  <Td><Chip status={a.role} /></Td>
                  <Td className="font-semibold text-slate">
                    {a.name}
                    {a.city ? <span className="block font-normal text-slate-muted">{a.city}</span> : null}
                  </Td>
                  <Td>
                    <a href={`mailto:${a.email}`} className="text-slate underline decoration-brass underline-offset-4">
                      {a.email}
                    </a>
                    {a.phone ? <span className="block text-slate-muted">{a.phone}</span> : null}
                  </Td>
                  <Td>
                    {a.docs.length === 0 ? (
                      <span className="text-slate-muted">None</span>
                    ) : (
                      a.docs.map((d) => (
                        <span key={d.label} className="block">
                          {d.url ? (
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[36px] items-center font-semibold text-slate underline decoration-brass underline-offset-4"
                            >
                              {d.label}
                            </a>
                          ) : (
                            <span className="text-slate-muted">{d.label}, link unavailable</span>
                          )}
                        </span>
                      ))
                    )}
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
