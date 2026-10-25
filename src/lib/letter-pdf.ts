import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DraftLine } from "./letter-draft";

/**
 * ===========================================================================
 * THE SEALED LETTER AS A PDF. Rendered once, at sealing, and never again.
 * ===========================================================================
 *
 * docs/sealing-controls.md, control 5 and 6. This takes the drafted lines, the
 * letterhead, the seal block facts, and the two images, and returns bytes. It
 * reads no database and no storage: the sealing step (src/lib/letter-seal.ts)
 * is the one place the images are read, and it hands them in.
 *
 * WHAT 22 TAC 137.33 ASKS OF THE PAGE, as mapped in docs/sealing-controls.md:
 *   (f)(3)  the engineer's printed name, the date, his signature, and "P.E."
 *   (f)     the signature and date do not obscure his name or licence number
 *           in the seal, so the seal image sits in its own box to the right of
 *           the text column and nothing is drawn over it
 *   (n)     the firm's name and registration number, which is the letterhead's
 *           second line, handed in from registrationLine()
 *
 * Text is drawn with the PDF standard fonts, whose encoding is WinAnsi. A
 * character outside it would make pdf-lib throw, so `renderLetterPdf` returns a
 * sentence naming the line rather than a stack trace.
 */

export type SealBlock = {
  /** The engineer's name as the register records it. */
  name: string;
  licenseNumber: string;
  /** "Engineer of Record, " plus the registrant's name, from firmName(). */
  role: string;
  /** The date of sealing, as the letter prints it. */
  date: string;
};

export type LetterPdfInput = {
  brand: string;
  registrationLine: string;
  lines: DraftLine[];
  sealBlock: SealBlock;
  sealPng: Uint8Array;
  signaturePng: Uint8Array;
  /** The letterhead mark, embedded rather than fetched (src/content/letters/letterhead-mark.ts). */
  logoPng: Uint8Array;
  /** The document's own title, written into the PDF's metadata. */
  title: string;
  /**
   * The schedule or record a letter's sentence calls "attached", printed as a
   * page of the same sealed PDF so the word is true. Robert's answer on F14
   * and L2f, 2026-10-25. Every line comes from what the engineer recorded.
   */
  attachment?: { heading: string; lines: string[] };
};

export type LetterPdfResult = { ok: true; bytes: Uint8Array } | { ok: false; why: string };

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const BODY_SIZE = 10.5;
const LEADING = 14.5;
const SEAL_BOX = 108;
const INK = rgb(0.1, 0.12, 0.16);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

export async function renderLetterPdf(input: LetterPdfInput): Promise<LetterPdfResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setProducer("254 Engineering portal");
  doc.setCreator("254 Engineering portal");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let seal;
  let signature;
  let mark;
  try {
    seal = await doc.embedPng(input.sealPng);
    signature = await doc.embedPng(input.signaturePng);
  } catch {
    return { ok: false, why: "The stored seal or signature image could not be read as a PNG." };
  }
  try {
    mark = await doc.embedPng(input.logoPng);
  } catch {
    return { ok: false, why: "The letterhead mark could not be read as a PNG." };
  }

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const textWidth = PAGE_W - MARGIN * 2;

  const draw = (text: string, font: PDFFont, size: number, x = MARGIN, width = textWidth) => {
    for (const piece of wrap(text, font, size, width)) {
      if (y < MARGIN + LEADING) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      page.drawText(piece, { x, y, size, font, color: INK });
      y -= size + 4;
    }
  };

  try {
    /*
     * Letterhead: the mark, then the brand on its own line above the registrant.
     * Operator rulings: the brand line of 2026-09-11, and of 2026-10-22 the mark
     * at the top, EMBEDDED from the bytes handed in rather than loaded from a
     * URL, so the sealed page is the same every time it is opened. The brand
     * prints as given, "254 Engineering", not upper-cased into a different
     * string from the one the ruling names.
     */
    const markHeight = 36;
    const markWidth = (mark.width / mark.height) * markHeight;
    page.drawImage(mark, { x: MARGIN, y: y - markHeight, width: markWidth, height: markHeight });
    y -= markHeight + 14;
    draw(input.brand, bold, 13);
    draw(input.registrationLine, regular, 9.5);
    y -= LEADING;

    for (const line of input.lines) {
      if (line.kind === "heading") {
        y -= 4;
        draw(line.text, bold, BODY_SIZE);
        continue;
      }
      draw(line.text, line.kind === "re" ? bold : regular, BODY_SIZE);
      y -= line.kind === "body" || line.kind === "determination" ? 6 : 2;
    }

    /*
     * THE SEAL BLOCK. It needs the signature, four lines of text and the seal
     * box; a page without room for all of it starts a new page, so the seal
     * never lands apart from the name it belongs to.
     */
    const blockHeight = SEAL_BOX + LEADING;
    if (y - blockHeight < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    y -= LEADING;
    const top = y;
    const columnWidth = textWidth - SEAL_BOX - 24;

    const sigScale = Math.min(180 / signature.width, 44 / signature.height);
    page.drawImage(signature, {
      x: MARGIN,
      y: top - signature.height * sigScale,
      width: signature.width * sigScale,
      height: signature.height * sigScale,
    });
    y = top - 48;
    page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: MARGIN + 200, y: y + 2 }, thickness: 0.6, color: INK });
    y -= 10;
    draw(`${input.sealBlock.name}, P.E.`, bold, BODY_SIZE, MARGIN, columnWidth);
    draw(`Texas P.E. No. ${input.sealBlock.licenseNumber}`, regular, BODY_SIZE, MARGIN, columnWidth);
    draw(input.sealBlock.role, regular, BODY_SIZE, MARGIN, columnWidth);
    draw(`Date: ${input.sealBlock.date}`, regular, BODY_SIZE, MARGIN, columnWidth);

    /* The seal, in its own box to the right; nothing is drawn over it. */
    const sealScale = Math.min(SEAL_BOX / seal.width, SEAL_BOX / seal.height);
    page.drawImage(seal, {
      x: PAGE_W - MARGIN - seal.width * sealScale,
      y: top - seal.height * sealScale,
      width: seal.width * sealScale,
      height: seal.height * sealScale,
    });

    /*
     * THE ATTACHED PAGE (F14, L2f). Its own page, after the seal block, inside
     * the one PDF whose bytes the seal act hashes, so the schedule or record the
     * letter calls attached is sealed with it. The letterhead's two text lines
     * head it so a page read alone still says whose it is.
     */
    if (input.attachment) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      draw(input.brand, bold, 13);
      draw(input.registrationLine, regular, 9.5);
      y -= LEADING;
      draw(input.attachment.heading, bold, BODY_SIZE);
      y -= 6;
      for (const text of input.attachment.lines) {
        draw(text, regular, BODY_SIZE);
        y -= 4;
      }
    }
  } catch (err) {
    const message = String((err as Error).message ?? err);
    return {
      ok: false,
      why: /WinAnsi|cannot encode/i.test(message)
        ? `A character in the letter cannot be printed in the PDF's font: ${message.slice(0, 120)}`
        : `The letter could not be rendered: ${message.slice(0, 160)}`,
    };
  }

  return { ok: true, bytes: await doc.save({ useObjectStreams: false }) };
}
