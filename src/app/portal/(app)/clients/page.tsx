import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { CLIENT_PAGE_SIZE, countClients, listClients } from "@/lib/ops-crm";
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
import { formatInFirmZone } from "@/lib/firm-calendar";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { clientListQuery } from "@/lib/client-list";

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
  return (formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? "");
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!can(actor, "clients.list")) notFound();
  const params = await searchParams;

  /*
   * ONE BOUNDED PAGE, AND AN EXACT COUNT BESIDE IT.
   *
   * The count is a separate read rather than the length of this one, because
   * the length of a bounded read is the bound and reporting it as the total is
   * the defect CLAUDE.md records at PostgREST's 1000 row ceiling and at a
   * queue of 668 reported as 20.
   *
   * Office ready, 2026-10-24: searched, filtered, sorted and paged in the
   * database by one query, which the count reads too, so the total is of the
   * clients that match and every one of them is reachable by paging.
   */
  const query = clientListQuery(params);
  const clients = await listClients(actor, { limit: CLIENT_PAGE_SIZE, offset: (query.page - 1) * CLIENT_PAGE_SIZE, query });
  const total = await countClients(actor, query);
  const filtered = query.term !== "" || query.kind !== "all";

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
          <p className="font-semibold">
            <Link href={`/portal/clients/${c.id}`} className="text-[var(--navy)] underline">{c.name}</Link>
          </p>
          <p className="text-[13px] text-[var(--secondary)]">
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
        <div className="text-[14px] text-[var(--secondary)]">
          {c.email ? <p className="break-all">{c.email}</p> : null}
          {c.phone ? <p><PhoneLink phone={c.phone} /></p> : null}
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
                <li key={lead.id} className="border-b border-[var(--row-rule)] py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--ink)]">
                        {lead.company || lead.name || "Unnamed enquirer"}
                      </p>
                      <p className="mt-0.5 text-[14px] break-all text-[var(--secondary)]">
                        {lead.email ? `${lead.email}  ` : ""}
                        <PhoneLink phone={lead.phone} />
                        {lead.city ? <>{lead.phone ? "  " : ""}{lead.city}</> : ""}
                      </p>
                      {lead.message ? (
                        <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
                          {lead.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Chip label={lead.site} />
                      <span className="text-[12px] text-[var(--secondary)]">{when(lead.created_at)}</span>
                    </div>
                  </div>
                  {/* A converted lead opens a job with no payment step, which is admin only (owner ruling 2026-10-20). */}
                  {!can(actor, "payments.charge") ? (
                    <p className="mt-3 text-[14px] text-[var(--secondary)]">
                      Take this as a job from New job, which sends the payment link.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <ConvertLead
                        lead={lead}
                        services={services.map((s) => ({ slug: s.slug, name: s.name }))}
                        counties={TEXAS_COUNTIES}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {/*
        THE PANEL TITLE STATES WHAT IS ON SCREEN AND WHAT IT IS PART OF.

        It used to read "255 clients", which was the length of the read rather
        than the size of the client base, and the two were the same number only
        because nothing had a bound. `native-audit` refuses a portal list over
        250 rows and named this screen on three boards.

        A BOUND WITHOUT A DISCLOSURE WOULD HAVE BEEN THE WORSE FIX. "100
        clients" on a firm with 260 is a false statement about the business, and
        a coordinator who scrolls to the bottom and does not find somebody
        concludes the client is not there. So the screen says both figures.
        Since 2026-10-24 the rest are reached by search and paging below.

        `total` is null when the count could not be read, which is a different
        thing from zero, so the title falls back to what it can honestly say.
      */}
      <ListControls
        action="/portal/clients"
        search={params.q ?? ""}
        searchLabel="Search name, email, phone or city"
        filters={[
          {
            name: "kind",
            label: "Kind",
            value: query.kind,
            options: [
              { value: "all", label: "Everyone" },
              { value: "organization", label: "Organizations" },
              { value: "individual", label: "Individuals" },
            ],
          },
        ]}
        sorts={[{ value: "added", label: "Added" }, { value: "name", label: "Name" }]}
        sort={query.sort}
        direction={query.ascending ? "asc" : "desc"}
        csvHref={listHref("/api/portal/clients/export", { q: params.q, kind: params.kind, sort: params.sort, dir: params.dir }, {})}
      />
      <Panel
        title={
          total === null
            ? `${clients.length} client${clients.length === 1 ? "" : "s"} shown; the total could not be read`
            : `${total} ${filtered ? "matching " : ""}client${total === 1 ? "" : "s"}`
        }
      >
        <RecordTable
          rows={clients}
          columns={columns}
          empty={
            filtered ? (
              <EmptyState title="No client matches that search" body="Clear the search or the filter to see everyone." />
            ) : (
              <EmptyState
                title="No clients yet"
                body="Add one above, or convert a lead. A file belongs to a client, so this comes first."
              />
            )
          }
          card={(c) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--ink)]">{c.name}</p>
                  <p className="mt-0.5 text-[14px] break-all text-[var(--secondary)]">
                    {c.email ?? c.phone ?? "no contact recorded"}
                  </p>
                </div>
                <Chip label={c.kind === "organization" ? "Org" : "Person"} />
              </div>
              <p className="mt-2 text-[13px] text-[var(--secondary)]">
                {c.city ? `${c.city}  ` : ""}
                added {when(c.created_at)}
              </p>
            </div>
          )}
        />
        {total !== null ? (
          <Pager page={query.page} pageSize={CLIENT_PAGE_SIZE} total={total} hrefFor={(n) => listHref("/portal/clients", params, { page: String(n) })} />
        ) : null}
      </Panel>

      <p className="mt-6 text-[14px] leading-[1.6] text-[var(--secondary)]">
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
