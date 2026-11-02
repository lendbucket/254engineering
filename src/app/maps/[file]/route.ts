import { countyMapFiles, countyMapSvg } from "@/components/map/county-map-file";

/**
 * /maps/texas-counties.svg and /maps/texas-counties-<region>.svg, the county
 * map the two coverage routes load as an image. Robert, 2026-11-01, round 3
 * item a. Built once per file at build time from the same geometry the inline
 * map uses; see src/components/map/county-map-file.ts for why it is a file.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [...countyMapFiles().keys()].map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const files = countyMapFiles();
  if (!files.has(file)) return new Response("Not found", { status: 404 });
  return new Response(countyMapSvg(files.get(file)), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
