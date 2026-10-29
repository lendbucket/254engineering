import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, roleLabel } from "@/lib/ops-authz";
import { assignableRoles } from "@/lib/ops-roles";
import { readPeople, type Person } from "@/lib/people-roster";
import { PEOPLE_LIST, STAFF_LIST_PAGE_SIZE, staffListPage, staffListQuery, staffListRows } from "@/lib/staff-lists";
import { LIST_EXPORT_GRANT } from "@/lib/list-exports";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { regions } from "@/content/regions";
import {
  Chip,
  EmptyState,
  ErrorState,
  PageHead,
  Panel,
  RecordTable,
  type Column,
} from "@/components/portal/surfaces";
import { NewPersonForm, PersonActions } from "./PeopleClient";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  active: "good",
  invited: "warn",
  suspended: "bad",
} as const;

function when(value: string | null): string {
  if (!value) return "never";
  return (formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? "");
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  /*
   * notFound rather than a redirect, and rather than rendering a denial.
   *
   * A person who cannot administer people has no business knowing this route
   * answers at all. A 403 page confirms the route exists; a 404 says nothing.
   */
  if (!can(actor, "profiles.list")) notFound();

  const params = await searchParams;
  const read = await readPeople();
  const error = read.ok ? null : { message: read.error };
  const query = staffListQuery(params, PEOPLE_LIST);
  const matching = read.ok ? staffListRows(read.rows, query, PEOPLE_LIST) : [];
  const shown = staffListPage(matching, query.page);
  const people = shown.rows;
  const searching = Boolean(query.term || query.filters.status);

  /*
   * The roles that exist, read from the table rather than listed here.
   *
   * The form used to offer admin, engineer and field technician, which were the
   * three that existed before roles became rows. Four of the firm's own roles
   * could not be handed out at all, and a person already holding one showed a
   * blank in the Role column, because the label was a three key map.
   */
  const roles = await assignableRoles();
  const roleName = new Map(roles.map((r) => [r.key, r.name]));

  // The 254 counties, from the same region data the public coverage pages use.
  const counties = [...new Set(regions.flatMap((r) => r.counties))].sort();

  const columns: Column<Person>[] = [
    {
      key: "name",
      head: "Name",
      cell: (p) => (
        <div>
          <p className="font-semibold text-[var(--ink)]">{p.display_name}</p>
          <p className="text-[13px] break-all text-[var(--secondary)]">{p.email}</p>
        </div>
      ),
    },
    { key: "role", head: "Role", cell: (p) => roleLabel(p.role, roleName.get(p.role)) },
    { key: "status", head: "Status", cell: (p) => <Chip label={p.status} tone={STATUS_TONE[p.status]} /> },
    {
      key: "detail",
      head: "Detail",
      wide: true,
      cell: (p) =>
        p.role === "engineer"
          ? p.license_number
            ? `License ${p.license_number}`
            : "No license recorded"
          : p.role === "field_tech"
            ? `${p.coverage_counties.length} counties${p.base_county ? `, based ${p.base_county}` : ""}`
            : "Full access",
    },
    { key: "seen", head: "Last sign in", wide: true, cell: (p) => when(p.last_sign_in_at) },
    {
      key: "actions",
      head: "Actions",
      cell: (p) => <PersonActions person={p} selfId={actor!.id} />,
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Administration"
        title="People"
        lede="Everyone who can sign into the platform. Accounts are created here and nowhere else: there is no self registration and no public sign up."
      />

      <div className="mb-6">
        <NewPersonForm counties={counties} roles={roles} />
      </div>

      <ListControls
        action="/portal/people"
        search={params.q ?? ""}
        searchLabel="Search name, email, phone or county"
        filters={[
          {
            name: "status",
            label: "Status",
            value: query.filters.status,
            options: [
              { value: "", label: "Everyone" },
              { value: "active", label: "Active" },
              { value: "invited", label: "Invited" },
              { value: "suspended", label: "Suspended" },
            ],
          },
        ]}
        sorts={[
          { value: "added", label: "Added" },
          { value: "name", label: "Name" },
          { value: "seen", label: "Last sign in" },
        ]}
        sort={query.sort}
        direction={query.ascending ? "asc" : "desc"}
        csvHref={can(actor, LIST_EXPORT_GRANT) ? listHref("/api/portal/exports", { q: params.q, status: params.status, sort: params.sort, dir: params.dir }, { report: "people" }) : undefined}
      />

      {error ? (
        <ErrorState
          title="The roster could not be loaded"
          body={`The database returned: ${error.message}. Nothing has been changed.`}
        />
      ) : (
        <Panel title={searching ? `${shown.total} matching of ${read.ok ? read.rows.length : 0}` : `${shown.total} ${shown.total === 1 ? "person" : "people"}`}>
          <RecordTable
            rows={people}
            columns={columns}
            empty={
              searching ? (
                <EmptyState title="Nobody matches that search" body="Clear the search or show everyone." />
              ) : (
                <EmptyState
                  title="Nobody has an account yet"
                  body="Add the first person above. They receive a branded invite with a one time link and choose their own password, which nobody at the firm can see."
                />
              )
            }
            card={(p) => (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--ink)]">{p.display_name}</p>
                    <p className="mt-0.5 text-[14px] break-all text-[var(--secondary)]">{p.email}</p>
                  </div>
                  <Chip label={p.status} tone={STATUS_TONE[p.status]} />
                </div>
                <p className="mt-2 portal-label">
                  {roleLabel(p.role, roleName.get(p.role))}
                </p>
                <p className="mt-1 text-[14px] text-[var(--secondary)]">Last sign in {when(p.last_sign_in_at)}</p>
                <div className="mt-3">
                  <PersonActions person={p} selfId={actor!.id} />
                </div>
              </div>
            )}
          />
          <Pager page={shown.page} pageSize={STAFF_LIST_PAGE_SIZE} total={shown.total} hrefFor={(n) => listHref("/portal/people", params, { page: n > 1 ? String(n) : "" })} />
        </Panel>
      )}
    </>
  );
}
