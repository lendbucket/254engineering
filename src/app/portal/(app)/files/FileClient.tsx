"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";

/**
 * The transition controls on a file.
 *
 * WHY A BLOCKED MOVE IS SHOWN RATHER THAN HIDDEN
 * ----------------------------------------------
 * The compliance gate stops a file reaching sealed while the registration is
 * pending. Hiding the button would leave an operator wondering where sealing
 * went and whether the platform is broken. Showing it disabled, with the
 * machine's own sentence underneath, answers the question before it is asked.
 *
 * The reason string comes from canTransition, so the screen cannot drift from
 * the rule: there is no second copy of the explanation here to go stale.
 */
/**
 * Ask the customer for what the job is missing.
 *
 * Beside the list rather than on a separate screen, because the moment somebody
 * reads that a job is missing a gate code is the moment to ask for it.
 */
export function RequestInformation({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_information", fileId }),
      });
      const body = await res.json().catch(() => null);
      setSaid(
        body?.ok
          ? `Asked for ${body.asked.length} thing${body.asked.length === 1 ? "" : "s"}. It is on the file.`
          : (body?.error ?? "That could not be sent."),
      );
      if (body?.ok) router.refresh();
    } catch {
      setSaid("The network dropped that. Nothing was sent.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] border border-[var(--border)] bg-white px-4 text-[14px] font-bold text-[var(--ink)] hover:bg-[var(--row-hover)] disabled:opacity-50"
      >
        {busy ? "Sending" : "Ask the customer for these"}
      </button>
      {said ? <p className="mt-2 text-[13px] leading-[1.5] text-[var(--secondary)]">{said}</p> : null}
    </div>
  );
}

export function TransitionControls({
  fileId,
  status,
  options,
  paid = null,
}: {
  fileId: string;
  status: FileStatus;
  options: { to: FileStatus; allowed: boolean; reason?: string }[];
  /**
   * The file's paid order, when it has one (Part 1 finding 2, Robert's answer 6
   * of 2026-11-14): cancelling then names the payment and offers the refund in
   * the same step, in his approved words.
   */
  paid?: { orderId: string; reference: string; amount: string; paidOn: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  /* The paid-file confirmation, open or not. */
  const [confirmingPaid, setConfirmingPaid] = useState(false);

  async function move(to: FileStatus): Promise<boolean> {
    setBusy(to);
    setError(null);
    try {
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", fileId, to, note: note.trim() || null }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(null);
        return false;
      }
      setNote("");
      setBusy(null);
      router.refresh();
      return true;
    } catch {
      setError("The network dropped that. Try again.");
      setBusy(null);
      return false;
    }
  }

  /*
   * CANCEL AND ASK FOR A REFUND, ONE STEP. The file is cancelled first; only a
   * cancel that succeeded asks for the refund, through the same request the
   * order screen's "Ask for a refund" makes, with the timeline note as the
   * reason. A refund request that fails after the cancel is said plainly, with
   * where to finish it, rather than reported as done.
   */
  async function cancelAndRefund() {
    if (!paid) return;
    const reason = note.trim() || "The file was canceled.";
    const cancelled = await move("cancelled");
    if (!cancelled) return;
    try {
      const res = await fetch("/api/portal/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", orderId: paid.orderId, reason }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(`The file is canceled and the refund was not asked for: ${body?.error ?? "that did not work"}. Ask for it from order ${paid.reference}.`);
      }
    } catch {
      setError(`The file is canceled and the network dropped the refund request. Ask for it from order ${paid.reference}.`);
    }
    setConfirmingPaid(false);
  }

  const blocked = options.filter((o) => !o.allowed);

  return (
    <div>
      <p className="portal-label">
        Move this file on
      </p>
      <p className="mt-1 text-[14px] text-[var(--secondary)]">
        Currently {STATUS_LABEL[status].toLowerCase()}.
      </p>

      <label htmlFor="note" className="mt-4 block text-[14px] font-semibold text-[var(--ink)]">
        Note for the timeline (optional)
      </label>
      <input
        id="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why this is moving"
        className="mt-1.5 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-slate"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {options
          .filter((o) => o.allowed)
          .map((o) => {
            /*
             * Cancelling is destructive and irreversible: cancelled is terminal,
             * so a file cannot come back from it. Styling it identically to
             * "Evidence submitted" put a one way door next to a routine step and
             * gave the eye no reason to slow down. It is an outline in the danger
             * colour now, and it confirms before it fires.
             */
            const destructive = o.to === "cancelled";
            return (
              <button
                key={o.to}
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  /* A paid file names its payment and offers the refund in the same step (Robert's answer 6). */
                  if (destructive && paid) {
                    setConfirmingPaid(true);
                    return;
                  }
                  if (
                    destructive &&
                    !window.confirm(
                      "Cancel this file? Canceled is final: the file cannot be moved again afterwards.",
                    )
                  ) {
                    return;
                  }
                  void move(o.to);
                }}
                className={
                  destructive
                    ? "inline-flex min-h-[44px] items-center rounded-[2px] border-2 border-[var(--ink)] px-4 text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--row-hover)] disabled:opacity-60"
                    : "inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60"
                }
              >
                {busy === o.to ? "Moving..." : STATUS_LABEL[o.to]}
              </button>
            );
          })}
      </div>

      {/* Robert's approved wording, answer 6 of 2026-11-14 (6878458673, draft 4). */}
      {confirmingPaid && paid ? (
        <div role="alertdialog" aria-label="Cancel a paid file" className="mt-4 border-l-2 border-[var(--ink)] py-1 pl-3">
          <p className="text-[14px] leading-[1.55] font-semibold text-[var(--ink)]">
            Order {paid.reference} was paid {paid.amount} on {paid.paidOn}. Cancelling this file does not refund it.
          </p>
          <p className="mt-1 text-[14px] leading-[1.55] text-[var(--ink)]">
            Ask for a refund now, or cancel without one and settle the money later from the order.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void cancelAndRefund()}
              className="inline-flex min-h-[44px] items-center rounded-[2px] border-2 border-[var(--ink)] px-4 text-[14px] font-semibold text-[var(--ink)] disabled:opacity-60"
            >
              Cancel and ask for a refund
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                if (await move("cancelled")) setConfirmingPaid(false);
              }}
              className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--ink)] disabled:opacity-60"
            >
              Cancel, no refund now
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setConfirmingPaid(false)}
              className="inline-flex min-h-[44px] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white disabled:opacity-60"
            >
              Keep the file
            </button>
          </div>
        </div>
      ) : null}

      {blocked.length ? (
        <div className="mt-4 space-y-2">
          {blocked.map((o) => (
            <div
              key={o.to}
              className="border-l-2 border-[var(--ink)] pl-3"
            >
              <p className="text-[14px] font-semibold text-[var(--ink)]">
                {STATUS_LABEL[o.to]} is not available
              </p>
              <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">{o.reason}</p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 border-l-2 border-[var(--ink)] pl-3 text-[14px] font-semibold text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The tab strip on a file. Scrolls horizontally on a phone, never the page. */
export function FileTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (tab: string) => void;
}) {
  const tabs = [
    ["overview", "Overview"],
    ["evidence", "Evidence"],
    ["documents", "Documents"],
    ["tasks", "Tasks"],
    ["messages", "Messages"],
    ["timeline", "Timeline"],
    ["billing", "Billing"],
  ];
  return (
    <div className="border-b border-[var(--border)]">
      {/*
        overflow-x-auto on the STRIP, never on the page. A tab bar that pushes
        the document sideways is the exact failure mobile-overflow-audit exists
        to catch.
      */}
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={active === key ? "page" : undefined}
            className={`min-h-[44px] shrink-0 border-b-2 px-3 text-[14px] font-semibold whitespace-nowrap ${
              active === key
                ? "border-[var(--navy)] text-[var(--ink)]"
                : "border-transparent text-[var(--secondary)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FileDetailShell({
  children,
  tabs,
}: {
  children: (tab: string) => React.ReactNode;
  tabs?: string;
}) {
  const [tab, setTab] = useState(tabs ?? "overview");
  return (
    <div>
      <FileTabs active={tab} onChange={setTab} />
      <div className="pt-5">{children(tab)}</div>
    </div>
  );
}

/** Opening a file. The county field is the one that carries real consequence. */
export function NewFileForm({
  clients,
  services,
  counties,
}: {
  clients: { id: string; name: string }[];
  services: { slug: string; name: string }[];
  counties: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "mt-1.5 min-h-[48px] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-slate";
  const label = "block text-[14px] font-semibold text-[var(--ink)]";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_file",
          clientId: form.get("clientId"),
          serviceSlug: form.get("serviceSlug"),
          propertyAddress: form.get("propertyAddress"),
          city: form.get("city"),
          county: form.get("county"),
          urgency: form.get("urgency"),
          notes: form.get("notes"),
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; id?: string }
        | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setBusy(false);
      router.push(`/portal/files?id=${body.id}`);
      router.refresh();
    } catch {
      setError("The network dropped that.");
      setBusy(false);
    }
  }

  if (clients.length === 0) {
    return (
      <p className="text-[14px] text-[var(--secondary)]">
        Add a client first. A file belongs to somebody.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white hover:bg-[var(--navy-hover)]"
      >
        {open ? "Cancel" : "Open a file"}
      </button>

      {open ? (
        <form
          onSubmit={onSubmit}
          /* V10: no card. A rule above it and whitespace do the separating. */
          className="mt-5 border-t border-[var(--border)] pt-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="clientId" className={label}>Client</label>
              <select id="clientId" name="clientId" required className={field}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="serviceSlug" className={label}>Service line</label>
              <select id="serviceSlug" name="serviceSlug" required className={field}>
                {services.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="propertyAddress" className={label}>Property address</label>
              <input id="propertyAddress" name="propertyAddress" required className={field} />
            </div>
            <div>
              <label htmlFor="city" className={label}>City</label>
              <input id="city" name="city" className={field} />
            </div>
            <div>
              <label htmlFor="county" className={label}>County</label>
              <select id="county" name="county" className={field} defaultValue="">
                <option value="">Derive from the city if possible</option>
                {counties.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--secondary)]">
                The county decides dispatch and whether a windstorm certificate applies. If the city
                is not one the platform knows, choose the county here.
              </p>
            </div>
            <div>
              <label htmlFor="urgency" className={label}>Urgency</label>
              <select id="urgency" name="urgency" defaultValue="standard" className={field}>
                <option value="standard">Standard</option>
                <option value="expedited">Expedited</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notes" className={label}>Notes</label>
              <input id="notes" name="notes" className={field} />
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-4 border-l-2 border-[var(--ink)] pl-3 text-[14px] font-semibold text-[var(--ink)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-4 min-h-[var(--tap-target)] w-full rounded-[2px] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)] disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {busy ? "Opening..." : "Open the file"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
