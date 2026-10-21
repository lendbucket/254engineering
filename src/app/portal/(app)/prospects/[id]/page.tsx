import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { prospectById } from "@/lib/ops-prospects";
import { PROSPECT_TYPE_LABEL } from "@/lib/prospect-import";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ContactLogPanel } from "@/components/portal/ContactLog";
import { ConvertProspect, EditProspect, ReopenProspect } from "./ProspectClient";

export const dynamic = "force-dynamic";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const { id } = await params;
  const read = await prospectById(actor, id);
  if (read.ok && !read.row) notFound();

  if (!read.ok || !read.row) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Prospect" />
        <ErrorState title="This prospect could not be read" body={read.ok ? "It was not found." : read.error} />
      </>
    );
  }
  const p = read.row;
  const tel = telLink(p.phone);

  return (
    <>
      <PageHead
        eyebrow="Sales list"
        title={p.company}
        lede={`${PROSPECT_TYPE_LABEL[p.prospectType]}${p.city ? `, ${p.city}` : ""}. ${
          p.status === "converted" ? "A customer now." : p.status === "not_interested" ? "Not interested." : p.followUpOn ? `Follow up on ${p.followUpOn}.` : "No follow-up date set."
        }`}
      />

      <Panel title="How to reach them">
        <dl className="grid gap-2 text-[14px] sm:grid-cols-[140px_1fr]">
          <dt className="font-semibold text-[var(--ink)]">Contact</dt>
          <dd className="text-[var(--ink)]">{p.contactName ?? "No name on file"}</dd>
          <dt className="font-semibold text-[var(--ink)]">Phone</dt>
          <dd>{tel ? <a href={tel} className="font-semibold text-[var(--navy)] underline">{p.phone}</a> : p.phone ?? "No phone on file"}</dd>
          <dt className="font-semibold text-[var(--ink)]">Email</dt>
          <dd>{p.email ? <a href={`mailto:${p.email}`} className="text-[var(--navy)] underline">{p.email}</a> : "No email on file"}</dd>
          <dt className="font-semibold text-[var(--ink)]">Owner</dt>
          <dd className="text-[var(--ink)]">{p.ownerName ?? "Nobody yet"}</dd>
          <dt className="font-semibold text-[var(--ink)]">Last contact</dt>
          <dd className="text-[var(--ink)]">{p.lastContactAt ? formatInFirmZone(p.lastContactAt) : "Never"}</dd>
        </dl>
      </Panel>

      {p.status === "converted" ? (
        <Panel className="mt-6" title="A customer now">
          <p className="text-[14px] text-[var(--ink)]">
            This prospect was converted into a commercial account.{" "}
            {can(actor, "accounts.manage") ? (
              <Link href="/portal/accounts" className="font-semibold text-[var(--navy)] underline">Open the accounts list</Link>
            ) : (
              "Terms and credit are set by an administrator."
            )}
          </p>
        </Panel>
      ) : (
        <>
          <Panel className="mt-6 print:hidden" title="Details">
            {p.status === "not_interested" ? (
              <ReopenProspect id={p.id} />
            ) : (
              <EditProspect
                p={{ id: p.id, company: p.company, contactName: p.contactName, phone: p.phone, email: p.email, city: p.city, prospectType: p.prospectType, followUpOn: p.followUpOn }}
                actorId={actor.id}
                ownerId={p.ownerId}
              />
            )}
          </Panel>
          {p.status === "open" && can(actor, "clients.create") ? (
            <Panel className="mt-6 print:hidden" title="Make them a customer" description="Opens a commercial account billed by card, with no credit. Invoicing, terms and limits are set by an administrator.">
              <ConvertProspect id={p.id} company={p.company} hasEmail={Boolean(p.email)} />
            </Panel>
          ) : null}
        </>
      )}

      <ContactLogPanel actor={actor} subject="prospect" subjectId={p.id} />
    </>
  );
}
