import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { launchReadiness, launchMode } from "@/lib/launch";
import { Chip, PageHead, Panel } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

/**
 * WHAT STANDS BETWEEN THE FIRM AND LIVE, ON ONE SCREEN.
 *
 * Operator ruling, 2026-09-11, in their words: so I can read what stands
 * between the firm and live without asking.
 *
 * WHY THIS SCREEN EXISTS AT ALL
 * -----------------------------
 * The gate stopped being one variable on 2026-09-10 and became seven
 * conditions. Seven conditions spread across two configuration files and an
 * environment variable is a state nobody can hold in their head, and the failure
 * that produces is specific: somebody sets LAUNCH_MODE=live, sees the site still
 * saying "pending", and concludes the gate is broken. It is not broken. It is
 * answering correctly and saying so nowhere a person looks.
 *
 * IT RENDERS THE GATE'S OWN ANSWER, NOT ITS OWN
 * ---------------------------------------------
 * Every row here comes from `launchReadiness()`, which is the same list
 * `launchBlockers()` maps over. This screen computes nothing about whether a
 * condition is met, because a screen that computed its own version would be a
 * second gate, and the first time the two disagreed the operator would be
 * reading the wrong one.
 *
 * That is the same rule `scripts/lib/surfaces.mjs` states about audits deriving
 * their subject from one declaration, applied to a screen.
 *
 * WHY IT SHOWS THE MET ONES TOO
 * -----------------------------
 * A list of only what is outstanding answers "what is left" and cannot answer
 * "is this thing being checked at all". Showing all seven, with the cleared ones
 * marked, means a condition that quietly stopped being evaluated would be
 * visible as an absence rather than reading as success.
 */
export default async function LaunchReadinessPage() {
  const actor = await currentActor();
  /*
   * roles.manage rather than a permission of its own. Deciding the firm may
   * trade is the same class of act as deciding who may do what, and it is held
   * by the administrator alone. A new action here would be a new door to reason
   * about for a screen that only reads.
   */
  if (!can(actor, "roles.manage")) notFound();

  const rows = launchReadiness();
  const outstanding = rows.filter((r) => r.blocker !== null);
  const mode = launchMode();

  return (
    <>
      <PageHead
        title="Launch readiness"
        lede={
          outstanding.length === 0
            ? "Every condition is met. The gate is open."
            : `${outstanding.length} of ${rows.length} conditions are not met, so the gate is shut.`
        }
      />

      <Panel
        title="The gate"
        description={
          mode === "live"
            ? "launchMode() answers live. The sites may hold the firm out as offering engineering services."
            : "launchMode() answers prelaunch. No surface may state that the firm currently offers or performs engineering services, whatever LAUNCH_MODE is set to."
        }
      >
        <ul className="flex flex-col gap-4">
          {rows.map(({ condition, blocker }) => (
            <li
              key={condition.id}
              className="border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Chip label={blocker === null ? "Met" : "Not met"} tone={blocker === null ? "good" : "warn"} />
                <p className="text-[15px] font-semibold text-[var(--navy)]">{condition.what}</p>
              </div>

              {/*
                * The sentence, which is the whole reason blockers are sentences
                * rather than booleans. What somebody needs when the gate will
                * not open is the reason, and a list of falses is a puzzle.
                */}
              {blocker !== null && (
                <p className="mt-2 text-[14px] leading-[1.65] text-[var(--secondary)]">{blocker}</p>
              )}

              <dl className="mt-2 flex flex-col gap-1 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold">Who clears it</dt>
                  <dd>{condition.whoClears}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold">Stated true in</dt>
                  <dd className="font-mono text-[12.5px]">{condition.statedIn}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="What this screen cannot tell you"
        description="A condition here is an assertion somebody wrote down. Nothing in this platform can see a filing cabinet, a Stripe dashboard or a provider setting, and a screen that implied otherwise would be worse than one that says so."
      >
        <p className="text-[14px] leading-[1.7] text-[var(--secondary)]">
          Each condition is true here when a person stated it true in the file named beside it.
          The compliance audit asserts that the gate reads every one of them and that none
          has been quietly dropped. It deliberately does not verify the outside world, because a
          check that cannot see a thing must not report on it.
        </p>
      </Panel>
    </>
  );
}
