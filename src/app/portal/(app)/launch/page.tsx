import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { launchReadiness, launchMode } from "@/lib/launch";
import { lineIsSellable } from "@/lib/line-gate";
import { offeredServiceLines } from "@/config/launch-conditions";
import { deliverablesFor } from "@data/catalog";
import { Chip, PageHead, Panel } from "@/components/portal/surfaces";
import { OWNER_OVERRIDE, OWNER_OVERRIDE_ACTION, OWNER_OVERRIDES } from "@/lib/owner-override";

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
  /*
   * ONE ROW PER DELIVERABLE WHERE A LINE SELLS MORE THAN ONE. WPI-8's two
   * tiers run under two protocols (254-WS-001 completed, 254-WP-001 ongoing),
   * and asked with no tier the door finds no protocol for the line, so the row
   * read Closed for a line whose every tier could be sellable. Since Robert's
   * ruling of 2026-10-25, 23:50 Central put it on sale, each tier is asked as
   * the order page asks it.
   */
  const sellability = await Promise.all(
    offeredServiceLines.flatMap((slug) => {
      const tiers = deliverablesFor(slug).map((d) => d.tier);
      return (tiers.length > 1 ? tiers : [null]).map(async (tier) => ({
        slug: tier ? `${slug}, ${tier}` : slug,
        sellable: await lineIsSellable(slug, tier),
      }));
    }),
  );

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
        /*
          THREE STATES, SO THREE SENTENCES. A screen that renders two answers
          for a three valued fact folds two of them together, and the two it
          would fold are "the firm may describe itself as practising" and "the
          firm may take money", which is the distinction the ruling exists for.
        */
        description={
          mode === "open"
            ? "launchMode() answers open. Every condition is met: the firm may hold itself out, quote, and take orders on any line whose protocol is approved."
            : mode === "trading"
              ? "launchMode() answers trading. The firm is registered, has an engineer of record, and may describe its services in the present tense, publish prices, and take enquiries. It takes no online order and no card, and no line is orderable until its protocol is approved."
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
                <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">{blocker}</p>
              )}

              <dl className="mt-2 flex flex-col gap-1 text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold">Who clears it</dt>
                  <dd>{condition.whoClears}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold">Stated true in</dt>
                  <dd className="text-[12.5px]">{condition.statedIn}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </Panel>

      {/*
        RULING 11, THE LAUNCH SCREEN'S DOOR. Which protocols are approved has
        one home since 2026-10-07, the engineer's signed record in the
        database, and this reads it exactly as every money door does, through
        lineIsSellable, so the operator sees the answer a customer would get.
        Read live on every visit: a voided signature shows here at once.
      */}
      <Panel
        title="Each offered line, as the order page sees it now"
        description="Read from the engineer's signed record in the database, the same way every page that takes money reads it. A line is sellable only when it is offered here and its protocol is signed with a hash that matches the text the platform runs."
      >
        <ul className="flex flex-col gap-3">
          {sellability.map(({ slug, sellable }) => (
            <li key={slug} className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {/*
                  Sellable only when the ORDER PAGE would sell it, which also needs the
                  gate open (orderBlockedNow refuses any line while launchMode is not
                  open). Product audit, 2026-10-10: this said "Sellable" for roof while
                  the gate was shut, because it asked the signature and not the gate.
                */}
                <Chip
                  label={sellable.ok && mode === "open" ? "Sellable" : sellable.ok ? "Signed, gate shut" : "Closed"}
                  tone={sellable.ok && mode === "open" ? "good" : "warn"}
                />
                <p className="text-[15px] font-semibold text-[var(--navy)]">{slug}</p>
              </div>
              {!sellable.ok ? (
                <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">{sellable.why}</p>
              ) : mode !== "open" ? (
                <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">
                  Its protocol is signed and it is offered, so it opens the moment the gate does. Until then the order
                  page refuses it, because launchMode() answers {mode}.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>

      {/*
        THE OWNER OVERRIDE, SHOWN SO IT IS NOT HIDDEN. Operator ruling,
        2026-10-19 (src/lib/owner-override.ts). Rendered from the declaration
        itself, so a third override cannot exist without appearing here.
      */}
      <Panel
        title="Owner overrides in force"
        description={`Two exemptions for the owner's own accounts, matched by user id and reachable by no other account, ruled ${OWNER_OVERRIDE.ruledOn}. Every use is recorded in the audit trail as ${OWNER_OVERRIDE_ACTION}, and an act whose record cannot be written is refused.`}
      >
        <ul className="flex flex-col gap-3">
          {OWNER_OVERRIDES.map((o) => (
            <li key={o.key} className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Chip label="Active" tone="warn" />
                <p className="text-[15px] font-semibold text-[var(--navy)]">{o.label}</p>
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--secondary)]">{o.holder}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="What this screen cannot tell you"
        description="A condition here is an assertion somebody wrote down. Nothing in this platform can see a filing cabinet, a Stripe dashboard or a provider setting, and a screen that implied otherwise would be worse than one that says so."
      >
        <p className="text-[13.5px] leading-[1.7] text-[var(--secondary)]">
          Each condition is true here when a person stated it true in the file named beside it.
          The compliance audit asserts that the gate reads every one of them and that none
          has been quietly dropped. It deliberately does not verify the outside world, because a
          check that cannot see a thing must not report on it.
        </p>
      </Panel>
    </>
  );
}
