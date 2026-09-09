import { redirect } from "next/navigation";
import { DataTable, RestrictedMode } from "@/components/portal/design";
import { currentActor } from "@/lib/ops-auth";
import { can, roleLabel } from "@/lib/ops-authz";
import { dashboardFor } from "@/lib/ops-dashboard";
import { money } from "@/lib/ops-money";
import type { PeriodTotals } from "@/lib/ops-money";
import type { Column } from "@/components/portal/design";
import { AttentionList, BreakdownList, CountTiles, MoneyTiles, NotComputable } from "@/components/portal/Dashboard";
import { ButtonLink, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

/**
 * The dashboard, for all three roles.
 *
 * WHAT CHANGED, AND WHY THE OLD REASONING IS STILL HERE
 * -----------------------------------------------------
 * This page used to redirect anyone who was not an administrator to their queue,
 * on the reasoning that an engineer's dashboard was the review queue and a
 * technician's was their jobs, so a generic one would be a third empty page.
 * That was correct while it was true.
 *
 * Phase 6 gave the other two roles something a queue does not show them: an
 * engineer's minutes and production for the period alongside the queue depth, a
 * technician's deadlines and what they are owed alongside their offers. Sign in
 * still lands each role on the surface they work in, through homeFor. This is
 * where they come to see the whole picture.
 *
 * EVERY NUMBER HERE IS A LIVE ROW
 * -------------------------------
 * There is no sample data on this page and there never will be. A count of zero
 * renders as zero with a sentence saying what zero means. A money figure nobody
 * has entered renders as "not set", never as $0.00.
 */
type PeriodRow = PeriodTotals & { id: string };

const PERIOD_COLUMNS: Column<PeriodRow>[] = [
  { key: "period", header: "Period", cell: (p) => p.period },
  { key: "files", header: "Files", cell: (p) => `${p.complete} of ${p.files}` },
  { key: "revenue", header: "Revenue", numeric: true, cell: (p) => money(p.revenue) },
  { key: "cost", header: "Cost", numeric: true, cell: (p) => money(p.cost) },
  {
    key: "margin",
    header: "Margin",
    numeric: true,
    cell: (p) => `${money(p.margin)}${p.marginPercent === null ? "" : ` (${p.marginPercent}%)`}`,
  },
  { key: "coverage", header: "Coverage", cell: (p) => p.coverage },
];

export default async function PortalHome() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "files.list") && !can(actor, "offers.list_own")) redirect("/portal/profile");

  const dashboard = await dashboardFor(actor);

  if (!dashboard) {
    /*
     * TWO REASONS FOR NO DASHBOARD, AND THEY ARE NOT THE SAME SENTENCE.
     *
     * This said "this account is not active" for both, which was true while the
     * only way to get null was a suspended account. Since 2026-09-07 a role
     * with no dashboard built for it also lands here, and telling an active
     * dispatcher their account is not active would send them to an
     * administrator to fix something that is not wrong.
     */
    const inactive = actor.status !== "active";
    return (
      <>
        <PageHead eyebrow="Operations" title="Dashboard" />
        <EmptyState
          title={inactive ? "Your dashboard is not available" : "There is no dashboard for your role yet"}
          body={
            inactive
              ? "This account is not active, so nothing is being read on your behalf. Ask an administrator to look at it."
              : "Your account is fine and everything you have access to is in the menu. A dashboard for this role has not been built, and showing you one built for a different job would be worse than showing you none."
          }
        />
      </>
    );
  }

  /*
   * Derived from the role rather than from an else, because the else was the
   * technician's sentence and three new roles arrived behind it. A dispatcher
   * reading "your offers, your deadlines and your pay" is the same defect as a
   * dispatcher being served the technician's tiles, in words.
   */
  const LEDE: Record<typeof dashboard.role, string> = {
    admin:
      "The firm at a glance. Every number is a live row, and a money figure nobody has entered says so rather than showing a zero.",
    engineer: "Your queue, your time and your production for this period. Nothing here is estimated.",
    field_tech: "Your offers, your deadlines and your pay. Nothing here is estimated.",
    dispatcher:
      "What is waiting to be placed, oldest first, and who could take it. Nothing here is estimated.",
    sales:
      "Where the work is coming from and how long it has been sitting. Flow and age only: what the firm makes on any of it is not on this screen.",
    customer_service:
      "What is in flight and who is waiting. Where the platform has never recorded the thing you were meant to see, it says so rather than showing something that looks like it.",
  };
  const lede = LEDE[dashboard.role];

  return (
    <>
      {/*
        "Good to see you, Shots" is gone.

        The standards file's voice rule is terse, neutral and factual, and names
        reassurance and cleverness as things never to write. A greeting is both.
        It also occupied the largest type on the screen, which is the one place
        a dashboard has to say what it is, and said nothing: the reader already
        knows who they are and did not open an operations portal to be greeted.

        The name is not lost. It is in the header's user menu, where somebody
        checks WHICH account they are signed in as, which is the only question a
        name on this screen ever answered.
      */}
      <PageHead
        eyebrow={roleLabel(actor.role)}
        title="Dashboard"
        lede={lede}
        actions={
          dashboard.role === "admin" ? (
            <ButtonLink href="/portal/billing" tone="ghost">
              Billing
            </ButtonLink>
          ) : undefined
        }
      />

      <CountTiles tiles={dashboard.tiles} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title="Needs you"
          description="Only things somebody has to act on. An empty list is a result, not a gap."
        >
          <AttentionList items={dashboard.attention} />
        </Panel>

        {/*
          THREE DASHBOARDS HAVE NO MONEY PANEL, AND THE NARROWING IS THE PROOF.

          A dispatcher, a salesperson and a customer service account hold
          neither ledger.read_all nor billing.read, and the operator's ruling of
          2026-09-08 is that no dashboard for them carries a firm level money
          figure. Their types therefore have no `money` field at all, so this is
          not a condition somebody has to remember to write: reading
          dashboard.money without narrowing first does not compile, and it did
          not, which is how this branch came to exist.
        */}
        {"money" in dashboard ? (
          <Panel
            title={dashboard.role === "field_tech" ? "Your pay" : "Money"}
            description={
              dashboard.role === "admin"
                ? "Totals cover only files where every figure is present."
                : "Read from the ledger, not recalculated here."
            }
          >
            <MoneyTiles tiles={dashboard.money} />
          </Panel>
        ) : (
          <Panel
            title="What could not be counted"
            description="Reported rather than fixed by widening a grant or inventing a figure that looks like the one that was asked for."
          >
            <NotComputable reasons={dashboard.notComputable} />
          </Panel>
        )}
      </div>

      {/*
        A grouped answer, where one number is not the answer. "Unassigned jobs"
        is a tile; "unassigned jobs by county and age" is what a dispatcher acts
        on, and it does not fit in one.
      */}
      {"breakdowns" in dashboard
        ? dashboard.breakdowns.map((b) => (
            <Panel key={b.title} className="mt-4" title={b.title} description={b.note}>
              <BreakdownList breakdown={b} />
            </Panel>
          ))
        : null}

      {dashboard.role === "admin" && dashboard.periods.length > 0 ? (
        <Panel
          className="mt-4"
          title="Margin by period"
          description="A file counts toward a period on the month it was delivered, or the month it was opened if it has not been."
          actions={
            <ButtonLink href="/api/portal/exports?report=period" tone="ghost">
              Export
            </ButtonLink>
          }
        >
          <DataTable
            caption="Margin by period"
            rows={dashboard.periods.slice(0, 12).map((p) => ({ ...p, id: p.period }))}
            total={dashboard.periods.length}
columns={PERIOD_COLUMNS}
            empty={<EmptyState title="No periods yet" body="A period appears here once a file is opened in it." />}
          />
        </Panel>
      ) : null}

      <RestrictedMode also="Files can be created and prepared. The platform enforces the rest rather than trusting anyone to remember it." />
    </>
  );
}
