"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quoteFor } from "@/lib/ops-orders";
import { resolveCounty, twiaStatus } from "@/lib/ops-counties";
import { money, isKnown } from "@/lib/ops-money";
import {
  blockers,
  decidePrice,
  landsAt,
  paymentOptions,
  MIN_OVERRIDE_REASON,
  type IntakeChannel,
  type PaymentIntent,
} from "@/lib/job-intake-rules";
import type { CatalogEntry } from "@data/catalog";

type Deliverable = {
  serviceSlug: string;
  tier: string;
  name: string;
  orderType: CatalogEntry["orderType"];
  priceCents: number | null;
  coastalSurchargeCents: number | null;
};

type ClientMatch = {
  id: string;
  kind: string;
  name: string;
  client_type: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
};

const label = "block text-[13.5px] font-semibold text-[var(--navy)]";
const field =
  "mt-1.5 h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)] focus:border-[var(--navy)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20";
const hint = "mt-1.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]";

const CHANNELS: { value: IntakeChannel; label: string }[] = [
  { value: "phone", label: "Telephone" },
  { value: "email", label: "Email" },
  { value: "walk_in", label: "Walked in" },
  { value: "partner", label: "A partner sent them" },
  { value: "web", label: "The website" },
  { value: "other", label: "Something else" },
];

export function IntakeClient({
  lines,
  deliverables,
  counties,
  prelaunch,
}: {
  lines: { slug: string; name: string }[];
  deliverables: Deliverable[];
  counties: string[];
  prelaunch: boolean;
}) {
  const router = useRouter();

  // ------------------------------------------------------------- the client
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ClientMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<ClientMatch | null>(null);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState({
    kind: "individual" as "individual" | "organization",
    name: "",
    email: "",
    phone: "",
    city: "",
  });

  // --------------------------------------------------------------- the work
  const [serviceSlug, setServiceSlug] = useState("");
  const [tier, setTier] = useState("");
  const [urgency, setUrgency] = useState<"standard" | "expedited" | "emergency">("standard");
  const [dueAt, setDueAt] = useState("");

  // ----------------------------------------------------------- the property
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // -------------------------------------------------------------- the money
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent>("released_unpaid");

  // ------------------------------------------------------------ how it came
  const [channel, setChannel] = useState<IntakeChannel | "">("phone");
  const [takenAt, setTakenAt] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    fileId: string;
    fileNumber: string;
    landedAt: string;
    landingWarning?: string;
  } | null>(null);

  /*
   * The client search, debounced. Three hundred milliseconds is long enough
   * that typing a name does not fire six requests and short enough that the
   * results are there before the operator has finished reading the name back.
   */
  useEffect(() => {
    /*
     * Nothing is set synchronously here, and that is why the effect returns
     * before touching state rather than clearing the list first. Setting state
     * during an effect makes React render again immediately, and the lint rule
     * that catches it is right: a stale list is DERIVED below instead, which is
     * both cheaper and impossible to leave out of sync.
     */
    if (chosen || query.trim().length < 2) return;

    let live = true;
    const timer = setTimeout(async () => {
      if (!live) return;
      setSearching(true);
      try {
        const res = await fetch("/api/portal/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search_clients", query }),
        });
        const body = await res.json().catch(() => null);
        if (live) setMatches(body?.ok ? (body.matches as ClientMatch[]) : []);
      } finally {
        if (live) setSearching(false);
      }
    }, 300);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, chosen]);

  /*
   * What the list should show right now, rather than what a previous search
   * left in state. A client already chosen, or a query too short to search,
   * shows nothing without needing an effect to have cleared it.
   */
  const visibleMatches = chosen || query.trim().length < 2 ? [] : matches;

  const forLine = useMemo(
    () => deliverables.filter((d) => d.serviceSlug === serviceSlug),
    [deliverables, serviceSlug],
  );
  const entry = useMemo(
    () => forLine.find((d) => d.tier === tier) ?? null,
    [forLine, tier],
  );

  /*
   * The county the platform will actually use, derived exactly as the server
   * derives it. Shown back to the operator rather than left implicit, because
   * dispatch matches on county and TWIA decides the price.
   */
  const resolved = useMemo(
    () => resolveCounty({ city: city || null, county: county || null }),
    [city, county],
  );
  const effectiveCounty = resolved.valid ? resolved.county : null;
  const twia = effectiveCounty ? twiaStatus(effectiveCounty) === "designated" : false;

  /* The SAME quoteFor the server calls when it writes the file. */
  const quote = useMemo(() => {
    if (!entry) return null;
    return quoteFor(
      {
        ...(entry as unknown as CatalogEntry),
        priceCents: entry.priceCents,
        coastalSurchargeCents: entry.coastalSurchargeCents,
        orderType: entry.orderType,
      } as CatalogEntry,
      twia,
      effectiveCounty ?? undefined,
    );
  }, [entry, twia, effectiveCounty]);

  const catalogCents = quote && isKnown(quote.totalCents) ? quote.totalCents : null;
  const enteredCents = overridePrice.trim() ? Math.round(Number(overridePrice) * 100) : null;

  const priceDecision = useMemo(
    () =>
      decidePrice({
        catalogCents,
        enteredCents: Number.isFinite(enteredCents) ? enteredCents : null,
        reason: overrideReason || null,
      }),
    [catalogCents, enteredCents, overrideReason],
  );

  const options = paymentOptions({
    prelaunch,
    /*
     * The screen cannot know whether this client has invoicing terms until a
     * client is chosen, and it does not ask: the server decides and refuses.
     * Shown as unavailable until then, with the reason the server would give.
     */
    accountCanInvoice: false,
    priced: catalogCents !== null,
  });

  const missing = blockers({
    clientId: chosen ? chosen.id : creating && newClient.name.trim() ? "pending" : null,
    serviceSlug: serviceSlug || null,
    tier: tier || null,
    propertyAddress,
    city,
    county,
    channel: (channel || null) as IntakeChannel | null,
  });

  const priceError = "error" in priceDecision ? priceDecision.error : null;
  const canSubmit = missing.length === 0 && !priceError && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "take_job",
          clientId: chosen?.id ?? null,
          newClient: chosen
            ? undefined
            : {
                kind: newClient.kind,
                name: newClient.name,
                email: newClient.email || null,
                phone: newClient.phone || null,
                city: newClient.city || null,
              },
          serviceSlug,
          tier,
          propertyAddress,
          city: city || null,
          county: county || null,
          postalCode: postalCode || null,
          urgency,
          dueAt: dueAt || null,
          notes: notes || null,
          channel,
          takenAt: takenAt || null,
          priceCents: "overridden" in priceDecision && priceDecision.overridden ? priceDecision.cents : null,
          priceOverrideReason:
            "overridden" in priceDecision && priceDecision.overridden ? priceDecision.reason : null,
          paymentIntent,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That could not be saved.");
        setBusy(false);
        return;
      }
      setDone(body);
      setBusy(false);
    } catch {
      setError("The network dropped that. Nothing was saved.");
      setBusy(false);
    }
  }

  // ============================================================= done screen
  if (done) {
    return (
      <div className="rounded-[4px] border border-[var(--border)] border-t-[3px] border-t-[var(--gold)] bg-white p-5 sm:p-6">
        <p className="portal-kicker">Job taken</p>
        <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-[1.2] text-[var(--navy)]">
          {done.fileNumber}
        </h2>
        <p className="mt-3 text-[15px] leading-[1.6] text-[var(--secondary)]">
          {done.landedAt === "needs_dispatch"
            ? "The file is open and waiting for a technician. Dispatch it now, or leave it in the queue for somebody to pick up."
            : done.landedAt === "evidence_submitted"
              ? "The file is open and in the engineer's review queue. There is nothing to dispatch: desk work arrives with its evidence attached."
              : "The file is open and sitting at intake. A quote has nothing to dispatch and nothing to review until somebody accepts a number."}
        </p>

        {done.landingWarning ? (
          <p className="mt-3 rounded-[3px] border border-[var(--gold)] bg-[var(--gold-wash)] px-3 py-2 text-[13.5px] leading-[1.55] text-[var(--ink)]">
            The file was created and could not be moved on: {done.landingWarning} It is at intake and
            somebody has to move it by hand.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/portal/files?id=${done.fileId}`}
            className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white hover:bg-[var(--navy-hover)]"
          >
            {done.landedAt === "needs_dispatch" ? "Open the file and dispatch it" : "Open the file"}
          </Link>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setChosen(null);
              setQuery("");
              setServiceSlug("");
              setTier("");
              setPropertyAddress("");
              setCity("");
              setCounty("");
              setOverridePrice("");
              setOverrideReason("");
              setNotes("");
              router.refresh();
            }}
            className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-white px-4 text-[13.5px] font-bold text-[var(--navy)] hover:bg-[var(--canvas)]"
          >
            Take another
          </button>
        </div>
      </div>
    );
  }

  // ================================================================ the form
  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------- the client */}
      <Section
        title="Who is it for"
        note="Search before creating. The same installer becoming four clients is how a firm loses track of who it works for."
      >
        {chosen ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2.5">
            <div>
              <p className="text-[15px] font-semibold text-[var(--navy)]">{chosen.name}</p>
              <p className="text-[12.5px] text-[var(--secondary)]">
                {[chosen.email, chosen.phone, chosen.city].filter(Boolean).join(" · ") || "no contact recorded"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setQuery("");
              }}
              className="min-h-[var(--tap-target)] text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <label htmlFor="clientQuery" className={label}>
              Search by name, email, phone or city
            </label>
            <input
              id="clientQuery"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={field}
              placeholder="Start typing"
            />
            {searching ? <p className={hint}>Looking.</p> : null}

            {visibleMatches.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {visibleMatches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setChosen(m);
                        setCreating(false);
                      }}
                      className="flex min-h-[var(--tap-target)] w-full flex-col items-start rounded-[3px] border border-[var(--border)] bg-white px-3 py-2 text-left hover:border-[var(--navy)]"
                    >
                      <span className="text-[15px] font-semibold text-[var(--navy)]">{m.name}</span>
                      <span className="text-[12.5px] text-[var(--secondary)]">
                        {[m.email, m.phone, m.city].filter(Boolean).join(" · ") || "no contact recorded"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {query.trim().length >= 2 && !searching && visibleMatches.length === 0 ? (
              <p className={hint}>Nobody matches that. Create them below.</p>
            ) : null}

            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="mt-3 min-h-[var(--tap-target)] text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-2"
            >
              {creating ? "Cancel the new client" : "Create a new client"}
            </button>

            {creating ? (
              <div className="mt-3 grid gap-4 rounded-[3px] border border-[var(--border)] bg-[var(--canvas)] p-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ncKind" className={label}>Kind</label>
                  <select
                    id="ncKind"
                    value={newClient.kind}
                    onChange={(e) =>
                      setNewClient({ ...newClient, kind: e.target.value as "individual" | "organization" })
                    }
                    className={field}
                  >
                    <option value="individual">Individual</option>
                    <option value="organization">Organization</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ncName" className={label}>Name</label>
                  <input
                    id="ncName"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="ncEmail" className={label}>Email</label>
                  <input
                    id="ncEmail"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="ncPhone" className={label}>Phone</label>
                  <input
                    id="ncPhone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className={field}
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </Section>

      {/* --------------------------------------------------------- the work */}
      <Section title="What they need">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="serviceSlug" className={label}>Service line</label>
            <select
              id="serviceSlug"
              value={serviceSlug}
              onChange={(e) => {
                setServiceSlug(e.target.value);
                const only = deliverables.filter((d) => d.serviceSlug === e.target.value);
                /* Seven of the nine lines sell exactly one thing. Choosing it
                   for the operator saves a tap on every one of those calls. */
                setTier(only.length === 1 ? only[0].tier : "");
              }}
              className={field}
            >
              <option value="">Choose one</option>
              {lines.map((l) => (
                <option key={l.slug} value={l.slug}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tier" className={label}>Deliverable</label>
            <select
              id="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className={field}
              disabled={!serviceSlug}
            >
              <option value="">{serviceSlug ? "Choose one" : "Choose a service line first"}</option>
              {forLine.map((d) => (
                <option key={d.tier} value={d.tier}>{d.name}</option>
              ))}
            </select>
            {entry ? (
              <p className={hint}>
                {entry.orderType === "field"
                  ? "Field work. A technician visits before an engineer sees anything."
                  : entry.orderType === "desk"
                    ? "Desk work. It goes straight to the review queue."
                    : "Quoted. Nothing is dispatched until somebody accepts a number."}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="urgency" className={label}>Urgency</label>
            <select
              id="urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as typeof urgency)}
              className={field}
            >
              <option value="standard">Standard</option>
              <option value="expedited">Expedited</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label htmlFor="dueAt" className={label}>Due date</label>
            <input
              id="dueAt"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={field}
            />
            <p className={hint}>Optional. If they named a closing or a permit date, put it here.</p>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------- the property */}
      <Section title="The property">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="propertyAddress" className={label}>Address</label>
            <input
              id="propertyAddress"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="city" className={label}>City</label>
            <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="county" className={label}>County</label>
            <select id="county" value={county} onChange={(e) => setCounty(e.target.value)} className={field}>
              <option value="">Derive it from the city</option>
              {counties.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="postalCode" className={label}>Postal code</label>
            <input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={field}
            />
          </div>
        </div>

        {/* What the platform actually resolved, shown back rather than assumed. */}
        <div className="mt-4 rounded-[3px] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2.5">
          {effectiveCounty ? (
            <p className="text-[13.5px] leading-[1.55] text-[var(--ink)]">
              <span className="font-semibold text-[var(--navy)]">{effectiveCounty} County.</span>{" "}
              {twia
                ? "Inside the windstorm designated area, so the coastal line applies and windstorm evidence is required."
                : "Inland. No windstorm requirements and no coastal line."}
            </p>
          ) : (
            <p className="text-[13.5px] leading-[1.55] text-[var(--secondary)]">
              No county yet. Dispatch matches on county, so this has to resolve before the job can go anywhere.
            </p>
          )}
        </div>
      </Section>

      {/* -------------------------------------------------------- the price */}
      <Section title="The price">
        {!entry ? (
          <p className="text-[13.5px] text-[var(--secondary)]">Choose a deliverable and the catalog price appears here.</p>
        ) : quote?.unavailable ? (
          <p className="rounded-[3px] border border-[var(--gold)] bg-[var(--gold-wash)] px-3 py-2 text-[13.5px] leading-[1.55] text-[var(--ink)]">
            {quote.unavailable} You can still take the job and set a price below, and the reason will be recorded.
          </p>
        ) : (
          <dl className="flex flex-col gap-2">
            {quote?.lines.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-[13.5px] text-[var(--ink)]">{line.label}</dt>
                <dd className="font-mono text-[15px] font-semibold text-[var(--navy)]">
                  {isKnown(line.amountCents) ? money(line.amountCents) : "not set"}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-t border-[var(--border)] pt-2">
              <dt className="text-[13.5px] font-semibold text-[var(--navy)]">Catalog total</dt>
              <dd className="font-mono text-[15px] font-bold text-[var(--navy)]">
                {catalogCents === null ? "not set" : money(catalogCents)}
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="overridePrice" className={label}>Charge a different price</label>
            <input
              id="overridePrice"
              inputMode="decimal"
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
              className={field}
              placeholder={catalogCents === null ? "Set a price" : "Leave blank to use the catalog"}
            />
          </div>
          <div>
            <label htmlFor="overrideReason" className={label}>Why</label>
            <input
              id="overrideReason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className={field}
              placeholder={`At least ${MIN_OVERRIDE_REASON} characters`}
            />
          </div>
        </div>
        <p className={hint}>
          The catalog price stays on the file either way. A price that changed with no record of who
          changed it or why is a dispute the firm loses.
        </p>
        {priceError ? (
          <p className="mt-2 text-[13.5px] font-semibold leading-[1.5] text-[var(--danger)]">{priceError}</p>
        ) : null}
      </Section>

      {/* ------------------------------------------------------ the payment */}
      <Section
        title="Getting paid"
        note="Work released before payment is a decision the firm makes, not one it discovers."
      >
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <label
              key={o.intent}
              className={`flex min-h-[var(--tap-target)] cursor-pointer items-start gap-3 rounded-[3px] border px-3 py-2.5 ${
                paymentIntent === o.intent
                  ? "border-[var(--navy)] bg-[var(--canvas)]"
                  : "border-[var(--border)] bg-white"
              } ${o.available ? "" : "opacity-60"}`}
            >
              <input
                type="radio"
                name="paymentIntent"
                value={o.intent}
                checked={paymentIntent === o.intent}
                disabled={!o.available}
                onChange={() => setPaymentIntent(o.intent)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-[15px] font-semibold text-[var(--navy)]">{o.label}</span>
                {o.because ? (
                  <span className="block text-[12.5px] leading-[1.5] text-[var(--secondary)]">{o.because}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------- how it arrived */}
      <Section title="How it arrived">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="channel" className={label}>Channel</label>
            <select
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as IntakeChannel)}
              className={field}
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="takenAt" className={label}>When the call happened</label>
            <input
              id="takenAt"
              type="datetime-local"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              className={field}
            />
            <p className={hint}>Optional. Only if it was not just now.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className={label}>Notes</label>
            <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------- the tail */}
      <div className="rounded-[4px] border border-[var(--border)] bg-white p-4 sm:p-5">
        {missing.length > 0 ? (
          <div className="mb-3">
            <p className="text-[13.5px] font-semibold text-[var(--navy)]">Still needed</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {missing.map((m) => (
                <li key={m} className="text-[13.5px] leading-[1.5] text-[var(--secondary)]">{m}</li>
              ))}
            </ul>
          </div>
        ) : entry ? (
          <p className="mb-3 text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            This will open a file and put it at{" "}
            <span className="font-semibold text-[var(--navy)]">
              {landsAt(entry.orderType) === "needs_dispatch"
                ? "needs dispatch"
                : landsAt(entry.orderType) === "evidence_submitted"
                  ? "the review queue"
                  : "intake"}
            </span>
            .
          </p>
        ) : null}

        {error ? (
          <p className="mb-3 text-[13.5px] font-semibold leading-[1.5] text-[var(--danger)]">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-5 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving" : "Take the job"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[4px] border border-[var(--border)] bg-white p-4 sm:p-5">
      <h2 className="font-display text-[1.05rem] font-semibold leading-[1.3] text-[var(--navy)]">{title}</h2>
      {note ? <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--secondary)]">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
