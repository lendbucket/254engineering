import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listClients } from "@/lib/ops-crm";
import { supabaseAdmin } from "@/lib/supabase";
import { TEXAS_COUNTIES } from "@/lib/ops-counties";
import { services } from "@/content/services";
import {
  Chip,
  EmptyState,
  PageHead,
  Panel,
  RecordTable,
  type Column,
} from "@/components/portal/surfaces";
import { NewClientForm, ConvertLead } from "./ClientsClient";

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  created_at: string;
  site: string;
  form: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  service: string | null;
  message: string | null;
  status: string;
  utm_source: string | null;
};

function when(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientsPage() {
  const actor = await currentActor();
  if (!can(actor, "clients.list")) notFound();

  const clients = await listClients(actor);

  /*
   * Unconverted leads, from the table the three public sites already write to.
   *
   * This is the whole point of conversion being one action: the leads are
   * already here, they have been since the sites launched, and until now the
   * only thing anybody could do with them was read them.
   */
  const db = supabaseAdmin();
  const { data: leadRows } = can(actor, "clients.create") && db
    ? await db
        .from("eng_leads")
        .select("id, created_at, site, form, name, email, phone, company, city, service, message, status, utm_source")
        .neq("status", "converted")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: null };
  const leads = (leadRows ?? []) as Lead[];

  const columns: Column<(typeof clients)[number]>[] = [
    {
      key: "name",
      head: "Client",
      cell: (c) => (
        <div>
          <p className="font-semibold text-[var(--navy)]">{c.name}</p>
          <p className="text-[12.5px] text-[var(--secondary)]">
            {c.kind === "organization" ? "Organization" : "Individual"}
            {c.client_type ? `, ${c.client_type.replace(/_/g, " ")}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "contact",
      head: "Contact",
      cell: (c) => (
        <div className="text-[13.5px] text-[var(--secondary)]">
          {c.email ? <p className="break-all">{c.email}</p> : null}
          {c.phone ? <p>{c.phone}</p> : null}
          {!c.email && !c.phone ? "none recorded" : null}
        </div>
      ),
    },
    { key: "city", head: "City", wide: true, cell: (c) => c.city ?? "" },
    {
      key: "source",
      head: "Source",
      wide: true,
      cell: (c) =>
        c.converted_from_lead_id
          ? `converted lead${c.source_site ? ` (${c.source_site})` : ""}`
          : c.utm_source
            ? c.utm_source
            : "added directly",
    },
    { key: "added", head: "Added", cell: (c) => when(c.created_at) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Relationships"
        title="Clients"
        lede="Organizations and individuals, and the leads the public sites have already captured."
      />

      {can(actor, "clients.create") ? (
        <div className="mb-6">
          <NewClientForm />
        </div>
      ) : null}

      {can(actor, "clients.create") ? (
        <Panel
          className="mb-6"
          title={`${leads.length} lead${leads.length === 1 ? "" : "s"} waiting`}
          description="Captured by the three public sites. Converting one creates a client and a file and keeps the original record linked."
        >
          {leads.length === 0 ? (
            <EmptyState
              title="No unconverted leads"
              body="Enquiries from 254engineering.com, sealedengineering.com, and stampmyplans.com land here as they arrive."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {leads.map((lead) => (
                <li key={lead.id} className="rounded-[4px] border border-[var(--border)] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--navy)]">
                        {lead.company || lead.name || "Unnamed enquirer"}
                      </p>
                      <p className="mt-0.5 text-[13.5px] break-all text-[var(--secondary)]">
                        {[lead.email, lead.phone, lead.city].filter(Boolean).join("  ")}
                      </p>
                      {lead.message ? (
                        <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                          {lead.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Chip label={lead.site} />
                      <span className="text-[12px] text-[var(--secondary)]">{when(lead.created_at)}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ConvertLead
                      lead={lead}
                      services={services.map((s) => ({ slug: s.slug, name: s.name }))}
                      counties={TEXAS_COUNTIES}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <Panel title={`${clients.length} client${clients.length === 1 ? "" : "s"}`}>
        <RecordTable
          rows={clients}
          columns={columns}
          empty={
            <EmptyState
              title="No clients yet"
              body="Add one above, or convert a lead. A file belongs to a client, so this comes first."
            />
          }
          card={(c) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--navy)]">{c.name}</p>
                  <p className="mt-0.5 text-[13.5px] break-all text-[var(--secondary)]">
                    {c.email ?? c.phone ?? "no contact recorded"}
                  </p>
                </div>
                <Chip label={c.kind === "organization" ? "Org" : "Person"} />
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--secondary)]">
                {c.city ? `${c.city}  ` : ""}
                added {when(c.created_at)}
              </p>
            </div>
          )}
        />
      </Panel>

      <p className="mt-6 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
        Files live on the{" "}
        <Link href="/portal/files" className="underline underline-offset-2">
          files screen
        </Link>
        . Contacts under an organization, and the per client activity timeline, arrive with the rest
        of the CRM.
      </p>
    </>
  );
}
