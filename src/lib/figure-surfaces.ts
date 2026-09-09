import "server-only";
import { REPORTS, formatFigure, periodOf, type FigureRow } from "./ops-reports";
import { dashboardFor, type Dashboard } from "./ops-dashboard";
import { DEFAULT_ROLES, type Actor } from "./ops-authz";
import { money } from "./ops-money";

/**
 * EVERY SURFACE THAT RENDERS A FIGURE, IN ONE DECLARATION.
 *
 * Operator ruling, 2026-09-09: "every surface that renders a figure joins the
 * report registry, dashboards included, so the demo injection runs over every
 * figure on every surface and not over the four reports. A dashboard is a
 * report with fewer figures."
 *
 * WHY THE RULING WAS NEEDED
 * -------------------------
 * Section 2's law is that a figure never counts a demonstration record. Every
 * check written for it derived from REPORTS, so the four reports were proved
 * and nothing else was looked at. The sales dashboard then shipped a tile
 * reading "Accounts on the books: 1" on a database whose only account belongs
 * to a seeded client. The rule was right, the enforcement was pointed at a
 * quarter of the surfaces that obey it, and the gap was found by looking at a
 * screenshot.
 *
 * WHERE THE IDIOM HOLDS AND WHERE IT DOES NOT, WHICH THE RULING ASKED FOR
 * -----------------------------------------------------------------------
 * It holds for the thing that matters. A figure is a LABEL and a RENDERED
 * VALUE, and "did this move when a demonstration was inserted" is answerable
 * over both kinds of surface without either knowing about the other. That is
 * what this module normalises and what demo-audit now sweeps.
 *
 * It does NOT hold for expansion, and the reason is not stylistic. A report
 * figure carries the rows it was summed over, which is what makes the total
 * checkable and what lets demo-audit search the evidence rather than infer from
 * the total. A dashboard TILE cannot: its count comes from a
 * `count: "exact", head: true` query that deliberately fetches no rows, because
 * a dashboard runs a dozen of them on every page load for a person who is
 * looking at four numbers. Giving every tile its rows would turn each of those
 * into a full table read to render an integer nobody asked to expand.
 *
 * So `expandable` is declared per surface rather than assumed, and it is the
 * honest shape of the difference: a dashboard is a report with fewer figures
 * AND with figures that do not carry their evidence. Both halves of that are
 * true and only the first half was in the ruling, so the second is written
 * down here rather than quietly implemented.
 *
 * The consequence for the checks, stated so nobody has to work it out: on a
 * report, demo-audit can prove a demonstration is absent by reading the rows.
 * On a dashboard it can only prove the figure did not MOVE when one was
 * inserted. The first is stronger. The second is what is available, it is the
 * check that would have caught the accounts tile, and it is applied to every
 * figure on every surface.
 */

/** One figure, from whatever surface produced it, in a shape both can answer. */
export type SurfaceFigure = {
  /** Which surface, as "report:revenue" or "dashboard:dispatcher". */
  surface: string;
  /** The grouping within it, so two figures with the same label stay distinct. */
  section: string;
  label: string;
  /** Exactly what a reader sees, including "not computed" and "not known". */
  rendered: string;
  /**
   * The records behind it, where the surface guarantees them. Null on a
   * dashboard because a tile does not fetch its rows, and null on a report only
   * when the query failed. `expandable` is what tells those two apart.
   */
  rows: FigureRow[] | null;
};

export type FigureSurface = {
  key: string;
  title: string;
  kind: "report" | "dashboard";
  /**
   * Whether every figure on it carries the rows it was computed from.
   *
   * True for reports, and reporting-audit adds the rows up and requires them to
   * equal the figure. False for dashboards, for the reason in the header.
   */
  expandable: boolean;
  figures: (ctx: { period: string }) => Promise<SurfaceFigure[]>;
};

/** A well formed uuid belonging to nobody, so a scoped count truthfully reads zero. */
const NOBODY = "00000000-0000-4000-8000-000000000000";

function actorFor(roleKey: string): Actor {
  const role = DEFAULT_ROLES.find((r) => r.key === roleKey);
  return {
    id: NOBODY,
    role: roleKey,
    status: "active",
    grants: new Set(role?.grants ?? []),
  } as unknown as Actor;
}

/** How a dashboard renders a count, matching CountTiles exactly. */
const renderCount = (n: number | null): string => (n === null ? "not known" : String(n));

function dashboardFigures(key: string, dashboard: Dashboard | null): SurfaceFigure[] {
  if (!dashboard) return [];
  const surface = `dashboard:${key}`;
  const out: SurfaceFigure[] = [];

  for (const tile of dashboard.tiles) {
    out.push({ surface, section: "tiles", label: tile.label, rendered: renderCount(tile.count), rows: null });
  }

  /* Money tiles exist on three of the six. The other three cannot hold one. */
  if ("money" in dashboard) {
    for (const tile of dashboard.money) {
      out.push({ surface, section: "money", label: tile.label, rendered: money(tile.value), rows: null });
    }
  }

  /*
   * A breakdown's rows are GROUPS rather than records, so they are figures in
   * their own right rather than an expansion of the one above them. Each is
   * swept individually, which is what caught nothing yet and is exactly the
   * shape that would catch a county bucket counting a seeded file.
   */
  if ("breakdowns" in dashboard) {
    for (const breakdown of dashboard.breakdowns) {
      for (const row of breakdown.rows ?? []) {
        out.push({
          surface,
          section: breakdown.title,
          label: row.label,
          rendered: renderCount(row.count),
          rows: null,
        });
      }
    }
  }

  return out;
}

/**
 * THE REGISTRY. Four reports and six dashboards.
 *
 * Derived from REPORTS and DEFAULT_ROLES rather than listed, for the reason the
 * surfaces inventory gives: a list maintained by hand stops describing the
 * system the first time somebody forgets, and the forgetting is silent. A fifth
 * report or an eighth role joins this sweep without anybody remembering.
 */
export const FIGURE_SURFACES: FigureSurface[] = [
  ...REPORTS.map((r) => ({
    key: `report:${r.key}`,
    title: r.title,
    kind: "report" as const,
    expandable: true,
    figures: async (ctx: { period: string }) => {
      const built = await r.build(ctx.period);
      return built.sections.flatMap((s) =>
        s.figures.map((f) => ({
          surface: `report:${r.key}`,
          section: s.title,
          label: f.label,
          rendered: formatFigure(f),
          rows: f.rows,
        })),
      );
    },
  })),
  ...DEFAULT_ROLES.map((role) => ({
    key: `dashboard:${role.key}`,
    title: `${role.name} dashboard`,
    kind: "dashboard" as const,
    expandable: false,
    figures: async () => dashboardFigures(role.key, await dashboardFor(actorFor(role.key))),
  })),
];

/** Every figure on every surface, as comparable text. */
export async function allFigures(period = periodOf()): Promise<SurfaceFigure[]> {
  const built = await Promise.all(FIGURE_SURFACES.map((s) => s.figures({ period })));
  return built.flat();
}
