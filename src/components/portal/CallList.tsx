import Link from "next/link";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, Panel, ButtonLink } from "@/components/portal/surfaces";
import { telLink } from "@/lib/phone-link";
import { PROSPECT_TYPE_LABEL } from "@/lib/prospect-import";
import type { ProspectRow } from "@/lib/ops-prospects";
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
