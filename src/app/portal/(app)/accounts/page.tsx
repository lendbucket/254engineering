import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { accountRows } from "@/lib/ops-accounts-admin";
import { ACCOUNT_PAGE_SIZE, accountListQuery } from "@/lib/account-list";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { AccountsClient } from "./AccountsClient";
import { OpenAccountClient } from "./OpenAccountClient";

export const dynamic = "force-dynamic";

/**
 * Ordering accounts: who orders regularly, what they owe, and on what terms.
 *
 * THE COLUMN THAT MATTERS IS "CAN THEY ORDER"
 * -------------------------------------------
 * Volume and balance are worth seeing, but the question an operator opens this
 * screen with is which accounts are stuck. That column is computed from the same
 * creditDecision the ordering path uses, so this screen and the refusal a
 * customer sees can never disagree about why.
 *
 * THE BALANCE IS TWO FIGURES, NOT ONE
 * -----------------------------------
 * Issued and unpaid is what they owe. Unbilled is work done that no statement
 * covers yet. Summing them into one number hides which of the two is growing,
 * and they call for completely different actions.
 */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  /*
   * THE PAGE'S OWN SHARE, beside [accounts.timing], Robert's answer 4 of
   * 2026-10-28. The W2 walk measured 8.4 to 9.1 seconds of application code
   * here while accountRows reported 3.6 to 4.7, so about half the time is
   * outside it. This line times the session read and accountRows from the
   * page's side and counts the rows handed to the render; the server's own
   * "GET /portal/accounts ... application-code" figure minus this total is the
   * render. Durations and counts only, never a row.
   */
  const startedAt = Date.now();
  const actor = await currentActor();
  const actorMs = Date.now() - startedAt;
  if (!actor) redirect("/portal/login");
  if (!can(actor, "accounts.manage")) redirect("/portal");

  /*
   * ONE PAGE, CHOSEN ON THE SERVER, Robert's answer 4 of 2026-10-28. The
   * search, the filters, the sort and the page live in the address, so a
   * filtered list can be bookmarked, sent, printed and reloaded, and the
   * search covers every account rather than the fifty on screen.
   */
  const params = await searchParams;
  const query = accountListQuery(params);
  const rowsAt = Date.now();
  const result = await accountRows(query);
  console.log(
    `[accounts.page.timing] total=${Date.now() - startedAt}ms actor=${actorMs}ms accountRows=${Date.now() - rowsAt}ms ` +
      `rendered=${result.ok ? result.rows.length : "unread"}`,
  );

  /*
   * ===========================================================================
   * AN ABSENCE IS RENDERED AS AN ABSENCE. Operator ruling, 2026-09-24.
   * ===========================================================================
   *
   * This screen used to receive an array and could not tell "the firm has no
   * ordering accounts", which is a real answer and gets an encouraging empty
   * state, from "the reads failed", which is not an answer at all. Worse, on
   * 2026-09-24 the reads did not fail visibly: they failed and were turned into
   * empty lists upstream, so the screen rendered 529 accounts every one of
   * which read "Unknown organization" with no orders, no seats and no open
   * statement, beside real outstanding balances.
   *
   * A screen that states a figure it could not compute is the defect this
   * platform spends its time removing. So the reasons are shown, the table is
   * not, and nothing here is a number.
   */
  if (!result.ok) {
    return (
      <>
        <PageHead
          eyebrow="Money"
          title="Ordering accounts"
          lede="This screen could not be computed. Nothing below is a figure, because a figure from a read that failed is a plausible number rather than a missing one."
        />
        <Panel title="Not computed">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {result.unavailable.map((why) => (
              <li key={why}>{why}</li>
            ))}
          </ul>
        </Panel>
      </>
    );
  }

  /*
   * THE WARNING AND THE UNBILLED COUNT ARE OVER EVERY ACCOUNT, NOT THIS PAGE.
   * Both used to be computed from the rows handed to the screen, which was
   * every account; computed from a page they would be the length of a sample
   * read as a count, and an account that cannot order would vanish from the
   * warning by being on page two.
   */
  const rows = result.rows;
  const blocked = result.blocked;
  const unbilledAccounts = result.unbilledAccounts;
  const filtered =
    query.term !== "" || query.status !== "all" || query.billing !== "all" || query.attention !== "all";
  const keep = { q: params.q, status: params.status, billing: params.billing, attention: params.attention, sort: params.sort, dir: params.dir };

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Ordering accounts"
        lede="Organizations that order regularly. What they have ordered, what they owe, and whether they can order right now."
      />

      {result.all === 0 ? (
        <>
          {/*
            THIS COPY WENT OUT OF DATE THE DAY THE TELEPHONE DOOR WAS BUILT.

            It said an account is created by converting an existing client
            organisation, full stop, which was true while that was the only
            path. There are three now, and a screen that names one of them is
            the same defect as a registry that names a door nobody built.
          */}
          <EmptyState
            title="No ordering accounts yet"
            body="An account arrives one of three ways: somebody rings and you open one below, somebody pays for an order, or an existing client organization is converted, which keeps every file and document already attached to them."
          />
          <div className="mt-4">
            <OpenAccountClient />
          </div>
        </>
      ) : (
        <>
          {blocked.length > 0 ? (
            <div className="mb-4 rounded-[2px] border-l-2 border-[var(--ink)] px-4 py-3.5">
              <p className="portal-kicker text-[var(--ink)]">
                {blocked.length} account{blocked.length === 1 ? "" : "s"} cannot order
              </p>
              <ul className="mt-2 space-y-1">
                {blocked.map((r) => (
                  <li key={r.id} className="text-[14px] leading-[1.55] text-[var(--ink)]">
                    <span className="font-semibold">{r.clientName}</span>: {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            ABOVE THE LIST AND BELOW THE WARNING.

            The question this screen is opened with is which accounts are stuck,
            and that warning stays first. Opening an account from a call is the
            other thing an operator comes here to do, and it is a disclosure
            rather than a form so it costs one line until it is wanted.
          */}
          {/*
            IN A PANEL, WITH A TITLE, AND THE SCREENSHOT IS WHAT SAID SO.

            The first version put the control straight onto the page
            background. Every check was green: no overflow, tap targets fine,
            contrast fine, and at both widths it worked. Opening the screenshot
            showed a form with no heading, floating outside the white surface
            every other block on this screen sits in, beginning mid sentence
            with "For somebody who has rung". An operator scanning the page had
            nothing telling them what it was.

            Nothing on the board measures whether a form is labelled, which is
            the same shape as the queue screen that was 38,744 pixels tall and
            correct by every question anybody had asked.
          */}
          <div className="mb-4">
            <Panel
              title="Open an account"
              description="From a telephone call, for somebody who is not yet a customer."
            >
              <OpenAccountClient />
            </Panel>
          </div>

          <ListControls
            action="/portal/accounts"
            search={params.q ?? ""}
            searchLabel="Search by organization"
            filters={[
              {
                name: "status",
                label: "Status",
                value: query.status,
                options: [
                  { value: "all", label: "Every status" },
                  { value: "active", label: "Active" },
                  { value: "suspended", label: "Suspended" },
                  { value: "closed", label: "Closed" },
                ],
              },
              {
                name: "billing",
                label: "Pays",
                value: query.billing,
                options: [
                  { value: "all", label: "Card or invoice" },
                  { value: "invoice", label: "On invoice" },
                  { value: "card", label: "By card" },
                ],
              },
              {
                name: "attention",
                label: "Ordering",
                value: query.attention,
                options: [
                  { value: "all", label: "Every account" },
                  { value: "cannot_order", label: "Cannot order" },
                ],
              },
            ]}
            sorts={[{ value: "added", label: "Opened" }, { value: "name", label: "Organization" }]}
            sort={query.sort}
            direction={query.ascending ? "asc" : "desc"}
            /*
             * EVERY MATCHING ACCOUNT AS A CSV. Robert, 2026-10-28, 16:11
             * Central: the same query and filters as this page, owner or admin
             * only. The link carries this page's query, and is drawn only for
             * the grant the export door asks.
             */
            csvHref={can(actor, "accounts.manage") ? listHref("/api/portal/exports", keep, { report: "accounts" }) : undefined}
          />
          <Panel
            title={
              filtered
                ? `${result.total} matching account${result.total === 1 ? "" : "s"}, of ${result.all}`
                : `${result.all} account${result.all === 1 ? "" : "s"}`
            }
            description={
              unbilledAccounts > 0
                ? `${unbilledAccounts} account${unbilledAccounts === 1 ? " has" : "s have"} work that no statement covers yet.`
                : "Every invoiced account is billed up to date."
            }
          >
            {rows.length === 0 ? (
              <EmptyState
                title="No account matches that search"
                body="Clear the search or a filter to see every account."
              />
            ) : null}
            <AccountsClient
              rows={rows.map((r) => ({
                id: r.id,
                clientName: r.clientName,
                status: r.status,
                billingMode: r.billingMode,
                creditLimitCents: r.creditLimitCents,
                netDays: r.netDays,
                orders: r.orders,
                ordersThisPeriod: r.ordersThisPeriod,
                issuedUnpaidCents: r.issuedUnpaidCents,
                unbilledCents: r.unbilledCents,
                oldestUnpaidDays: r.oldestUnpaidDays,
                canOrder: r.canOrder,
                blockedReason: r.blockedReason,
                users: r.users,
                openStatement: r.openStatement,
              }))}
              pager={
                <Pager
                  page={result.page}
                  pageSize={ACCOUNT_PAGE_SIZE}
                  total={result.total}
                  hrefFor={(p) => listHref("/portal/accounts", keep, { page: String(p) })}
                />
              }
            />
          </Panel>

          <p className="mt-4 text-[14px] leading-[1.6] text-[var(--secondary)]">
            Nothing chases an overdue statement automatically. There are no reminders, no late fees
            and no automatic suspension: the only consequence is that an overdue account cannot place
            further invoiced work, and the reason is shown to them when they try.{" "}
            <Chip label="by design" tone="neutral" />
          </p>
        </>
      )}
    </>
  );
}
