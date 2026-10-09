import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, holdsLicence } from "@/lib/ops-authz";
import { checkFor, listProtocols } from "@/lib/ops-field";
import { certificationLabel } from "@/lib/ops-certification";
import { credentialsFor } from "@/lib/ops-onboarding";
import { CREDENTIAL_LABEL, credentialBlockers, credentialStanding, exemptKindsFor } from "@/lib/ops-credentials";
import { submissionsFor, submittableKindsFor, US_STATES } from "@/lib/ops-credential-submissions";
import { calendarDateLabel, firmDateLabel } from "@/lib/firm-calendar";
import { protocolForLine } from "@/content/protocols";
import { services } from "@/content/services";
import { supabaseAdmin } from "@/lib/supabase";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { CheckRunner } from "./CertificationClient";
import { SubmitCredentialForm } from "./SubmitCredentialForm";

export const dynamic = "force-dynamic";

/**
 * The technician's own certification screen.
 *
 * TWO THINGS ON ONE PAGE, AND THEY ARE THE TWO GATES
 * --------------------------------------------------
 * Paperwork and knowledge. A technician who cannot understand why they are not
 * being offered work needs both answers in the same place, because from where
 * they sit "no jobs" looks identical whether the cause is a lapsed insurance
 * card or an unfinished check. Splitting them across two screens is how somebody
 * spends a week thinking the platform is quiet.
 *
 * THE CHECK IS OPEN BOOK BY DESIGN
 * --------------------------------
 * The protocol is rendered above the questions. The point is that the technician
 * knows where to look and what the engineer expects, not that they memorised it
 * in a room with no phone. On a roof they will have this page open.
 *
 * UNBLOCKED, operator ruling of 2026-10-09 (fix/certification-unblock):
 *   1. the technician submits each required credential themselves, the type,
 *      issuing state and expiry only, and it waits for an operator to verify it
 *      on /portal/techs; dispatch counts only verified, current credentials;
 *   2. a line reads "Certified" only when dispatchable, and otherwise
 *      "Certified, not dispatchable:" with each blocking credential by name;
 *   3. certified on, each expiry and verified on are shown, in Central time;
 *   4. the protocol is named from the register, never from a stored title;
 *   5. "How the check works" shows, with its link, only when there is a check to
 *      take or retake.
 */
export default async function CertificationPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const actor = await currentActor();
  /*
   * THE GRANT DECIDES, AND THE ROLE NAME USED TO GET A SECOND VOTE.
   *
   * This read: !can(actor, "evidence.capture") && actor?.role !== "admin".
   *
   * Operator ruling, 2026-09-10: grants decide, and a role-name check is a
   * grant nobody can revoke. Every permission on this platform has been data
   * since 0018, which means an owner can take a capability away on the
   * permission screen. A string comparison in a page is a capability that
   * screen cannot see and cannot withdraw.
   *
   * It was found overnight by walking every screen as each of the seven roles
   * and opening one the shell did NOT offer. nav.ts gates this destination on
   * evidence.capture, which only field_tech holds, so an administrator was
   * never shown the link, and the page opened for them anyway at HTTP 200. The
   * capability existed and nothing offered it: reachable only by typing the URL.
   *
   * Two other things the escape hatch cost. Roles are DATA, so renaming the
   * administrator role on the roles screen would have broken this comparison
   * silently, and the failure would have been a screen that stopped opening
   * rather than an error anybody sees. And it was a second authorization model
   * in one line, which is what nav.ts's own header argues against for the nav.
   *
   * If an administrator should see this screen, that is a grant they should
   * hold and a NAV entry they should be offered.
   */
  if (!can(actor, "evidence.capture")) notFound();
  const params = await searchParams;

  const db = supabaseAdmin();
  const templates = await listProtocols(actor);
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;

  /*
   * Which service lines have a published protocol at all. A technician cannot
   * certify against a service line the firm has not written a protocol for, and
   * saying so is better than an empty list.
   */
  const published = db
    ? ((
        await db
          .from("eng_protocol_templates")
          .select("service_slug")
          .eq("status", "published")
      ).data ?? [])
    : [];
  const lines = [...new Set(published.map((p) => p.service_slug as string))];

  const certRows = db
    ? ((
        await db
          .from("eng_certifications")
          .select("service_slug, status, template_id, score, attempts, certified_at")
          .eq("profile_id", actor!.id)
      ).data ?? [])
    : [];

  /* The version each certification was TAKEN against, read off the protocol row it names. */
  const templateIds = certRows.map((c) => c.template_id as string | null).filter((x): x is string => Boolean(x));
  const takenAgainst = new Map<string, string>();
  if (db && templateIds.length) {
    const { data } = await db.from("eng_protocol_templates").select("id, version_label").in("id", templateIds);
    for (const t of data ?? []) takenAgainst.set(t.id as string, String(t.version_label));
  }

  const certBy = new Map(
    certRows.map((c) => [
      c.service_slug as string,
      {
        serviceSlug: c.service_slug as string,
        status: c.status as "in_progress" | "certified" | "failed" | "revoked",
        templateId: (c.template_id as string | null) ?? null,
        score: (c.score as number | null) ?? null,
        attempts: (c.attempts as number) ?? 0,
        certifiedAt: (c.certified_at as string | null) ?? null,
      },
    ]),
  );

  /*
   * THE PROTOCOL, FROM THE REGISTER. Operator ruling of 2026-10-09: name and
   * version come from src/content/protocols, never from a stored title. The
   * version in force is the one with no supersession date.
   */
  const fromRegister = (slug: string) => {
    const entry = protocolForLine(slug);
    if (!entry) return null;
    const current = entry.versions.find((v) => v.supersededOn === null) ?? entry.versions[entry.versions.length - 1];
    return { documentNumber: entry.declaration.documentNumber, version: current.version, title: entry.declaration.title };
  };

  const held = (await credentialsFor([actor!.id])).get(actor!.id) ?? [];
  const exempt = exemptKindsFor(actor!.email);
  const paperwork = credentialBlockers(held, new Date(), exempt);
  const standing = credentialStanding(held, new Date(), exempt);
  const mine = await submissionsFor(actor!.id);

  /*
   * WHY A CERTIFIED LINE CANNOT BE DISPATCHED, by name. A missing credential is
   * named alone; one that is waiting or lapsed says so, because the next step is
   * different (submit, wait, or renew).
   */
  const stateOf = new Map(standing.map((s) => [s.kind, s.state]));
  const blockingNames = paperwork.map((b) => {
    const label = CREDENTIAL_LABEL[b.kind];
    const state = stateOf.get(b.kind);
    return state === "unverified" ? `${label} (awaiting verification)` : state === "expired" ? `${label} (expired)` : label;
  });
  const lineStatus = (cert: ReturnType<typeof certBy.get> | null) => {
    if (cert?.status !== "certified") return certificationLabel(cert ?? null);
    return blockingNames.length === 0 ? "Certified" : `Certified, not dispatchable: ${blockingNames.join(", ")}`;
  };

  /* A check to take or retake: a line with a protocol that is not certified and not revoked. */
  const toTake = lines.filter((slug) => {
    const cert = certBy.get(slug);
    return cert?.status !== "certified" && cert?.status !== "revoked";
  });

  const active = params.service ? await checkFor(actor, params.service) : null;

  return (
    <>
      <PageHead
        eyebrow="Field"
        title="Certification"
        lede="What you are certified to work, and what your paperwork says. Both have to be in order before a job can reach you."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,380px)]">
        <div>
          {active ? (
            <CheckRunner
              serviceSlug={active.serviceSlug}
              serviceName={serviceName(active.serviceSlug)}
              protocolName={(() => {
                const reg = fromRegister(active.serviceSlug);
                return reg ? `${reg.documentNumber} v${reg.version}` : "No protocol in the register";
              })()}
              items={active.items.map((i) => ({
                id: i.id,
                label: i.label,
                kind: i.kind,
                required: i.required,
                instructions: i.instructions ?? null,
                minCount: i.minCount ?? null,
                unit: i.unit ?? null,
                minValue: i.minValue ?? null,
                maxValue: i.maxValue ?? null,
              }))}
              questions={active.questions}
              blocked={active.attemptable.ok ? null : active.attemptable.reason}
            />
          ) : (
            <section aria-labelledby="lines">
              <h2 id="lines" className="portal-label">
                Service lines
              </h2>
              <div className="mt-3">
                {lines.length === 0 ? (
                  <EmptyState
                    title="No protocols published yet"
                    body="A service line becomes certifiable when an engineer publishes a protocol for it. Until then there is nothing to be certified against, which is why nothing is listed here."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {lines.map((slug) => {
                      const cert = certBy.get(slug) ?? null;
                      const certified = cert?.status === "certified";
                      const reg = fromRegister(slug);
                      const taken = cert?.templateId ? takenAgainst.get(cert.templateId) ?? null : null;
                      return (
                        <li key={slug} className="border-b border-[var(--row-rule)] py-4">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-[var(--ink)]">{serviceName(slug)}</p>
                            <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                              {reg ? `${reg.documentNumber} v${reg.version}` : "No protocol in the register for this line"}
                            </p>
                            <p className="mt-2 text-[14px] font-semibold text-[var(--ink)]">{lineStatus(cert)}</p>
                          </div>

                          {certified ? (
                            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--secondary)]">
                              Certified on {firmDateLabel(cert?.certifiedAt) ?? "a date not recorded"}
                              {taken ? `, against v${taken}` : ""}
                              {reg && taken && taken !== reg.version ? `. The version in force is v${reg.version}.` : "."}
                            </p>
                          ) : cert?.status === "revoked" ? (
                            <p className="mt-3 text-[14px] leading-[1.5] text-[var(--secondary)]">
                              This certification was withdrawn by the engineer in responsible charge.
                              Retaking the check does not restore it; they do.
                            </p>
                          ) : (
                            <a
                              href={`/portal/certification?service=${slug}`}
                              className="mt-3 inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[2px] bg-[var(--navy)] px-5 text-[15px] font-bold text-white"
                            >
                              {cert ? "Take it again" : "Read the protocol and take the check"}
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/*
            YOUR CREDENTIALS. The technician submits each one (the type, the
            issuing state, the expiry) and an operator verifies it. Each row
            reads the same credentialStanding dispatch reads, so the screen and
            dispatch cannot disagree; the dates come from the rows themselves.
          */}
          <section aria-labelledby="your-credentials">
            <h2
              id="your-credentials"
              className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]"
            >
              Your credentials
            </h2>
            <p
              className={`mt-3 text-[14px] leading-[1.55] ${paperwork.length ? "font-semibold text-[var(--ink)]" : "text-[var(--secondary)]"}`}
            >
              {paperwork.length === 0
                ? "Everything required is verified and current. Nothing in your credentials is stopping a job reaching you."
                : "Something below is stopping jobs reaching you."}
            </p>
            <ul className="mt-3 border-t border-[var(--row-rule)]">
              {standing.map((s) => {
                const rows = mine.filter((m) => m.kind === s.kind);
                const verified = rows.find(
                  (m) => m.status === "verified" && (s.current ? m.expiresOn === s.current.expiresOn : true),
                );
                const waiting = rows.find((m) => m.status === "pending");
                const rejected = rows.find((m) => m.status === "rejected");
                const lastRejectedIsNewest = rejected && rows[0]?.id === rejected.id;
                return (
                  <li key={s.kind} className="border-b border-[var(--row-rule)] py-3">
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{s.label}</p>
                    <p className="mt-0.5 text-[14px] leading-[1.55] text-[var(--secondary)]">
                      {s.state === "exempt"
                        ? "Not required for you."
                        : s.state === "recorded" || s.state === "expiring"
                          ? `Verified${verified?.verifiedAt ? ` on ${firmDateLabel(verified.verifiedAt)}` : ""}${s.current?.expiresOn ? `. Expires ${calendarDateLabel(s.current.expiresOn)}.` : ". Does not expire."}`
                          : s.state === "expired"
                            ? `Expired on ${calendarDateLabel(s.lapsedOn) ?? "its expiry date"}. Submit the current one.`
                            : s.state === "unverified"
                              ? `Submitted, awaiting verification${waiting?.expiresOn ? `. Expires ${calendarDateLabel(waiting.expiresOn)}` : ""}.`
                              : "Not submitted."}
                    </p>
                    {waiting && (s.state === "recorded" || s.state === "expiring" || s.state === "expired") ? (
                      <p className="mt-0.5 text-[14px] text-[var(--secondary)]">A newer one is submitted, awaiting verification.</p>
                    ) : null}
                    {lastRejectedIsNewest && rejected?.rejectReason ? (
                      <p className="mt-1 border-l-2 border-[var(--ink)] py-1 pl-3 text-[14px] leading-[1.55] text-[var(--ink)]">
                        Your last submission was rejected: {rejected.rejectReason}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <SubmitCredentialForm kinds={submittableKindsFor(actor!.email)} states={US_STATES} />
            <p className="mt-3 text-[14px] leading-[1.55] text-[var(--secondary)]">
              {standing.some((s) => s.state === "expiring")
                ? "You can keep working through the credential's expiry date. From the next day, dispatch offers you nothing. "
                : ""}
              Submit the type, the issuing state and the expiry date. Nothing on this site asks you
              for a policy number, an account number, a document or a photograph of one.
            </p>
          </section>

          {/*
            SHOWN ONLY WHEN THERE IS A CHECK TO TAKE OR RETAKE, with a link to
            it. Operator ruling of 2026-10-09: a technician certified on every
            line has nothing to learn from instructions for a test they cannot
            take.
          */}
          {toTake.length > 0 ? (
            <Panel title="How the check works">
              <ul className="flex flex-col gap-2 text-[14px] leading-[1.55] text-[var(--secondary)]">
                <li>The protocol is on the page while you answer.</li>
                {/*
                  Operator ruling of 2026-10-08 on the copy, read against the code.
                  The approved line said that without a photograph "the engineer
                  cannot seal and the visit is repeated". The code stops it sooner:
                  ops-evidence.ts will not let a checklist be submitted until every
                  required item is captured, so the engineer never receives a
                  package missing one. The operator's wording of the same day says
                  that, and the original's first fact, that every question has to
                  be right, is kept.
                */}
                <li>
                  Every question has to be right. The job cannot be submitted until every required
                  photograph is captured.
                </li>
                <li>
                  Getting one wrong costs nothing. You are told why, straight away, and you can take it
                  again immediately.
                </li>
                <li>
                  Attempts are counted to show the engineer which questions are hard. They do not count
                  against you.
                </li>
              </ul>
              <a
                href={`/portal/certification?service=${toTake[0]}`}
                className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
              >
                {certBy.get(toTake[0]) ? "Take the check again" : "Take the check"}
              </a>
            </Panel>
          ) : null}

          {/*
            AND THE SAME RULE ON A PANEL RATHER THAN A DOOR.

            This asked actor?.role === "admin". The panel's only content is a
            link to /portal/protocols, which gates itself on
            holdsLicence(actor, "protocols.author"). So the old condition showed
            an administrator a link they could not open, which is the dashboard
            defect fixed in 6e2da4d wearing a different hat, and hid it from the
            licensed engineer who can.

            holdsLicence rather than can, because protocols.author is a LICENSED
            action: can() answers true for a grant holder without a licence, and
            the destination calls holdsLicence. Asking the weaker question here
            would put the dead link straight back.
          */}
          {templates.length > 0 && holdsLicence(actor, "protocols.author") ? (
            <Panel title="Authoring">
              <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
                Check questions are written on the protocol itself, by the engineer who will review
                the work.
              </p>
              <a
                href="/portal/protocols"
                className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
              >
                Open protocols
              </a>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
