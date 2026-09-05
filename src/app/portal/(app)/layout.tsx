import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { RELEASE, ENVIRONMENT } from "@/lib/ops-observability";
import { currentActor } from "@/lib/ops-auth";
import { mispointing } from "@/lib/db-guard";
import { MispointedDeployment } from "@/components/portal/Mispointed";
import { listNotifications, unreadCount } from "@/lib/ops-notify";
import { can, ROLE_LABEL, may } from "@/lib/ops-authz";
import { navFor, mobileTabsFor } from "@/components/portal/nav";
import {
  CommandPalette,
  MobileMore,
  MobileTabs,
  NotificationBell,
  ProfileMenu,
  SidebarNav,
} from "@/components/portal/PortalChrome";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * The portal shell.
 *
 * WHY THE GUARD IS HERE AS WELL AS IN THE PROXY
 * ---------------------------------------------
 * src/proxy.ts already keeps unauthenticated requests off /portal, and this
 * checks again. The reasoning is the same one recorded in the proxy: a matcher
 * is a pattern, and a pattern is one typo from leaving a route uncovered while
 * every test that goes through the matcher still passes.
 *
 * This layout wraps every portal page, so a route added tomorrow inherits the
 * check whether or not anyone remembered the matcher. It is the lock. The proxy
 * is the gate.
 *
 * THE SESSION IS RESOLVED ON THE SERVER, ONCE
 * -------------------------------------------
 * currentActor reads the cookie and then reads the profile, so a suspended
 * account or a changed role takes effect on the next request rather than when a
 * twelve hour cookie expires. Navigation is derived from the same authorization
 * matrix the route handlers use, so a link exists exactly when the thing behind
 * it is permitted.
 */

/*
 * Dynamic, and it has to be.
 *
 * Every page under here is a function of who is asking. A cached render would
 * serve one person's queue to another, which is the failure this whole layer
 * exists to prevent.
 */
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  /*
   * Checked before anything reads the database, because the throw in
   * supabase.ts would otherwise reach the person as a stack trace. That throw
   * is what actually protects the data; this is the same fact addressed to
   * whoever is standing in front of it.
   */
  const mispointed = mispointing();
  if (mispointed) return <MispointedDeployment fault={mispointed} />;

  const actor = await currentActor();

  if (!actor) {
    const path = (await headers()).get("x-invoke-path") ?? "/portal";
    redirect(`/portal/login?next=${encodeURIComponent(path)}`);
  }

  if (actor.status === "suspended") {
    redirect("/portal/login?suspended=1");
  }

  /*
   * may() rather than can(), because two nav entries point at the engineer's
   * screens and can() cannot be handed a licensed action. The menu now asks
   * exactly what the screen behind it asks, so a link cannot appear for
   * somebody the page would then refuse.
   */
  const items = navFor(actor.role, (action) => may(actor, action));
  const tabs = mobileTabsFor(items);
  const overflow = items.filter((i) => !tabs.some((t) => t.href === i.href));

  /*
   * The bell reads through ops-notify rather than querying here, so the one
   * place that knows what a notification is stays the one place. It has read
   * real rows since Phase 0; Phase 5 is when anything started writing them.
   */
  const notifications = await listNotifications(actor.id, 12);
  const list = notifications.map((n) => ({
    id: String(n.id),
    title: n.title,
    body: n.body,
    href: n.href,
    created_at: n.created_at,
    read: Boolean(n.read_at),
  }));
  const unread = await unreadCount(actor.id);

  return (
    <div className="portal-surface min-h-dvh">
      {/* Desktop sidebar. Fixed, dark, and the same navy the public site uses. */}
      {/*
        230px and flat. The standards file gives the width, and it forbids
        gradients outright: a gradient on a fixed rail is the thing that dates
        an interface fastest, and this one ran navy to navy so it was carrying
        no information at all.
      */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col bg-[var(--navy)] lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/portal" aria-label="254 Engineering portal" className="block">
            <Wordmark onDark height={34} />
          </Link>
          <p className="portal-kicker mt-2 text-[var(--gold-bright)]">Operations</p>
        </div>
        {/*
          min-h-0 is load bearing. A flex child defaults to min-height:auto,
          which refuses to shrink below its content, so flex-1 alone lets the
          box grow past the rail and the overflow never becomes a scroll. It
          happened to work here because the rail is inset-y-0 and the box was
          already constrained, and that is exactly the kind of accident that
          stops being true when somebody adds a second footer.

          .portal-rail-scroll is what makes the scroll visible rather than
          merely possible. The reasoning is written out beside the class.
        */}
        <div className="portal-rail-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav items={items} />
        </div>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[12px] leading-[1.5] text-white/55">
            Firm registration pending with TBPELS. No engineer of record is yet in responsible
            charge.
          </p>
          {/*
            The version footer the standards file asks for, carrying values the
            platform actually has: the commit this deployment was built from and
            which environment it is. Both come from the environment Vercel sets,
            and RELEASE is the same string the error store tags every fault with,
            so a fault report and a screenshot can be matched to each other.

            This is not the feature flag and environment banner system in the
            build roadmap. It is two facts that already exist, displayed.
          */}
          <p className="mt-3 font-mono text-[12px] leading-[1.5] text-white/40">
            {RELEASE} · {ENVIRONMENT}
          </p>
        </div>
      </aside>

      <div className="lg:pl-[var(--sidebar-width)]">
        {/*
          WHITE ON DESKTOP, NAVY ON A PHONE, AND THAT IS THE DESIGN.

          The standards file specifies a 58px white header beside the navy rail.
          On a phone there is no rail, so the header IS the navy chrome and
          carries the logo; making it white there would leave the screen with no
          brand surface at all and a status bar that does not match the app.
        */}
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--navy)] pt-[env(safe-area-inset-top)] lg:border-[var(--border)] lg:bg-white">
          <div className="flex min-h-[var(--header-height)] items-center gap-2 px-3 sm:px-5">
            <div className="lg:hidden">
              <Link href="/portal" aria-label="254 Engineering portal" className="block py-2">
                <Wordmark onDark height={26} />
              </Link>
            </div>
            {/*
              The render time, and it is honest rather than decorative.

              Every portal route is force-dynamic, so this page was built from
              the database at this moment and the figure below is the truth
              about how stale what you are reading is. On a cached surface the
              same line would be a lie, which is why it says "data as of" and
              not "last updated".
            */}
            <p className="ml-3 hidden text-[12px] text-[var(--secondary)] lg:block">
              Data as of{" "}
              {new Date().toLocaleTimeString("en-US", {
                timeZone: "America/Chicago",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              CT
            </p>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <CommandPalette items={items} />
              <NotificationBell unread={unread} items={list} />
              <MobileMore items={overflow} />
              <ProfileMenu
                displayName={actor.display_name}
                roleLabel={ROLE_LABEL[actor.role]}
                email={actor.email}
              />
            </div>
          </div>
        </header>

        {/* pb accounts for the fixed tab bar plus the home indicator. */}
        <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-[var(--section-gap)] px-[var(--page-gutter)] py-6 pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-10">
          {children}
        </main>
      </div>

      <MobileTabs items={tabs} />
    </div>
  );
}
