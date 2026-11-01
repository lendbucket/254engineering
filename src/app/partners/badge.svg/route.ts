import { partnerBadgeText } from "@/lib/partner-copy";
import { partnerBadgeSvg } from "@/lib/partner-badge-svg";

/**
 * /partners/badge.svg, the text-only partner badge (Robert's answer 4 of
 * 2026-11-01, round 3 item c). Built at build time from partnerBadgeText(),
 * which reads the register and follows the gate.
 *
 * A static file cannot ask the signed record whether a line is open to order,
 * so it passes false, which partner-copy.ts names as the shut answer: the badge
 * never claims more than the money door would allow, and the open wording
 * arrives with the deploy that opens the gate.
 */
export const dynamic = "force-static";

export function GET() {
  const { svg } = partnerBadgeSvg(partnerBadgeText(false));
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
