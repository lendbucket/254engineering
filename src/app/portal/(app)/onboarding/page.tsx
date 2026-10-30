import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { mayOpenOnboarding } from "@/lib/onboarding-scope";
import { APPLICATION_READ_LIMIT, activationView, listApplications } from "@/lib/ops-onboarding";
import { ONBOARDING_PAGE_SIZE, countOnboardings, listOnboardingsPage, onboardedEmails } from "@/lib/onboarding";
import { onboardingListQuery } from "@/lib/onboarding-list";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { TEXAS_COUNTIES } from "@/lib/ops-counties";
import { CREDENTIAL_LABEL, expiryState } from "@/lib/ops-credentials";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { ActivatePanel, CoverageForm, InviteButton, ItemDates } from "./OnboardingClient";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * The applicant to dispatchable path, on one screen.
 *
 * WHY IT IS ONE SCREEN AND NOT FOUR
 * ---------------------------------
 * Before this, the path was: read an application in one place, create an
 * onboarding in another, watch documents arrive in a third, then create an
 * account by hand in a fourth and retype the coverage counties from memory.
 * Every hand off was a place where the paperwork and the dispatchable roster
 * drift apart, and the drift is invisible until somebody turns up at a property
 * uninsured.
 *
 * The whole path is here because the whole path is one decision: is this person
 * ready to be sent to a stranger's house.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * There is no field on this screen for a social security number, a date of
 * birth, or a bank account number, and there is no column behind it for one. The
 * W-9 and the I-9 arrive as uploaded documents and are never read. The firm
 * needs the completed form; it does not need the number off the form, and those
 * are different obligations.
 */

const when = (value: string | null) =>
  value ? (formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? "") : "not set";

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  invited: "warn",
  in_progress: "warn",
  submitted: "warn",
  verified: "good",
  complete: "good",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; q?: string; status?: string; role?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const actor = await currentActor();
  if (!mayOpenOnboarding(actor, "profiles.create")) notFound();
  const params = await searchParams;

  /*
   * technicians.onboard without profiles.create sees field technicians only,
   * 2026-10-20. The server refuses everything else for that grant; the screen
   * does not offer what the server would refuse. The list query applies the
   * same scope, so the page and its count are both of what this grant may see.
   */
  const technicianOnly = !can(actor, "profiles.create");

  /*
   * OFFICE READY, Robert's ruling of 10:52 Central 2026-10-29: the onboarding
   * list searches, filters, sorts and pages in the database, with the query in
   * the address, read by the same functions as its count.
   */
  const query = onboardingListQuery(params);
  const scope = { fieldTechOnly: technicianOnly };
  const [allApplications, invited, onboardings, total] = await Promise.all([
    listApplications(actor),
    onboardedEmails(),
    listOnboardingsPage(query, scope),
    countOnboardings(query, scope),
  ]);
  const applications =
    allApplications === null
      ? null
      : technicianOnly
        ? allApplications.filter((a) => !(a.role ?? "").toLowerCase().includes("engineer"))
        : allApplications;
  const selected = params.id ? await activationView(actor, params.id) : null;
  const filtered = Boolean(query.term) || query.status !== "all" || query.role !== "all";

  /* Which applications are not yet invited needs both reads; either failing is said. */
  const open =
    applications === null || invited === null
      ? null
      : applications.filter((a) => a.email && !invited.has(a.email.toLowerCase()));
  const listParams = { q: params.q, status: params.status, role: params.role, sort: params.sort, dir: params.dir, page: params.page };

  return (
    <>
      <PageHead
        eyebrow="People"
        title="Onboarding"
        lede="From a careers application to somebody dispatch can offer work to. Activation writes the account, the coverage, and the credentials in one act, so the paperwork and the roster cannot drift apart."
      />

      <ListControls
        action="/portal/onboarding"
        search={params.q ?? ""}
        searchLabel="Search onboarding by name, email or phone"
        filters={[
          {
            name: "status",
            label: "Status",
            value: query.status,
            options: [
              { value: "all", label: "Every status" },
              { value: "invited", label: "Invited" },
              { value: "in_progress", label: "In progress" },
              { value: "submitted", label: "Submitted" },
              { value: "verified", label: "Verified" },
              { value: "complete", label: "Complete" },
            ],
          },
          ...(technicianOnly
            ? []
            : [
                {
                  name: "role",
                  label: "Role",
                  value: query.role,
                  options: [
                    { value: "all", label: "Everyone" },
                    { value: "field_tech", label: "Field technicians" },
                    { value: "engineer", label: "Engineers" },
                  ],
                },
              ]),
        ]}
        sorts={[{ value: "invited", label: "Invited" }, { value: "name", label: "Name" }]}
        sort={query.sort}
        direction={query.ascending ? "asc" : "desc"}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <div className={selected ? "hidden lg:block" : "block"}>
          <section aria-labelledby="applications">
            <h2 id="applications" className="portal-label">
              Applications not yet invited
            </h2>
            <div className="mt-3">
              {open === null ? (
                <EmptyState
                  title="The applications could not be read"
                  body="This is a failed read, not an empty list. Reload the page; if it still fails, the server log names the cause."
                />
              ) : open.length === 0 ? (
                <EmptyState
                  title="Nothing waiting"
                  body="Applications from the careers form appear here until somebody is invited to onboard. An application is never deleted; it is the origin record and it carries the attribution the public site captured."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {open.map((a) => (
                    <li key={a.id} className="border-b border-[var(--row-rule)] py-3">
                      <p className="text-[14px] font-semibold text-[var(--ink)]">{a.name ?? "No name given"}</p>
                      <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                        {a.email}
                        {a.city ? `, ${a.city}` : ""}
                      </p>
                      {a.counties ? (
                        <p className="mt-1 text-[14px] leading-[1.5] text-[var(--secondary)]">
                          Says they cover: {a.counties}
                        </p>
                      ) : null}
                      <InviteButton applicationId={a.id} defaultRole={a.role} technicianOnly={technicianOnly} />
                    </li>
                  ))}
                </ul>
              )}
              {allApplications !== null && allApplications.length === APPLICATION_READ_LIMIT ? (
                <p className="mt-3 text-[14px] leading-[1.5] text-[var(--secondary)]">
                  This reads the newest {APPLICATION_READ_LIMIT} applications. An older one is reached on the applications screen.
                </p>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="onboardings" className="mt-8">
            <h2 id="onboardings" className="portal-label">
              {total === null
                ? "In onboarding; the total could not be read"
                : `In onboarding: ${total} ${filtered ? "matching" : total === 1 ? "person" : "people"}`}
            </h2>
            <div className="mt-3">
              {onboardings === null ? (
                <EmptyState
                  title="The onboarding list could not be read"
                  body="This is a failed read, not an empty list. Reload the page; if it still fails, the server log names the cause."
                />
              ) : onboardings.length === 0 ? (
                filtered ? (
                  <EmptyState title="Nobody matches that search" body="Clear the search or the filters to see everyone in onboarding." />
                ) : (
                  <EmptyState title="Nobody yet" body="Invite somebody from an application above." />
                )
              ) : (
                <ul className="flex flex-col gap-2">
                  {onboardings.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={listHref("/portal/onboarding", listParams, { id: o.id })}
                        className={`block ${selected?.onboarding.id === o.id ? "border-l-[length:var(--active-bar-width)] border-l-[var(--navy)] pl-3" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[var(--ink)]">{o.person_name}</p>
                            <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                              {o.role === "field_tech" ? "Field technician" : "Engineer"}, invited {when(o.invited_at)}
                            </p>
                          </div>
                          <Chip label={o.status.replace(/_/g, " ")} tone={STATUS_TONE[o.status] ?? "neutral"} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {total !== null && onboardings !== null ? (
                <Pager
                  page={query.page}
                  pageSize={ONBOARDING_PAGE_SIZE}
                  total={total}
                  hrefFor={(n) => listHref("/portal/onboarding", listParams, { page: String(n) })}
                />
              ) : null}
            </div>
          </section>
        </div>

        {selected ? (
          <div>
            <Link
              href={listHref("/portal/onboarding", listParams, {})}
              className="mb-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--secondary)] lg:hidden"
            >
              Back to the list
            </Link>

            <div className="border-t-2 border-[var(--ink)]">
              <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-[17px] leading-[1.2] font-bold text-[var(--ink)]">
                      {selected.onboarding.person_name}
                    </h2>
                    <p className="mt-1 text-[14px] text-[var(--secondary)]">
                      {selected.onboarding.email}
                      {selected.onboarding.phone ? <>, <PhoneLink phone={selected.onboarding.phone} /></> : ""}
                    </p>
                  </div>
                  <Chip
                    label={selected.onboarding.activated_at ? "activated" : selected.onboarding.status.replace(/_/g, " ")}
                    tone={selected.onboarding.activated_at ? "good" : STATUS_TONE[selected.onboarding.status] ?? "neutral"}
                  />
                </div>
              </div>

              <div className="px-4 py-5 sm:px-5">
                <p className="portal-label">Checklist</p>
                <ul className="mt-3 divide-y divide-limestone-line">
                  {selected.items.map((item) => (
                    <li key={item.itemKey} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[var(--ink)]">{item.label}</p>
                          <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                            {item.actor === "admin" ? "Operator verified" : "Uploaded by the applicant"}
                            {item.credentialKind
                              ? `, becomes ${CREDENTIAL_LABEL[item.credentialKind as keyof typeof CREDENTIAL_LABEL] ?? item.credentialKind}`
                              : ""}
                          </p>
                        </div>
                        <Chip
                          label={item.status}
                          tone={
                            item.status === "accepted"
                              ? "good"
                              : item.status === "rejected"
                                ? "bad"
                                : item.status === "uploaded"
                                  ? "warn"
                                  : "neutral"
                          }
                        />
                      </div>

                      {/*
                        * Only documents that HAVE an expiry get the date
                        * fields. A W-9 and a signed contractor agreement do not
                        * expire, and asking for a date that does not exist is
                        * asking somebody to invent one or to conclude the form
                        * is broken. Same class as an optional checklist item
                        * that says "Needs a note".
                        */}
                      {item.credentialKind && item.expires ? (
                        <ItemDates
                          onboardingId={selected.onboarding.id}
                          itemKey={item.itemKey}
                          label={item.label}
                          issuedOn={item.issuedOn}
                          expiresOn={item.expiresOn ?? null}
                          state={expiryState(item.expiresOn)}
                          locked={Boolean(selected.onboarding.activated_at)}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>

                {selected.onboarding.role === "field_tech" ? (
                  <div className="mt-7 border-t border-[var(--border)] pt-5">
                    <CoverageForm
                      onboardingId={selected.onboarding.id}
                      counties={selected.onboarding.coverage_counties}
                      baseCity={selected.onboarding.base_city}
                      baseCounty={selected.onboarding.base_county}
                      allCounties={TEXAS_COUNTIES}
                      locked={Boolean(selected.onboarding.activated_at)}
                    />
                  </div>
                ) : null}

                <div className="mt-7 border-t border-[var(--border)] pt-5">
                  <ActivatePanel
                    onboardingId={selected.onboarding.id}
                    ready={selected.readiness.ready}
                    blockers={selected.readiness.blockers}
                    activatedAt={selected.onboarding.activated_at}
                    profileId={selected.onboarding.profile_id}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block">
            <EmptyState
              title="Nobody selected"
              body="Choose somebody from the list to see their checklist, record document expiry dates, set their coverage, and activate them."
            />
          </div>
        )}
      </div>
    </>
  );
}
