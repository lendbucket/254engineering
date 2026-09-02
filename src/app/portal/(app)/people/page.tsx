import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, ROLE_LABEL, type Role } from "@/lib/ops-authz";
import { supabaseAdmin } from "@/lib/supabase";
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

export const dynamic = "force-dynamic";

type Person = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: "invited" | "active" | "suspended";
  phone: string | null;
  license_number: string | null;
  base_county: string | null;
  coverage_counties: string[];
  last_sign_in_at: string | null;
  created_at: string;
};

const STATUS_TONE = {
  active: "good",
  invited: "warn",
  suspended: "bad",
} as const;

function when(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PeoplePage() {
  const actor = await currentActor();
  /*
   * notFound rather than a redirect, and rather than rendering a denial.
   *
   * A person who cannot administer people has no business knowing this route
   * answers at all. A 403 page confirms the route exists; a 404 says nothing.
   */
  if (!can(actor, "profiles.list")) notFound();

  const db = supabaseAdmin();
  const { data, error } = db
    ? await db
        .from("eng_profiles")
        .select(
          "id, email, display_name, role, status, phone, license_number, base_county, coverage_counties, last_sign_in_at, created_at",
        )
        .order("created_at", { ascending: false })
    : { data: null, error: { message: "The database is not configured." } };

  const people = (data ?? []) as Person[];

  // The 254 counties, from the same region data the public coverage pages use.
  const counties = [...new Set(regions.flatMap((r) => r.counties))].sort();

  const columns: Column<Person>[] = [
    {
      key: "name",
      head: "Name",
      cell: (p) => (
        <div>
          <p className="font-semibold text-slate">{p.display_name}</p>
          <p className="text-[12.5px] break-all text-slate-muted">{p.email}</p>
        </div>
      ),
    },
    { key: "role", head: "Role", cell: (p) => ROLE_LABEL[p.role] },
    { key: "status", head: "Status", cell: (p) => <Chip label={p.status} tone={STATUS_TONE[p.status]} /> },
    {
      key: "detail",
      head: "Detail",
      wide: true,
      cell: (p) =>
        p.role === "engineer"
          ? p.license_number
            ? `Licence ${p.license_number}`
            : "No licence recorded"
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
        <NewPersonForm counties={counties} />
      </div>

      {error ? (
        <ErrorState
          title="The roster could not be loaded"
          body={`The database returned: ${error.message}. Nothing has been changed.`}
        />
      ) : (
        <Panel title={`${people.length} ${people.length === 1 ? "person" : "people"}`}>
          <RecordTable
            rows={people}
            columns={columns}
            empty={
              <EmptyState
                title="Nobody has an account yet"
                body="Add the first person above. They receive a branded invite with a one time link and choose their own password, which nobody at the firm can see."
              />
            }
            card={(p) => (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate">{p.display_name}</p>
                    <p className="mt-0.5 text-[13px] break-all text-slate-muted">{p.email}</p>
                  </div>
                  <Chip label={p.status} tone={STATUS_TONE[p.status]} />
                </div>
                <p className="mt-2 text-[12.5px] font-bold tracking-[0.08em] text-brass-ink uppercase">
                  {ROLE_LABEL[p.role]}
                </p>
                <p className="mt-1 text-[13px] text-slate-muted">Last sign in {when(p.last_sign_in_at)}</p>
                <div className="mt-3">
                  <PersonActions person={p} selfId={actor!.id} />
                </div>
              </div>
            )}
          />
        </Panel>
      )}
    </>
  );
}
