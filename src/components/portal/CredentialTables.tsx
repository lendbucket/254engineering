import type { CredentialStanding } from "@/lib/ops-credentials";
import { CREDENTIAL_LABEL } from "@/lib/ops-credentials";
import { formatCalendarDate } from "@/lib/firm-calendar";

/**
 * The two credential tables, shared by the administrator's page for a
 * technician and the technician's own read-only view on /portal/certification,
 * so the two can never word a state differently.
 *
 * Design V10 rule 8: no header fill, a 1px line under the header, a 1px line
 * between rows. No status colour: a state that stops dispatch is said in words
 * and in weight, never in red or amber.
 */

const longDate = (iso: string | null) =>
  iso
    ? (formatCalendarDate(iso.slice(0, 10), { year: "numeric", month: "long", day: "numeric" }) ?? "")
    : null;

/** The words for each state. Urgent ones are rendered bold by the caller. */
export function standingWords(s: CredentialStanding): string {
  switch (s.state) {
    case "exempt":
      return "Not required: covered by the owner exemption";
    case "missing":
      return "Missing. Dispatch refuses until it is recorded";
    case "unverified":
      return "On file, not verified. Dispatch refuses until it is";
    case "expired":
      return `Expired${s.lapsedOn ? ` on ${longDate(s.lapsedOn)}` : ""}. Dispatch refuses until a current one is recorded`;
    case "expiring":
      return `Recorded. Expires in ${s.days} day${s.days === 1 ? "" : "s"}`;
    case "recorded":
      return s.current?.expiresOn ? "Recorded" : "Recorded, does not expire";
  }
}

const URGENT = new Set(["missing", "unverified", "expired", "expiring"]);

export function CredentialStandingTable({ standing }: { standing: CredentialStanding[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th scope="col" className="py-2 pr-4 text-[13px] font-semibold text-[var(--secondary)]">Credential</th>
            <th scope="col" className="py-2 pr-4 text-[13px] font-semibold text-[var(--secondary)]">Standing</th>
            <th scope="col" className="py-2 pr-4 text-[13px] font-semibold text-[var(--secondary)]">On record</th>
            <th scope="col" className="py-2 text-[13px] font-semibold text-[var(--secondary)]">Expires</th>
          </tr>
        </thead>
        <tbody>
          {standing.map((s) => (
            <tr key={s.kind} className="border-b border-[var(--row-rule)] align-top">
              <td className="py-3 pr-4 font-semibold text-[var(--ink)]">{s.label}</td>
              <td className={`py-3 pr-4 ${URGENT.has(s.state) ? "font-semibold text-[var(--ink)]" : "text-[var(--secondary)]"}`}>
                {standingWords(s)}
              </td>
              <td className="py-3 pr-4 text-[var(--secondary)]">{s.current?.label ?? (s.current ? "Recorded" : "Nothing current")}</td>
              <td className="py-3 text-[var(--secondary)]">{longDate(s.current?.expiresOn ?? null) ?? (s.current ? "Does not expire" : "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The same standing as rows, for a narrow column: the technician's own view. Same words as the table. */
export function CredentialStandingList({ standing }: { standing: CredentialStanding[] }) {
  return (
    <ul className="mt-3 border-t border-[var(--row-rule)]">
      {standing.map((s) => (
        <li key={s.kind} className="border-b border-[var(--row-rule)] py-3">
          <p className="text-[14px] font-semibold text-[var(--ink)]">{s.label}</p>
          <p className={`mt-0.5 text-[14px] leading-[1.5] ${URGENT.has(s.state) ? "font-semibold text-[var(--ink)]" : "text-[var(--secondary)]"}`}>
            {standingWords(s)}
          </p>
          {s.current?.expiresOn ? (
            <p className="text-[13px] text-[var(--secondary)]">Expires {longDate(s.current.expiresOn)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export type HistoryRow = {
  id: string;
  kind: CredentialStanding["kind"];
  label: string | null;
  status: string;
  issuedOn: string | null;
  expiresOn: string | null;
  recordedAt: string;
  verifiedByName: string | null;
};

/** The history as rows, for a phone. The same facts as the table. */
export function CredentialHistoryList({ history }: { history: HistoryRow[] }) {
  if (history.length === 0) {
    return <p className="mt-4 text-[14px] text-[var(--secondary)]">No credential has been recorded for this technician.</p>;
  }
  return (
    <ul className="mt-3 border-t border-[var(--row-rule)]">
      {history.map((h) => (
        <li key={h.id} className="border-b border-[var(--row-rule)] py-3 text-[14px]">
          <p className="font-semibold text-[var(--ink)]">{CREDENTIAL_LABEL[h.kind] ?? h.kind}</p>
          {h.label ? <p className="text-[var(--secondary)]">{h.label}</p> : null}
          {h.status !== "verified" ? <p className="font-semibold text-[var(--ink)]">Status {h.status}</p> : null}
          <p className="mt-1 text-[13px] text-[var(--secondary)]">
            Issued {longDate(h.issuedOn) ?? "not recorded"}. {h.expiresOn ? `Expires ${longDate(h.expiresOn)}.` : "Does not expire."}
          </p>
          <p className="text-[13px] text-[var(--secondary)]">
            Recorded {longDate(h.recordedAt)}, verified by {h.verifiedByName ?? "nobody recorded"}.
          </p>
        </li>
      ))}
    </ul>
  );
}

export function CredentialHistoryTable({ history }: { history: HistoryRow[] }) {
  if (history.length === 0) {
    return <p className="mt-4 text-[14px] text-[var(--secondary)]">No credential has been recorded for this technician.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th scope="col" className="py-2 pr-4 text-[13px] font-semibold text-[var(--secondary)]">Recorded</th>
            <th scope="col" className="py-2 pr-4 text-[13px] font-semibold text-[var(--secondary)]">Credential</th>
            <th scope="col" className="py-2 pr-4 text-[13px] font-semibold text-[var(--secondary)]">Issued or effective</th>
            <th scope="col" className="py-2 pr-4 text-[13px] font-semibold text-[var(--secondary)]">Expires</th>
            <th scope="col" className="py-2 text-[13px] font-semibold text-[var(--secondary)]">Verified by</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id} className="border-b border-[var(--row-rule)] align-top">
              <td className="py-3 pr-4 text-[var(--secondary)]">{longDate(h.recordedAt)}</td>
              <td className="py-3 pr-4 text-[var(--ink)]">
                {CREDENTIAL_LABEL[h.kind] ?? h.kind}
                {h.label ? <span className="block text-[13px] text-[var(--secondary)]">{h.label}</span> : null}
                {h.status !== "verified" ? <span className="block text-[13px] font-semibold">Status {h.status}</span> : null}
              </td>
              <td className="py-3 pr-4 text-[var(--secondary)]">{longDate(h.issuedOn) ?? "Not recorded"}</td>
              <td className="py-3 pr-4 text-[var(--secondary)]">{longDate(h.expiresOn) ?? "Does not expire"}</td>
              <td className="py-3 text-[var(--secondary)]">{h.verifiedByName ?? "Not recorded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
