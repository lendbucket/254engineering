import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, holdsLicence } from "@/lib/ops-authz";
import { checkFor, listProtocols } from "@/lib/ops-field";
import { certificationLabel } from "@/lib/ops-certification";
import { credentialsFor } from "@/lib/ops-onboarding";
import { credentialBlockers, credentialStanding, exemptKindsFor, expiringSoon } from "@/lib/ops-credentials";
import { CredentialStandingList } from "@/components/portal/CredentialTables";
import { services } from "@/content/services";
import { supabaseAdmin } from "@/lib/supabase";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { CheckRunner } from "./CertificationClient";

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
          .select("service_slug, name, version")
          .eq("status", "published")
      ).data ?? [])
    : [];

  const certRows = db
    ? ((
        await db
          .from("eng_certifications")
          .select("service_slug, status, template_id, score, attempts")
          .eq("profile_id", actor!.id)
      ).data ?? [])
    : [];

  const certBy = new Map(
    certRows.map((c) => [
      c.service_slug as string,
      {
        serviceSlug: c.service_slug as string,
        status: c.status as "in_progress" | "certified" | "failed" | "revoked",
        templateId: (c.template_id as string | null) ?? null,
        score: (c.score as number | null) ?? null,
        attempts: (c.attempts as number) ?? 0,
      },
    ]),
  );

  const held = (await credentialsFor([actor!.id])).get(actor!.id) ?? [];
  const paperwork = credentialBlockers(held, new Date(), exemptKindsFor(actor!.email));
  const standing = credentialStanding(held, new Date(), exemptKindsFor(actor!.email));
  const expiring = expiringSoon(held);

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
              protocolName={`${active.protocolName} v${active.version}`}
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
                {published.length === 0 ? (
                  <EmptyState
                    title="No protocols published yet"
                    body="A service line becomes certifiable when an engineer publishes a protocol for it. Until then there is nothing to be certified against, which is why nothing is listed here."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {published.map((p) => {
                      const cert = certBy.get(p.service_slug as string) ?? null;
                      const certified = cert?.status === "certified";
                      return (
                        <li
                          key={p.service_slug as string}
                          className="border-b border-[var(--row-rule)] py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold text-[var(--ink)]">
                                {serviceName(p.service_slug as string)}
                              </p>
                              <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                                {p.name as string} v{p.version as number}
                              </p>
                            </div>
                            <p className="text-[14px] font-semibold text-[var(--ink)]">{certificationLabel(cert)}</p>
                          </div>

                          {certified ? (
                            <p className="mt-3 text-[14px] leading-[1.5] text-[var(--secondary)]">
                              You can be offered work on this line once your paperwork is current.
                            </p>
                          ) : cert?.status === "revoked" ? (
                            <p className="mt-3 text-[14px] leading-[1.5] text-[var(--secondary)]">
                              This certification was withdrawn by the engineer in responsible charge.
                              Retaking the check does not restore it; they do.
                            </p>
                          ) : (
                            <a
                              href={`/portal/certification?service=${p.service_slug as string}`}
                              className="mt-3 inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[15px] font-bold text-white"
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
            YOUR CREDENTIALS, READ ONLY. Operator ruling of 2026-10-07: the
            technician sees his own credentials and what is missing. The list is
            the same credentialStanding the administrator's page and dispatch
            read, with the same words, so the three cannot disagree. Design V10:
            a heading with a 2px ink rule, rows, no card.
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
                ? "Everything required is on file and current. Nothing in your documents is stopping a job reaching you."
                : "Something below is stopping jobs reaching you."}
            </p>
            <CredentialStandingList standing={standing} />
            <p className="mt-3 text-[14px] leading-[1.55] text-[var(--secondary)]">
              {expiring.length > 0
                ? "An expiring credential does not stop you working. It stops you the day it lapses. "
                : ""}
              Send a new or replacement document to the operator, who records it. Nothing on this site
              asks you to type a policy number, an account number, or a social security number.
            </p>
          </section>

          <Panel title="How the check works">
            <ul className="flex flex-col gap-2 text-[14px] leading-[1.55] text-[var(--secondary)]">
              <li>
                The protocol is on the page while you answer. It is meant to be read, not memorised.
              </li>
              <li>
                Every question has to be right. There is no such thing as most of an evidence
                package: a missing photograph means the engineer cannot seal and somebody drives
                back.
              </li>
              <li>
                Getting one wrong costs nothing. You are told why, straight away, and you can take it
                again immediately.
              </li>
              <li>
                Attempts are counted so the engineer can see which questions are hard, not to hold
                against you.
              </li>
            </ul>
          </Panel>

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
