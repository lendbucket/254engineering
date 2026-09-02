import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { getProtocol, listProtocols } from "@/lib/ops-field";
import { services } from "@/content/services";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { ItemEditor, NewProtocolForm, PublishButton } from "./ProtocolsClient";

export const dynamic = "force-dynamic";

/**
 * Protocol authoring.
 *
 * WHY THIS SCREEN EXISTS BEFORE DISPATCH DOES ANYTHING
 * ----------------------------------------------------
 * A technician never decides what evidence a file needs. An engineer writes the
 * checklist, versions it, and publishes it, and dispatch refuses to offer a job
 * in a service line that has no published protocol. That refusal is not a
 * technical constraint; it is the arrangement the firm is built on, which is why
 * the block is in sendOffers rather than in a note somebody is meant to read.
 *
 * WHY A PUBLISHED PROTOCOL CANNOT BE EDITED
 * -----------------------------------------
 * Files in flight are being worked to it. Adding a required photograph while a
 * technician is standing on a roof moves the submission gate under them, and
 * they find out by being refused. So editing means drafting the next version,
 * and publishing it retires the last one.
 */

const KIND_LABEL: Record<string, string> = {
  photo: "Photograph",
  measurement: "Measurement",
  reading: "Instrument reading",
  document: "Document",
  note: "Written note",
};

export default async function ProtocolsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "protocols.author")) notFound();
  const params = await searchParams;

  const templates = await listProtocols(actor);
  const selected = params.id ? await getProtocol(actor, params.id) : null;

  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;

  const published = new Set(templates.filter((t) => t.status === "published").map((t) => t.service_slug));
  const uncovered = services.filter((s) => !published.has(s.slug));

  return (
    <>
      <PageHead
        eyebrow="Engineering"
        title="Protocols"
        lede="What a technician must capture on each service line, written by the engineer who will review it. A job cannot be dispatched in a service line with no published protocol."
      />

      {uncovered.length > 0 ? (
        <div className="mb-6 rounded-[4px] border border-limestone-line border-l-[3px] border-l-brass bg-white px-4 py-3">
          <p className="text-[13px] font-semibold text-slate">
            {uncovered.length} service line{uncovered.length === 1 ? "" : "s"} cannot be dispatched yet
          </p>
          <p className="mt-1 max-w-[75ch] text-[13px] leading-[1.55] text-slate-muted">
            {uncovered.map((s) => s.name).join(", ")}. Each needs a published protocol before a
            technician can be offered work on it.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className={selected ? "hidden lg:block" : "block"}>
          <NewProtocolForm
            services={services.map((s) => ({ slug: s.slug, name: s.name }))}
            existing={templates.map((t) => ({
              id: t.id,
              label: `${t.name} v${t.version} (${serviceName(t.service_slug)})`,
            }))}
          />

          <div className="mt-5">
            {templates.length === 0 ? (
              <EmptyState
                title="No protocols yet"
                body="A protocol is the checklist a technician works. Draft one above, add the items, then publish it."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {templates.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/portal/protocols?id=${t.id}`}
                      className={`block rounded-[4px] border bg-white p-4 transition-colors hover:border-slate ${
                        selected?.id === t.id
                          ? "border-slate border-l-[3px] border-l-brass"
                          : "border-limestone-line"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14.5px] font-semibold text-slate">{t.name}</p>
                          <p className="mt-0.5 text-[13px] text-slate-muted">
                            {serviceName(t.service_slug)}, version {t.version}
                          </p>
                        </div>
                        <Chip
                          label={t.status}
                          tone={t.status === "published" ? "good" : t.status === "draft" ? "warn" : "neutral"}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {selected ? (
          <div>
            <Link
              href="/portal/protocols"
              className="mb-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-slate-muted lg:hidden"
            >
              Back to the list
            </Link>

            <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white">
              <div className="border-b border-limestone-line px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-[20px] leading-[1.2] font-bold text-slate">
                      {selected.name}
                    </h2>
                    <p className="mt-1 text-[13.5px] text-slate-muted">
                      {serviceName(selected.service_slug)}, version {selected.version}
                    </p>
                    {selected.summary ? (
                      <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.55] text-slate-muted">
                        {selected.summary}
                      </p>
                    ) : null}
                  </div>
                  <Chip
                    label={selected.status}
                    tone={
                      selected.status === "published" ? "good" : selected.status === "draft" ? "warn" : "neutral"
                    }
                  />
                </div>
              </div>

              <div className="px-4 py-5 sm:px-5">
                {selected.items.length === 0 ? (
                  <p className="text-[13.5px] text-slate-muted">
                    Nothing on this checklist yet. A protocol with no items cannot be published,
                    because a technician could never finish it.
                  </p>
                ) : (
                  <ol className="divide-y divide-limestone-line">
                    {selected.items.map((item, i) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-slate">
                            {i + 1}. {item.label}
                            {item.required ? "" : " (optional)"}
                          </p>
                          <p className="mt-0.5 text-[13px] text-slate-muted">
                            {KIND_LABEL[item.kind] ?? item.kind}
                            {item.kind === "photo" && item.minCount && item.minCount > 1
                              ? `, ${item.minCount} frames`
                              : ""}
                            {item.unit ? `, in ${item.unit}` : ""}
                            {item.minValue != null || item.maxValue != null
                              ? `, expected ${item.minValue ?? "any"} to ${item.maxValue ?? "any"}`
                              : ""}
                          </p>
                          {item.instructions ? (
                            <p className="mt-1 max-w-[70ch] text-[13px] leading-[1.5] text-slate-muted">
                              {item.instructions}
                            </p>
                          ) : null}
                        </div>
                        {selected.status === "draft" ? (
                          <ItemEditor.Remove templateId={selected.id} itemId={item.id} />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}

                {selected.status === "draft" ? (
                  <>
                    <div className="mt-6 border-t border-limestone-line pt-5">
                      <ItemEditor.Add templateId={selected.id} />
                    </div>
                    <div className="mt-6 border-t border-limestone-line pt-5">
                      <PublishButton id={selected.id} itemCount={selected.items.length} />
                    </div>
                  </>
                ) : (
                  <p className="mt-6 border-t border-limestone-line pt-5 text-[13px] leading-[1.55] text-slate-muted">
                    A {selected.status} protocol cannot be edited. Files are being worked to it, and
                    changing the checklist under a technician on a roof moves the submission gate
                    while they are trying to clear it. Draft the next version instead.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block">
            <EmptyState
              title="No protocol selected"
              body="Choose one from the list, or draft a new one."
            />
          </div>
        )}
      </div>
    </>
  );
}
