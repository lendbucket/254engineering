import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { checkFor, listProtocols } from "@/lib/ops-field";
import { certificationLabel } from "@/lib/ops-certification";
import { credentialsFor } from "@/lib/ops-onboarding";
import { credentialBlockers, expiringSoon, CREDENTIAL_LABEL } from "@/lib/ops-credentials";
import { services } from "@/content/services";
import { supabaseAdmin } from "@/lib/supabase";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
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
  if (!can(actor, "evidence.capture") && actor?.role !== "admin") notFound();
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
  const paperwork = credentialBlockers(held);
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
              <h2 id="lines" className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
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
                          className={`rounded-[4px] border bg-white p-4 ${
                            certified
                              ? "border-limestone-line border-l-[3px] border-l-[#2f6b45]"
                              : "border-limestone-line border-l-[3px] border-l-brass"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold text-slate">
                                {serviceName(p.service_slug as string)}
                              </p>
                              <p className="mt-0.5 text-[13px] text-slate-muted">
                                {p.name as string} v{p.version as number}
                              </p>
                            </div>
                            <Chip
                              label={certificationLabel(cert)}
                              tone={certified ? "good" : cert?.status === "revoked" ? "bad" : "neutral"}
                            />
                          </div>

                          {certified ? (
                            <p className="mt-3 text-[13.5px] leading-[1.5] text-slate-muted">
                              You can be offered work on this line once your paperwork is current.
                            </p>
                          ) : cert?.status === "revoked" ? (
                            <p className="mt-3 text-[13.5px] leading-[1.5] text-slate-muted">
                              This certification was withdrawn by the engineer in responsible charge.
                              Retaking the check does not restore it; they do.
                            </p>
                          ) : (
                            <a
                              href={`/portal/certification?service=${p.service_slug as string}`}
                              className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-[3px] bg-brass px-5 text-[15px] font-bold text-slate-ink"
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
          <Panel title="Your paperwork">
            {paperwork.length === 0 ? (
              <p className="text-[13.5px] leading-[1.55] text-slate-muted">
                Everything required is on file and current. Nothing in your documents is stopping a
                job reaching you.
              </p>
            ) : (
              <>
                <p className="text-[13.5px] leading-[1.55] font-semibold text-[#a3241c]">
                  This is stopping jobs reaching you.
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {paperwork.map((b) => (
                    <li key={b.kind + b.reason} className="text-[13.5px] leading-[1.5] text-slate-muted">
                      {b.reason}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] leading-[1.55] text-slate-muted">
                  Send the replacement document to the operator. Nothing on this site asks you to
                  type a policy number, an account number, or a social security number, and it never
                  will.
                </p>
              </>
            )}

            {expiring.length > 0 ? (
              <div className="mt-4 rounded-[3px] border border-[#f0d9a8] bg-[#fdf3e0] px-3 py-2.5">
                <p className="text-[13px] font-semibold text-[#7a4c05]">Expiring soon</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {expiring.map((e) => (
                    <li key={e.kind} className="text-[13px] leading-[1.5] text-[#7a4c05]">
                      {CREDENTIAL_LABEL[e.kind]} in {e.days} day{e.days === 1 ? "" : "s"}, on {e.expiresOn}.
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#7a4c05]">
                  This does not stop you working. It stops you the day it lapses.
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel title="How the check works">
            <ul className="flex flex-col gap-2 text-[13.5px] leading-[1.55] text-slate-muted">
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

          {templates.length > 0 && actor?.role === "admin" ? (
            <Panel title="Authoring">
              <p className="text-[13.5px] leading-[1.55] text-slate-muted">
                Check questions are written on the protocol itself, by the engineer who will review
                the work.
              </p>
              <a
                href="/portal/protocols"
                className="mt-3 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-slate underline underline-offset-4"
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
