/**
 * THE PARTNER BADGE AS A TEXT-ONLY SVG. Robert's answer 4 of 2026-11-01, on
 * round 3 item c: "approved as you recommend: text-only SVG, gate-aware
 * wording, carrying '254 Engineering LLC, Firm F-29811'."
 *
 * TEXT ONLY, so it stays inside answer 19 of 2026-10-26 and the 2026-10-15 rule
 * that a partner never operates under a 254 mark: no numerals, no logo, no
 * artwork, only the sentence partnerBadgeText() returns, set in a box. The
 * wording is never typed here; the caller passes what partnerBadgeText() says,
 * which reads the register and follows the gate, so the firm's name and number
 * are the register's and the badge changes by itself the day the gate opens.
 */

const WIDTH = 320;
const PAD = 14;
const LINE = 17;
const FONT = 12.5;
/** Characters per line at this width and size, set conservatively so no line overruns the box. */
const PER_LINE = 46;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Word wrap with no word broken; a word longer than a line takes a line of its own. */
export function wrapBadgeText(text: string, perLine = PER_LINE): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > perLine) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The SVG document: a bordered box with the badge sentence in it, and nothing else. */
export function partnerBadgeSvg(text: string): { svg: string; width: number; height: number } {
  const lines = wrapBadgeText(text);
  const height = PAD * 2 + LINE * lines.length;
  const tspans = lines
    .map((l, i) => `<tspan x="${PAD}" y="${PAD + FONT + i * LINE}">${escape(l)}</tspan>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${escape(text)}">` +
    `<title>${escape(text)}</title>` +
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="3" fill="#ffffff" stroke="#14315d"/>` +
    `<text font-family="Arial, Helvetica, sans-serif" font-size="${FONT}" fill="#14315d">${tspans}</text>` +
    `</svg>`;
  return { svg, width: WIDTH, height };
}
