import Link from "next/link";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, Panel, ButtonLink } from "@/components/portal/surfaces";
import { telLink } from "@/lib/phone-link";
import { PROSPECT_TYPE_LABEL } from "@/lib/prospect-import";
import type { ProspectRow } from "@/lib/ops-prospects";
import type { CallbackRow } from "@/lib/staff-desk";
import { formatInFirmZone } from "@/lib/firm-calendar";

/**
 * TODAY'S CALL LIST, ON THE REP'S HOME SCREEN. Office ready, 2026-10-20.
 *
 * Every open prospect whose follow-up date is today or earlier, oldest date
 * first. Every number dials, and logging the call is one click from the row.
 * The list is the rep's own prospects and the ones nobody owns yet.
 */
export function CallListPanel({ rows, today }: { rows: ProspectRow[] | null; today: string | null }) {
  const columns: Column<ProspectRow>[] = [
    {
      key: "company",
      header: "Company",
      cell: (r) => (
        <Link href={`/portal/prospects/${r.id}`} className="font-semibold text-[var(--navy)] underline">
          {r.company}
        </Link>
      ),
    },
    { key: "contact", header: "Contact", cell: (r) => r.contactName ?? "No name on file" },
    {
      key: "phone",
      header: "Phone",
      cell: (r) => {
        const href = telLink(r.phone);
        return href ? (
          <a href={href} className="font-semibold text-[var(--navy)] underline">
            {r.phone}
          </a>
        ) : (
          r.phone ?? "No phone"
        );
      },
    },
    { key: "city", header: "City", cell: (r) => r.city ?? "", desktopOnly: true },
    { key: "type", header: "Type", cell: (r) => PROSPECT_TYPE_LABEL[r.prospectType], desktopOnly: true },
    {
      key: "due",
      header: "Follow up",
      cell: (r) => (r.followUpOn && today && r.followUpOn < today ? `${r.followUpOn}, overdue` : r.followUpOn ?? ""),
    },
    { key: "last", header: "Last contact", cell: (r) => (r.lastContactAt ? formatInFirmZone(r.lastContactAt) : "Never"), desktopOnly: true },
    {
      key: "log",
      header: "Log",
      cell: (r) => (
        <Link href={`/portal/prospects/${r.id}#log`} className="font-semibold text-[var(--navy)] underline">
          Log a call
        </Link>
      ),
    },
  ];

  return (
    <Panel
      className="mt-6"
      title={today ? `Today's calls, ${today}` : "Today's calls"}
      description="Prospects due a follow-up today or earlier, the oldest date first. Yours and the ones nobody owns yet."
      actions={
        <ButtonLink href="/portal/prospects" tone="ghost">
          Sales list
        </ButtonLink>
      }
    >
      {rows === null ? (
        <EmptyState
          title="The call list could not be read"
          body="The reason is listed under What could not be counted. Nothing here means nobody is due a call."
        />
      ) : (
        <DataTable
          caption="Today's calls"
          rows={rows}
          total={rows.length}
          columns={columns}
          empty={
            <EmptyState
              title="No calls are due today"
              body="Every prospect with a follow-up date has one in the future. Import a spreadsheet or add a prospect from the sales list to fill tomorrow's list."
              action={<ButtonLink href="/portal/prospects">Open the sales list</ButtonLink>}
            />
          }
        />
      )}
    </Panel>
  );
}

/** How long a callback has waited, in the words an office uses: "12 minutes", "2 hours 5 minutes", "1 day 3 hours". */
export function waitedFor(dueAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(dueAt)) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (days) return hours ? `${part(days, "day")} ${part(hours, "hour")}` : part(days, "day");
  if (hours) return mins ? `${part(hours, "hour")} ${part(mins, "minute")}` : part(hours, "hour");
  return part(mins, "minute");
}

/**
 * CALLBACKS ASKED FOR ON /start, AT THE TOP OF THE CALL LIST (Robert's add-on
 * of 2026-11-15, item 15). Oldest due first, each with how long it has waited.
 * The name opens the lead in the inbox, where "Mark contacted" takes it off
 * this list.
 */
export function CallbacksPanel({ rows, letterNames }: { rows: CallbackRow[] | null; letterNames: Record<string, string> }) {
  const now = Date.now();
  const columns: Column<CallbackRow>[] = [
    {
      key: "name",
      header: "Who",
      cell: (r) => (
        <Link href={`/portal/inbox?q=${encodeURIComponent(r.phone ?? r.name ?? "")}`} className="font-semibold text-[var(--navy)] underline">
          {r.name ?? "No name given"}
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      cell: (r) => {
        const href = telLink(r.phone);
        return href ? (
          <a href={href} className="font-semibold text-[var(--navy)] underline">
            {r.phone}
          </a>
        ) : (
          r.phone ?? "No phone"
        );
      },
    },
    { key: "letter", header: "Letter", cell: (r) => (r.letter ? (letterNames[r.letter] ?? r.letter) : "Not chosen"), desktopOnly: true },
    { key: "waited", header: "Waiting", cell: (r) => waitedFor(r.dueAt, now) },
  ];

  return (
    <Panel
      className="mt-6"
      title="Callbacks waiting"
      description="People who asked the office to call them back, the longest waiting first. One asked for after 8 PM appears at 8 AM."
    >
      {rows === null ? (
        <EmptyState title="The callbacks could not be read" body="The reason is listed under What could not be counted. Nothing here means nobody is waiting." />
      ) : (
        <DataTable
          caption="Callbacks waiting"
          rows={rows}
          total={rows.length}
          columns={columns}
          empty={<EmptyState title="Nobody is waiting for a callback" body="A request from the price finder on /start appears here the moment it is due." />}
        />
      )}
    </Panel>
  );
}
