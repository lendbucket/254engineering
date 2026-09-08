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

/*
 * THE TOKENS, AND WHERE EACH ONE CAME FROM.
 *
 * The approved email design was drawn against 254-brand-standards.md, and every
 * value below is that document's unless the comment says otherwise. Two of them
 * are corrections: BORDER and SECONDARY were near misses in this file before the
 * port, off by a shade from the named token, which is how a palette stops being
 * one.
 */
const NAVY = "#14315d";
const NAVY_DEEP = "#0e2347";
const INK = "#333a45";

/* Was #5f6877 here, which is not a token. The standards call this --secondary. */
const SECONDARY = "#555e6b";

/*
 * The muted tone ON a navy band, which the standards do not name.
 *
 * --muted (#8a93a0) is the light surface equivalent and fails against navy. The
 * design uses #a9b8ce for the right hand side of the status strip and for the
 * footer address, and it is recorded here as an ADDITION rather than folded in
 * silently: a colour that is in the emails and in no palette is how the next
 * surface ends up with a seventh grey.
 */
const MUTED_ON_NAVY = "#a9b8ce";

const GOLD = "#d9a032";
const GOLD_INK = "#8d610f";

/* The standards' alert trio. Unused before this port; see note(). */
const WARN_BG = "#fff9ec";
const WARN_BORDER = "#e8d9ae";
const WARN_INK = "#5c4a12";

const LIMESTONE = "#f4f5f7";

/* Was #dfe3ea here. The standards call this --border. */
const BORDER = "#dde0e4";

/* --row-rule. Lighter than BORDER, and the design uses it for every table rule. */
const ROW_RULE = "#edf1f7";

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

/**
 * A money row. The value is null when the figure is not on record.
 *
 * THE ABSENT DATA RULE REACHES EMAIL TOO.
 *
 * The standards forbid rendering a missing figure as 0 or $0.00, and an email is
 * the worst place to break that: the reader cannot hover a tooltip or open the
 * record, they just see a number and believe it. A null renders as "not
 * recorded" and the caller leaves it out of the total, because this layout
 * formats money rather than computing it and must not invent a sum.
 */
export type MoneyRow = { label: string; value: string | null };

export type EmailBlock =
  | { kind: "p"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "details"; title?: string; rows: [string, string][] }
  | { kind: "money"; rows: MoneyRow[]; total?: MoneyRow }
  /**
   * A plain list.
   *
   * Added beyond the approved design, which has none, because the data that
   * needed it is a list and the alternative was worse. The catalog's "what you
   * receive" entries are full sentences, and joining two of them with a comma
   * produced "A sealed engineering opinion on the condition of the roof..., The
   * photographic record...", which reads as a mistake. A list of sentences is a
   * list, and pretending otherwise in the copy is how a template ends up
   * fighting its own inputs.
   */
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "note"; text: string };

/**
 * The status strip: what this email is about, and what state it is in.
 *
 * The single best idea in the approved design. Every email answers "which record
 * is this" and "what happened to it" in one band before any prose, which is the
 * same question the portal's record header answers and the same order it answers
 * it in. It is optional because three of the alert templates are about the
 * machine rather than a record and have no reference to put in it.
 */
export type EmailStatus = { reference: string; state: string };

export type LayoutInput = {
  /** The inbox preview line, written rather than inherited from the logo alt. */
  preheader: string;
  status?: EmailStatus;
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

/**
 * A warning, as a full tinted box.
 *
 * THIS IS THE ONE PLACE THE PORT OVERRULES BOTH SOURCES, AND IT FOLLOWS THE
 * STANDARDS AGAINST BOTH.
 *
 * This file used to draw a note as a limestone panel with a 4px gold bar down
 * the left. The standards forbid exactly that ("No accent borders (top/left) on
 * cards") and define an alert as a full tinted box: --warn-bg, --warn-border,
 * --warn-ink. The approved design settles nothing here because it contains no
 * alert box at all; it carries urgency in the status strip instead, so there was
 * no drawn treatment to port.
 *
 * So the standards win by default rather than by argument, and the trio they
 * name is used for the first time. Gold survives as the border tone, which keeps
 * the rule that gold means warning or pending and nothing else.
 */
const note = (text: string) =>
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;"><tr>' +
  '<td style="background:' +
  WARN_BG +
  ";border:1px solid " +
  WARN_BORDER +
  ";border-radius:3px;padding:14px 16px;font-family:" +
  SANS +
  ";font-size:14.5px;line-height:1.6;" +
  WRAP +
  "color:" +
  WARN_INK +
  ';">' +
  esc(text) +
  "</td></tr></table>";

/**
 * A list, as a table rather than a ul.
 *
 * Outlook's Word engine gives a ul margins nobody asked for and Gmail's
 * clipping interacts badly with list markers, so the bullet is a cell and the
 * text is a cell, which is the same reason everything else here is a table.
 */
function list(title: string | undefined, items: string[]): string {
  const head = title
    ? '<p style="margin:0 0 8px;font-family:' +
      SANS +
      ";font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:" +
      SECONDARY +
      ';">' +
      esc(title) +
      "</p>"
    : "";
  const rows = items
    .map(
      (it) =>
        "<tr>" +
        '<td width="16" style="padding:3px 0 3px 0;font-family:' +
        SANS +
        ";font-size:14px;line-height:1.6;color:" +
        SECONDARY +
        ';vertical-align:top;">&bull;</td>' +
        '<td style="padding:3px 0;font-family:' +
        SANS +
        ";font-size:14px;line-height:1.6;" +
        WRAP +
        "color:" +
        INK +
        ';">' +
        esc(it) +
        "</td></tr>",
    )
    .join("");
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">' +
    (head ? '<tr><td colspan="2">' + head + "</td></tr>" : "") +
    rows +
    "</table>"
  );
}

/**
 * The status strip, in the two tone navy masthead.
 *
 * Deeper navy than the header above it so the two read as separate bands rather
 * than one tall block. The design puts both on #14315D against a white header,
 * which it can because its header is white; this one keeps the navy header for
 * the dark mode reason recorded at the top of this file, so the strip has to
 * separate itself some other way.
 */
function statusStrip(s: EmailStatus): string {
  const cell =
    "font-family:" +
    SANS +
    ";font-size:11.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;";
  return (
    '<tr><td style="background:' +
    NAVY_DEEP +
    ';padding:11px 28px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
    '<td style="' +
    cell +
    "color:#ffffff;" +
    WRAP +
    '">' +
    esc(s.reference) +
    "</td>" +
    '<td align="right" style="' +
    cell +
    "color:" +
    MUTED_ON_NAVY +
    ';">' +
    esc(s.state) +
    "</td>" +
    "</tr></table></td></tr>"
  );
}

/**
 * Money, with the total set apart.
 *
 * Right aligned figures on their own rule, then a heavier navy total with no
 * rule under it, which is the design's treatment and the portal's. A row whose
 * value is null says so in words; see MoneyRow.
 */
function money(rows: MoneyRow[], total?: MoneyRow): string {
  const line = "padding:7px 0;border-bottom:1px solid " + ROW_RULE + ";font-family:" + SANS + ";";
  const body = rows
    .map(
      (r) =>
        "<tr>" +
        '<td style="' +
        line +
        "font-size:13.5px;color:" +
        INK +
        ';">' +
        esc(r.label) +
        "</td>" +
        '<td align="right" style="' +
        line +
        "font-size:13.5px;" +
        (r.value === null ? "font-style:italic;color:" + SECONDARY : "color:" + INK) +
        ';">' +
        esc(r.value ?? "not recorded") +
        "</td></tr>",
    )
    .join("");
  const foot = total
    ? "<tr>" +
      '<td style="padding:9px 0;font-family:' +
      SANS +
      ";font-size:14px;font-weight:700;color:" +
      NAVY +
      ';">' +
      esc(total.label) +
      "</td>" +
      '<td align="right" style="padding:9px 0;font-family:' +
      SANS +
      ";font-size:15px;font-weight:700;" +
      (total.value === null ? "font-style:italic;color:" + SECONDARY : "color:" + NAVY) +
      ';">' +
      esc(total.value ?? "not recorded") +
      "</td></tr>"
    : "";
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">' +
    body +
    foot +
    "</table>"
  );
}

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
  /*
   * The label is an 11px uppercase kicker, which is the standards' column header
   * and the design's detail label, and it is the change that makes these tables
   * read as this firm's rather than as a generic two column list. The fixed 180px
   * label column is the design's; it keeps the values aligned down the email
   * instead of the column resizing per row.
   */
  const body = rows
    .map(
      ([k, v]) =>
        "<tr>" +
        '<td width="180" style="padding:7px 0;border-bottom:1px solid ' +
        ROW_RULE +
        ";font-family:" +
        SANS +
        ";font-size:11px;line-height:1.5;font-weight:700;letter-spacing:1px;text-transform:uppercase;" +
        WRAP +
        "color:" +
        SECONDARY +
        ';vertical-align:top;">' +
        esc(k) +
        "</td>" +
        '<td style="padding:7px 0;border-bottom:1px solid ' +
        ROW_RULE +
        ";font-family:" +
        SANS +
        ";font-size:13.5px;line-height:1.5;" +
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
 * the button should be.
 *
 * NAVY WITH WHITE TEXT, WHICH IS A CORRECTION.
 *
 * This button used to be navy text on gold. Three sources disagree with that and
 * none agreed with it: the standards say "Primary button: navy bg, white text,
 * 700 weight", the approved email design draws it navy, and the portal's own
 * primary control is navy with white text. A gold button in the email was the
 * only place in the whole system where the primary action was gold, and gold is
 * reserved for warning and pending, which is precisely what a primary action is
 * not.
 *
 * The old note claimed the gold pairing cleared AA, and it did. So does this
 * one, by a wider margin, and it no longer spends the warning colour on a
 * button.
 *
 * `display:block` with the padding on the anchor, so the whole rectangle is the
 * hit target rather than the text inside it.
 */
function button(b: EmailButton): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;"><tr>' +
    '<td align="center" bgcolor="' +
    NAVY +
    '" style="border-radius:3px;mso-line-height-rule:exactly;">' +
    '<a href="' +
    esc(b.url) +
    '" style="display:block;padding:14px 28px;font-family:' +
    DISPLAY +
    ';font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:3px;">' +
    esc(b.label) +
    "</a></td></tr></table>"
  );
}

function signature(): string {
  const [name, title, firm, url] = signatureLines();
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 0;border-top:1px solid ' +
    BORDER +
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
    SECONDARY +
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
      if (b.kind === "money") return money(b.rows, b.total);
      if (b.kind === "list") return list(b.title, b.items);
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
    // The record and its state, before any prose.
    input.status ? statusStrip(input.status) : "",
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

  /*
   * The strip is a line of text here, not a band. It leads for the same reason
   * it leads in the HTML: the reader should know which record this is before
   * they read a sentence about it.
   */
  if (input.status) out.push(input.status.reference + " | " + input.status.state, "");

  for (const b of input.blocks) {
    if (b.kind === "p" || b.kind === "note") out.push(b.text, "");
    else if (b.kind === "heading") out.push(b.text.toUpperCase(), "");
    else if (b.kind === "money") {
      for (const r of b.rows) out.push(r.label + ": " + (r.value ?? "not recorded"));
      if (b.total) out.push(b.total.label + ": " + (b.total.value ?? "not recorded"));
      out.push("");
    } else if (b.kind === "list") {
      if (b.title) out.push(b.title.toUpperCase());
      for (const it of b.items) out.push("- " + it);
      out.push("");
    } else {
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
