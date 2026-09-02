import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listOffers } from "@/lib/ops-field";
import { services } from "@/content/services";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { OfferControls } from "./JobsClient";

export const dynamic = "force-dynamic";

/**
 * A technician's own screen, and the only one most of them will ever open.
 *
 * DESIGNED FOR A PHONE HELD IN ONE HAND, OUTSIDE
 * ----------------------------------------------
 * Everything here is a full width card with a 44px target. There is no table,
 * no hover, and no horizontal anything. The person reading it is standing in a
 * driveway deciding whether to take a job, and the three facts that decide it,
 * what it pays, where it is, and when it is due, are the three at the top of the
 * card rather than behind a tap.
 *
 * WHAT AN OFFER SAYS BEFORE IT IS ACCEPTED
 * ----------------------------------------
 * The flat rate, in dollars. A technician who has to accept a job to find out
 * what it pays is a technician being asked to trust a number they cannot see,
 * and the platform would deserve the reputation that produces.
 */

const money = (cents: number | null) =>
  cents === null ? "no rate set" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const when = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;

export default async function JobsPage() {
  const actor = await currentActor();
  if (!can(actor, "offers.list_own")) notFound();

  const offers = await listOffers(actor);
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;

  const live = offers.filter((o) => o.state === "offered" && !o.file?.assigned_tech_id);
  const mine = offers.filter(
    (o) =>
      o.state === "accepted" &&
      o.file &&
      !["delivered", "closed", "cancelled"].includes(o.file.status),
  );
  const past = offers.filter(
    (o) =>
      (o.state === "accepted" && o.file && ["delivered", "closed"].includes(o.file.status)) ||
      o.state === "declined" ||
      o.state === "withdrawn" ||
      o.state === "expired",
  );

  return (
    <>
      <PageHead
        eyebrow="Field"
        title="My jobs"
        lede="Offers waiting on you, and the work you have accepted. The rate is on the offer, before you accept it."
      />

      <section aria-labelledby="live-offers">
        <h2 id="live-offers" className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
          Offers waiting on you
        </h2>
        <div className="mt-3">
          {live.length === 0 ? (
            <EmptyState
              title="No offers right now"
              body="A job reaches you when a file needs evidence in one of your coverage counties and you are certified for that service line. You will see the flat rate before you accept."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {live.map((o) => (
                <li
                  key={o.id}
                  className="rounded-[4px] border border-limestone-line border-l-[3px] border-l-brass bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[19px] leading-[1.25] font-bold text-slate">
                        {money(o.offer_amount_cents)}
                      </p>
                      <p className="mt-1 text-[14.5px] font-semibold text-slate">
                        {o.file?.property_address}
                      </p>
                      <p className="mt-0.5 text-[13.5px] text-slate-muted">
                        {o.file?.city ? `${o.file.city}, ` : ""}
                        {o.file?.county} County
                        {o.distance_miles ? `, about ${Number(o.distance_miles)} miles out` : ""}
                      </p>
                      <p className="mt-1.5 text-[13px] text-slate-muted">
                        {serviceName(o.file?.service_slug ?? "")}
                        {when(o.file?.evidence_due_at ?? null)
                          ? `, evidence due ${when(o.file?.evidence_due_at ?? null)}`
                          : ""}
                      </p>
                    </div>
                    {o.file?.twia_county ? <Chip label="Windstorm county" tone="warn" /> : null}
                  </div>

                  <OfferControls offerId={o.id} fileId={o.file_id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="accepted" className="mt-9">
        <h2 id="accepted" className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
          Work you have accepted
        </h2>
        <div className="mt-3">
          {mine.length === 0 ? (
            <EmptyState
              title="Nothing accepted"
              body="Jobs you take appear here with their evidence checklist. You can work one with no signal; captures queue on the phone and upload when you are back in range."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {mine.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/portal/jobs/${o.file_id}`}
                    className="block rounded-[4px] border border-limestone-line bg-white p-4 transition-colors hover:border-slate"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[12.5px] text-brass-ink">{o.file?.file_number}</p>
                        <p className="mt-1 text-[15px] font-semibold text-slate">
                          {o.file?.property_address}
                        </p>
                        <p className="mt-0.5 text-[13.5px] text-slate-muted">
                          {o.file?.city ? `${o.file.city}, ` : ""}
                          {o.file?.county} County, {money(o.offer_amount_cents)}
                        </p>
                      </div>
                      <Chip label={STATUS_LABEL[o.file?.status as FileStatus] ?? o.file?.status ?? ""} tone="warn" />
                    </div>
                    <p className="mt-3 text-[13.5px] font-semibold text-slate">Open the checklist</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="past" className="mt-9">
          <h2 id="past" className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
            Earlier
          </h2>
          <ul className="mt-3 divide-y divide-limestone-line rounded-[4px] border border-limestone-line bg-white px-4">
            {past.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate">{o.file?.property_address}</p>
                  <p className="mt-0.5 text-[13px] text-slate-muted">
                    {o.file?.county} County, {money(o.offer_amount_cents)}
                  </p>
                </div>
                <Chip
                  label={
                    o.state === "withdrawn"
                      ? "Taken by someone else"
                      : o.state === "accepted"
                        ? "Completed"
                        : o.state
                  }
                  tone={o.state === "accepted" ? "good" : "neutral"}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
