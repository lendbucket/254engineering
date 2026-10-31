/**
 * Absolute SVG path data, as d3-geo's geoPath writes it after one decimal of
 * rounding, rewritten with relative commands. LOSSLESS AT THAT PRECISION.
 *
 * WHY, 2026-10-30
 * ---------------
 * Board 41118588757 measured /coverage/coastal-bend at LCP 3402ms against the
 * 3400ms ceiling, every sample over. The county map is most of that page's
 * HTML, carried once as markup and once again in the React payload, and Robert
 * ruled at 09:26 that it stays server rendered. So the geometry is made smaller
 * without changing a single point: every coordinate is first read as an exact
 * count of tenths, and each step is the difference of two such counts, which
 * is exact. The shape is the same polygon; only its spelling changes.
 *
 * The input is restricted to what geoPath emits for these polygons: M, L and Z
 * with "x,y" pairs. Anything else is refused rather than guessed at, because a
 * command this encoder does not understand would be silently mistranslated.
 */

const TOKEN = /[MLZ]|-?\d*\.?\d+(?:e-?\d+)?/g;

/** A coordinate as a whole number of tenths, exactly. */
function tenths(text) {
  const value = Number(text);
  const scaled = Math.round(value * 10);
  if (Math.abs(scaled / 10 - value) > 1e-9) {
    throw new Error(`relative-path: ${text} has more than one decimal place`);
  }
  return scaled;
}

/** A count of tenths written as the shortest decimal: 5 -> ".5", -15 -> "-1.5". */
function written(count) {
  return (count / 10).toString().replace(/^(-?)0\./, "$1.");
}

/** "a,b" or "a-b": the comma is needed only when b does not start with a minus. */
function pairOf(dx, dy) {
  const a = written(dx);
  const b = written(dy);
  return a + (b.startsWith("-") ? "" : ",") + b;
}

export function toRelativePath(d) {
  if (!d) return d;
  const unknown = d.replace(TOKEN, "").replace(/[\s,]/g, "");
  if (unknown) throw new Error(`relative-path: unsupported path content "${unknown.slice(0, 20)}"`);
  const tokens = d.match(TOKEN) ?? [];
  let out = "";
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let previous = "";
  let first = true;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "Z") {
      out += "z";
      cx = startX;
      cy = startY;
      previous = "z";
      continue;
    }
    if (command !== "M" && command !== "L") {
      throw new Error(`relative-path: expected a command, found "${command}"`);
    }
    const x = tenths(tokens[i++]);
    const y = tenths(tokens[i++]);
    if (command === "M") {
      out += first ? `M${pairOf(x, y)}` : `m${pairOf(x - cx, y - cy)}`;
      // After an ABSOLUTE M, further pairs are absolute linetos, so the first
      // relative lineto must say "l". After a relative m they are relative.
      previous = first ? "M" : "m";
      first = false;
      startX = x;
      startY = y;
    } else {
      const pair = pairOf(x - cx, y - cy);
      // After m or l a further pair continues the same lineto. It needs a
      // space unless it begins with a minus, which already separates it.
      out += previous === "m" || previous === "l" ? (pair.startsWith("-") ? "" : " ") + pair : `l${pair}`;
      previous = "l";
    }
    cx = x;
    cy = y;
  }
  return out;
}

/**
 * Walks a path written by toRelativePath (or any M/m, L/l, Z/z path with
 * implicit linetos) back to the absolute points it visits, in tenths. Used
 * by the proof to show the two spellings visit exactly the same points.
 */
export function pointsOf(d) {
  const tokens = d.match(/[MmLlZz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const points = [];
  let i = 0;
  let mode = "";
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[MmLlZz]$/.test(token)) {
      i++;
      if (token === "Z" || token === "z") {
        points.push("Z");
        cx = startX;
        cy = startY;
        continue;
      }
      mode = token;
    }
    const x = tenths(tokens[i++]);
    const y = tenths(tokens[i++]);
    const relative = mode === "m" || mode === "l";
    cx = relative ? cx + x : x;
    cy = relative ? cy + y : y;
    if (mode === "M" || mode === "m") {
      startX = cx;
      startY = cy;
      points.push(`M${cx},${cy}`);
      mode = mode === "m" ? "l" : "L";
    } else {
      points.push(`${cx},${cy}`);
    }
  }
  return points.join(" ");
}
