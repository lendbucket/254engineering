import { business } from "@/config/business";
import { mailingAddressLine, signatureLines } from "@/config/email-identity";
import { registrationLine } from "./launch";

/**
 * The one email layout, used by every template this firm sends.
 *
 * WHY TABLES AND INLINE STYLES
 * ----------------------------
 * Not nostalgia. Outlook on Windows still renders through Word's HTML engine,
 * which has no flexbox, no grid, and unreliable float. Gmail strips style blocks
 * in several contexts, so a class based design arrives unstyled. A single column
 * table with inline styles is the shape that survives all of them, and it is why
 * this file looks nothing like the site's components.
 *
 * WHY THE PLAINTEXT PART SURVIVED THE REDESIGN
 * --------------------------------------------
 * These templates used to be plain text ONLY, and the reasoning recorded in
 * email-templates.ts was good: an operator reads a notification from a lock
 * screen preview, and image blocking hides half of an HTML email.
 *
 * That reasoning argued plain text OR html. Multipart gives both, so the preview
 * stays readable, a blocked image costs nothing, and the version a candidate
 * opens looks like it came from a firm. Every template still returns a text part
 * and the audit still requires one. The earlier decision is superseded rather
 * than deleted, because the concern behind it was correct.
 *
 * THE LOGO IS AN ABSOLUTE URL ON THE PRODUCTION DOMAIN
 * ----------------------------------------------------
 * Never a CID attachment, which lands as a mystery file in some clients, and
 * never a data URI, which Gmail strips outright. Served from the same host the
 * site is on, at 2x for retina, with the display size pinned in the attribute
 * AND the style because Outlook honours one and Gmail the other.
 *
 * DARK MODE
 * ---------
 * The header band is navy in both appearances, so the reverse logo is correct
 * whatever the client does. The body stays light with an explicit colour on
 * every text element: clients that force dark invert backgrounds but frequently
 * leave inline colours alone, and text with no declared colour is the thing that
 * turns black on black. Nothing here relies on an inherited colour.
 */

const NAVY = "#14315d";
const NAVY_DEEP = "#0e2347";
const INK = "#333a45";
const INK_QUIET = "#5f6877";
const GOLD = "#d9a032";
const GOLD_INK = "#8d610f";
const LIMESTONE = "#f4f5f7";
const LINE = "#dfe3ea";

const SANS =
  "'Open Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/*
 * Wrapping, and why it is declared rather than assumed.
 *
 * An email address, a signed document URL, and a referrer are single unbroken
 * tokens, and a table cell will happily grow past the viewport rather than break
 * one. At 375px that produced a message the reader has to drag sideways, in a
 * client where they cannot zoom out to escape it. Three of the four templates
 * did it, and only the confirmation, which has no detail table, did not.
 *
 * `anywhere` rather than `break-all`: it breaks a long token only when the line
 * cannot otherwise fit, so ordinary prose still wraps at spaces.
 */
const WRAP = "word-break:break-word;overflow-wrap:anywhere;";
const DISPLAY = "Archivo,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * The reverse mark, for the navy header band.
 *
 * logo-dark.png is white artwork with the gold parallelogram kept gold, which is
 * what a navy band needs. The light variant would be navy on navy and invisible,
 * which is the same defect the site's hero shipped once.
 */
const LOGO_URL = business.url + "/brand/logo-dark.png";
const LOGO_W = 168;
const LOGO_H = Math.round((LOGO_W * 1147) / 2262);

export type EmailButton = { label: string; url: string };

export type EmailBlock =
  | { kind: "p"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "details"; title?: string; rows: [string, string][] }
  | { kind: "note"; text: string };

export type LayoutInput = {
  /** The inbox preview line, written rather than inherited from the logo alt. */
  preheader: string;
  blocks: EmailBlock[];
  button?: EmailButton;
  /** Human facing mail is signed. Operator notifications are not. */
  signed?: boolean;
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const p = (text: string) =>
  '<p style="margin:0 0 16px;font-family:' +
  SANS +
  ";font-size:16px;line-height:1.65;" +
  WRAP +
  "color:" +
  INK +
  ';">' +
  esc(text) +
  "</p>";

const heading = (text: string) =>
  '<p style="margin:26px 0 10px;font-family:' +
  DISPLAY +
  ";font-size:18px;line-height:1.3;font-weight:700;color:" +
  NAVY +
  ';">' +
  esc(text) +
  "</p>";

const note = (text: string) =>
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;"><tr>' +
  '<td style="border-left:4px solid ' +
  GOLD +
  ";background:" +
  LIMESTONE +
  ";padding:14px 16px;font-family:" +
  SANS +
  ";font-size:14.5px;line-height:1.6;" +
  WRAP +
  "color:" +
  INK +
  ';">' +
  esc(text) +
  "</td></tr></table>";

function details(title: string | undefined, rows: [string, string][]): string {
  const head = title
    ? '<tr><td colspan="2" style="padding:0 0 8px;font-family:' +
      DISPLAY +
      ";font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:" +
      GOLD_INK +
      ';">' +
      esc(title) +
      "</td></tr>"
    : "";
  const body = rows
    .map(
      ([k, v]) =>
        "<tr>" +
        '<td style="padding:8px 12px 8px 0;border-bottom:1px solid ' +
        LINE +
        ";font-family:" +
        SANS +
        ";font-size:14px;line-height:1.5;" +
        WRAP +
        "color:" +
        INK_QUIET +
        ';vertical-align:top;">' +
        esc(k) +
        "</td>" +
        '<td style="padding:8px 0;border-bottom:1px solid ' +
        LINE +
        ";font-family:" +
        SANS +
        ";font-size:14px;line-height:1.5;" +
        WRAP +
        "color:" +
        INK +
        ';vertical-align:top;">' +
        esc(v) +
        "</td></tr>",
    )
    .join("");
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">' +
    head +
    body +
    "</table>"
  );
}

/**
 * The call to action.
 *
 * A table with a background colour rather than a styled anchor, because Outlook
 * ignores padding on an inline element and would render a bare blue link where
 * the button should be. Navy text on gold is the site's primary control and the
 * pairing clears AA.
 */
function button(b: EmailButton): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;"><tr>' +
    '<td align="center" bgcolor="' +
    GOLD +
    '" style="border-radius:3px;">' +
    '<a href="' +
    esc(b.url) +
    '" style="display:inline-block;padding:14px 28px;font-family:' +
    DISPLAY +
    ';font-size:16px;font-weight:700;color:#14213a;text-decoration:none;border-radius:3px;">' +
    esc(b.label) +
    "</a></td></tr></table>"
  );
}

function signature(): string {
  const [name, title, firm, url] = signatureLines();
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 0;border-top:1px solid ' +
    LINE +
    ';"><tr><td style="padding:18px 0 0;">' +
    '<p style="margin:0;font-family:' +
    DISPLAY +
    ";font-size:15px;font-weight:700;color:" +
    NAVY +
    ';">' +
    esc(name) +
    "</p>" +
    '<p style="margin:2px 0 0;font-family:' +
    SANS +
    ";font-size:14px;color:" +
    INK_QUIET +
    ';">' +
    esc(title) +
    ", " +
    esc(firm) +
    "</p>" +
    '<p style="margin:2px 0 0;font-family:' +
    SANS +
    ';font-size:14px;"><a href="' +
    esc(url) +
    '" style="color:' +
    GOLD_INK +
    ';text-decoration:underline;">' +
    esc(url) +
    "</a></p>" +
    "</td></tr></table>"
  );
}

function footer(): string {
  const address = mailingAddressLine();
  const rows = [
    '<p style="margin:0 0 6px;font-family:' +
      DISPLAY +
      ';font-size:13px;font-weight:700;color:#ffffff;">' +
      esc(business.legalName) +
      "</p>",
    '<p style="margin:0 0 6px;font-family:' +
      SANS +
      ';font-size:13px;line-height:1.6;color:#c3ccda;">' +
      '<a href="mailto:' +
      esc(business.email) +
      '" style="color:#e8b04a;text-decoration:underline;">' +
      esc(business.email) +
      "</a>" +
      " &nbsp;|&nbsp; " +
      '<a href="' +
      esc(business.url) +
      '" style="color:#e8b04a;text-decoration:underline;">' +
      esc(business.domain) +
      "</a></p>",
    // Gate aware, exactly like the site footer. One environment variable moves
    // both surfaces, and the audit checks this half in both modes.
    '<p style="margin:0 0 6px;font-family:' +
      SANS +
      ';font-size:12px;line-height:1.6;color:#9fadc4;">' +
      esc(registrationLine()) +
      "</p>",
  ];
  if (address) {
    rows.push(
      '<p style="margin:0;font-family:' +
        SANS +
        ';font-size:12px;line-height:1.6;color:#9fadc4;">' +
        esc(address) +
        "</p>",
    );
  }
  return (
    '<tr><td style="background:' +
    NAVY_DEEP +
    ";padding:22px 28px;border-top:3px solid " +
    GOLD +
    ';">' +
    rows.join("") +
    "</td></tr>"
  );
}

/** The rendered HTML for a template. */
export function renderEmailHtml(input: LayoutInput): string {
  const blocks = input.blocks
    .map((b) => {
      if (b.kind === "p") return p(b.text);
      if (b.kind === "heading") return heading(b.text);
      if (b.kind === "note") return note(b.text);
      return details(b.title, b.rows);
    })
    .join("");

  return [
    "<!doctype html>",
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    // Tells a client that supports it that this design is authored for both
    // appearances, which stops the more aggressive automatic inversions.
    '<meta name="color-scheme" content="light dark">',
    '<meta name="supported-color-schemes" content="light dark">',
    "<title>" + esc(input.preheader) + "</title>",
    "</head>",
    '<body style="margin:0;padding:0;background:' + LIMESTONE + ';">',
    // The preview line. Hidden in the body, shown in the inbox list, so the
    // preview is a sentence rather than the first words of the logo alt text.
    '<div style="display:none;font-size:1px;color:' +
      LIMESTONE +
      ';line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">' +
      esc(input.preheader) +
      "</div>",
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:' +
      LIMESTONE +
      ';">',
    '<tr><td align="center" style="padding:24px 12px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:4px;overflow:hidden;">',
    // Header band.
    '<tr><td style="background:' + NAVY + ';padding:22px 28px;">',
    '<img src="' +
      LOGO_URL +
      '" width="' +
      LOGO_W +
      '" height="' +
      LOGO_H +
      '" alt="' +
      esc(business.name) +
      '" style="display:block;width:' +
      LOGO_W +
      "px;height:" +
      LOGO_H +
      'px;border:0;outline:none;text-decoration:none;">',
    "</td></tr>",
    // Body.
    '<tr><td style="padding:28px;">',
    blocks,
    input.button ? button(input.button) : "",
    input.signed ? signature() : "",
    "</td></tr>",
    footer(),
    "</table>",
    "</td></tr></table>",
    "</body></html>",
  ].join("");
}

/**
 * The plaintext part, generated from the same blocks the HTML is built from.
 *
 * Same source, so the two cannot describe different things. That is the failure
 * this replaces: a hand written text part that keeps saying what the email used
 * to say.
 */
export function renderEmailText(input: LayoutInput): string {
  const out: string[] = [];
  for (const b of input.blocks) {
    if (b.kind === "p" || b.kind === "note") out.push(b.text, "");
    else if (b.kind === "heading") out.push(b.text.toUpperCase(), "");
    else {
      if (b.title) out.push(b.title.toUpperCase());
      for (const [k, v] of b.rows) out.push(k + ": " + v);
      out.push("");
    }
  }
  if (input.button) out.push(input.button.label + ": " + input.button.url, "");
  if (input.signed) out.push(...signatureLines(), "");
  out.push(business.legalName, business.email, business.url, registrationLine());
  const address = mailingAddressLine();
  if (address) out.push(address);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
