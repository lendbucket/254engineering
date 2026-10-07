/**
 * The fourteen first tier coastal counties, with NO IMPORTS, so the order
 * catalogue can ask which county a windstorm property is in without pulling the
 * region content into the order flow's bundle.
 *
 * THIS IS STILL THE ONE LIST. It moved here from `windstorm.ts` on 2026-10-07
 * (ruling 6, docs/conflicts-v1.1.md item 6), and `windstorm.ts` re-exports it and
 * still runs its assertion that every name appears in the region prose it was
 * indexed from. Nothing else may type these names again.
 */
export const FIRST_TIER_COASTAL = [
  "Aransas",
  "Brazoria",
  "Calhoun",
  "Cameron",
  "Chambers",
  "Galveston",
  "Jefferson",
  "Kenedy",
  "Kleberg",
  "Matagorda",
  "Nueces",
  "Refugio",
  "San Patricio",
  "Willacy",
] as const;
