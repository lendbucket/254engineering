import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { activationView, listApplications } from "@/lib/ops-onboarding";
import { listOnboardings } from "@/lib/onboarding";
import { TEXAS_COUNTIES } from "@/lib/ops-counties";
import { CREDENTIAL_LABEL, expiryState } from "@/lib/ops-credentials";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { ActivatePanel, CoverageForm, InviteButton, ItemDates } from "./OnboardingClient";

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
  value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "not set";

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
  searchParams: Promise<{ id?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "profiles.create")) notFound();
  const params = await searchParams;

  const [applications, onboardings] = await Promise.all([listApplications(actor), listOnboardings()]);
  const selected = params.id ? await activationView(actor, params.id) : null;

  const invited = new Set(onboardings.map((o) => o.email.toLowerCase()));
  const open = applications.filter((a) => a.email && !invited.has(a.email.toLowerCase()));

  return (
    <>
      <PageHead
        eyebrow="People"
        title="Onboarding"
        lede="From a careers application to somebody dispatch can offer work to. Activation writes the account, the coverage, and the credentials in one act, so the paperwork and the roster cannot drift apart."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <div className={selected ? "hidden lg:block" : "block"}>
          <section aria-labelledby="applications">
            <h2 id="applications" className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
              Applications not yet invited
            </h2>
            <div className="mt-3">
              {open.length === 0 ? (
                <EmptyState
                  title="Nothing waiting"
                  body="Applications from the careers form appear here until somebody is invited to onboard. An application is never deleted; it is the origin record and it carries the attribution the public site captured."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {open.map((a) => (
                    <li key={a.id} className="rounded-[4px] border border-limestone-line bg-white p-4">
                      <p className="text-[14.5px] font-semibold text-slate">{a.name ?? "No name given"}</p>
                      <p className="mt-0.5 text-[13px] text-slate-muted">
                        {a.email}
                        {a.city ? `, ${a.city}` : ""}
                      </p>
                      {a.counties ? (
                        <p className="mt-1 text-[13px] leading-[1.5] text-slate-muted">
                          Says they cover: {a.counties}
                        </p>
                      ) : null}
                      <InviteButton applicationId={a.id} defaultRole={a.role} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="onboardings" className="mt-8">
            <h2 id="onboardings" className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
              In onboarding
            </h2>
            <div className="mt-3">
              {onboardings.length === 0 ? (
                <EmptyState title="Nobody yet" body="Invite somebody from an application above." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {onboardings.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/portal/onboarding?id=${o.id}`}
                        className={`block rounded-[4px] border bg-white p-4 transition-colors hover:border-slate ${
                          selected?.onboarding.id === o.id
                            ? "border-slate border-l-[3px] border-l-brass"
                            : "border-limestone-line"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14.5px] font-semibold text-slate">{o.person_name}</p>
                            <p className="mt-0.5 text-[13px] text-slate-muted">
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
            </div>
          </section>
        </div>

        {selected ? (
          <div>
            <Link
              href="/portal/onboarding"
              className="mb-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-slate-muted lg:hidden"
            >
              Back to the list
            </Link>

            <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white">
              <div className="border-b border-limestone-line px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-[20px] leading-[1.2] font-bold text-slate">
                      {selected.onboarding.person_name}
                    </h2>
                    <p className="mt-1 text-[13.5px] text-slate-muted">
                      {selected.onboarding.email}
                      {selected.onboarding.phone ? `, ${selected.onboarding.phone}` : ""}
                    </p>
                  </div>
                  <Chip
                    label={selected.onboarding.activated_at ? "activated" : selected.onboarding.status.replace(/_/g, " ")}
                    tone={selected.onboarding.activated_at ? "good" : STATUS_TONE[selected.onboarding.status] ?? "neutral"}
                  />
                </div>
              </div>

              <div className="px-4 py-5 sm:px-5">
                <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Checklist</p>
                <ul className="mt-3 divide-y divide-limestone-line">
                  {selected.items.map((item) => (
                    <li key={item.itemKey} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate">{item.label}</p>
                          <p className="mt-0.5 text-[13px] text-slate-muted">
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
                  <div className="mt-7 border-t border-limestone-line pt-5">
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

                <div className="mt-7 border-t border-limestone-line pt-5">
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
