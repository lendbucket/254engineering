/**
 * WHETHER A COUNTY IS ONE OUR TECHNICIANS COVER, pure over the rows. Robert's
 * add-on of 2026-11-16 and his answer 12 (6931421644). The rows are active
 * field technicians' coverage_counties (countyIsCovered in tech-coverage.ts
 * reads them); a county counts named with or without "County", in any case.
 * Kept apart from the database so a proof drives it.
 */
export function countyInCoverage(county: string, rows: { coverage_counties: string[] | null }[]): boolean {
  const want = county.trim().toLowerCase().replace(/\s+county$/, "");
  if (!want) return false;
  return rows.some((r) => (r.coverage_counties ?? []).some((c) => c.trim().toLowerCase().replace(/\s+county$/, "") === want));
}
