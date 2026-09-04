import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, ROLE_LABEL } from "@/lib/ops-authz";
import { dashboardFor } from "@/lib/ops-dashboard";
import { isPrelaunch } from "@/lib/launch";
import { money } from "@/lib/ops-money";
import { AttentionList, CountTiles, MoneyTiles } from "@/components/portal/Dashboard";
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
export default async function PortalHome() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!can(actor, "files.list") && !can(actor, "offers.list_own")) redirect("/portal/profile");

  const dashboard = await dashboardFor(actor);

  if (!dashboard) {
    return (
      <>
        <PageHead eyebrow="Operations" title="Dashboard" />
        <EmptyState
          title="Your dashboard is not available"
          body="This account is not active, so nothing is being read on your behalf. Ask an administrator to look at it."
        />
      </>
    );
  }

  const lede =
    dashboard.role === "admin"
      ? "The firm at a glance. Every number is a live row, and a money figure nobody has entered says so rather than showing a zero."
      : dashboard.role === "engineer"
        ? "Your queue, your time and your production for this period. Nothing here is estimated."
        : "Your offers, your deadlines and your pay. Nothing here is estimated.";

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
        eyebrow={ROLE_LABEL[actor.role]}
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
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-limestone-line">
                  {["Period", "Files", "Revenue", "Cost", "Margin", "Coverage"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="py-2 pr-4 text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboard.periods.slice(0, 12).map((p) => (
                  <tr key={p.period} className="border-b border-limestone-line last:border-0">
                    <td className="py-2.5 pr-4 align-top text-[13.5px] font-semibold text-slate">{p.period}</td>
                    <td className="py-2.5 pr-4 align-top text-[13.5px] text-slate">
                      {p.complete} of {p.files}
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[13.5px] text-slate">{money(p.revenue)}</td>
                    <td className="py-2.5 pr-4 align-top text-[13.5px] text-slate">{money(p.cost)}</td>
                    <td className="py-2.5 pr-4 align-top text-[13.5px] font-semibold text-slate">
                      {money(p.margin)}
                      {p.marginPercent === null ? "" : ` (${p.marginPercent}%)`}
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[12px] leading-[1.45] text-slate-muted">
                      {p.coverage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {isPrelaunch() ? (
        <div className="mt-6 rounded-[4px] border border-[#f0d9a8] bg-[#fdf3e0] px-4 py-3.5">
          <p className="text-[13px] font-bold tracking-[0.1em] text-[#7a4c05] uppercase">
            Compliance gate active
          </p>
          <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.6] text-[#7a4c05]">
            Firm registration with TBPELS is pending and no Professional Engineer is in responsible
            charge. Files can be created and prepared, and no file can reach sealed or delivered.
            The platform enforces that rather than trusting anyone to remember it.
          </p>
        </div>
      ) : null}
    </>
  );
}
