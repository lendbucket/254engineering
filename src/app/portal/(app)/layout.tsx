import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentActor } from "@/lib/ops-auth";
import { previewPointingAtProduction } from "@/lib/db-guard";
import { MispointedPreview } from "@/components/portal/MispointedPreview";
import { listNotifications, unreadCount } from "@/lib/ops-notify";
import { can, ROLE_LABEL } from "@/lib/ops-authz";
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
  if (previewPointingAtProduction()) return <MispointedPreview />;

  const actor = await currentActor();

  if (!actor) {
    const path = (await headers()).get("x-invoke-path") ?? "/portal";
    redirect(`/portal/login?next=${encodeURIComponent(path)}`);
  }

  if (actor.status === "suspended") {
    redirect("/portal/login?suspended=1");
  }

  const items = navFor(actor.role, (action) => can(actor, action));
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
    <div className="min-h-dvh bg-limestone">
      {/* Desktop sidebar. Fixed, dark, and the same navy the public site uses. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-gradient-to-b from-slate to-slate-deep lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/portal" aria-label="254 Engineering portal" className="block">
            <Wordmark onDark height={34} />
          </Link>
          <p className="mt-2 text-[10px] font-bold tracking-[0.16em] text-brass-light uppercase">
            Operations
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav items={items} />
        </div>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-[11px] leading-[1.5] text-slate-fg/55">
            Firm registration pending with TBPELS. No engineer of record is yet in responsible
            charge.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        {/* The top bar, on both form factors. */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-deep pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-[60px] items-center gap-2 px-3 sm:px-5">
            <div className="lg:hidden">
              <Link href="/portal" aria-label="254 Engineering portal" className="block py-2">
                <Wordmark onDark height={26} />
              </Link>
            </div>
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
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileTabs items={tabs} />
    </div>
  );
}
