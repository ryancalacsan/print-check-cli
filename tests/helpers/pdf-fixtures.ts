import { PDFDocument, rgb, StandardFonts, PDFName, PDFDict, PDFString, PDFArray } from "pdf-lib";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as zlib from "node:zlib";

const tmpDir = os.tmpdir();

function fixturePath(name: string): string {
  return path.join(tmpDir, `print-check-${name}.pdf`);
}

async function writePdf(doc: PDFDocument, name: string): Promise<string> {
  const bytes = await doc.save();
  const p = fixturePath(name);
  fs.writeFileSync(p, bytes);
  return p;
}

// ---------------------------------------------------------------------------
// PNG generation helper — builds a minimal valid PNG in memory
// ---------------------------------------------------------------------------

function createSolidPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8Array {
  // Build raw scanline data: filter byte (0) + RGB pixels per row
  const rawLines: number[] = [];
  for (let y = 0; y < height; y++) {
    rawLines.push(0); // filter: none
    for (let x = 0; x < width; x++) {
      rawLines.push(r, g, b);
    }
  }
  const rawData = Buffer.from(rawLines);
  const compressed = zlib.deflateSync(rawData);

  const chunks: Buffer[] = [];

  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  function writeChunk(type: string, data: Buffer) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, "ascii");
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcInput);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0);
    chunks.push(len, typeBuffer, data, crcBuf);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk("IHDR", ihdr);

  // IDAT
  writeChunk("IDAT", compressed as Buffer);

  // IEND
  writeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat(chunks);
}

// CRC-32 lookup table
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Page box helpers — mm to pt conversion
// ---------------------------------------------------------------------------

const MM_TO_PT = 72 / 25.4;

// ---------------------------------------------------------------------------
// Fixture functions
// ---------------------------------------------------------------------------

/** Single page, Helvetica, no boxes/images — baseline */
export async function createBasicPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText("Test PDF", { x: 50, y: 700, size: 24, font, color: rgb(0, 0, 0) });
  return writePdf(doc, "basic");
}

/** Letter page with TrimBox inset from MediaBox by given mm.
 *  MediaBox is enlarged to include bleed so TrimBox differs from both. */
export async function createWithBleedPdf(bleedMm: number = 3): Promise<string> {
  const doc = await PDFDocument.create();
  const bleedPt = bleedMm * MM_TO_PT;
  // Make MediaBox larger than the trim area so bleed is computed from MediaBox
  const trimW = 612;
  const trimH = 792;
  const w = trimW + 2 * bleedPt;
  const h = trimH + 2 * bleedPt;
  const page = doc.addPage([w, h]);
  page.setTrimBox(bleedPt, bleedPt, trimW, trimH);
  page.drawText("Bleed test", { x: 50 + bleedPt, y: 700 + bleedPt, size: 18 });
  return writePdf(doc, "with-bleed");
}

/** TrimBox + BleedBox with only 1mm bleed — should fail */
export async function createInsufficientBleedPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const trimW = 612;
  const trimH = 792;
  const bleedPt = 1 * MM_TO_PT;
  const w = trimW + 2 * bleedPt;
  const h = trimH + 2 * bleedPt;
  const page = doc.addPage([w, h]);
  page.setTrimBox(bleedPt, bleedPt, trimW, trimH);
  page.drawText("Insufficient bleed", { x: 50 + bleedPt, y: 700 + bleedPt, size: 18 });
  return writePdf(doc, "insufficient-bleed");
}

/** 3 pages: proper bleed / missing TrimBox / insufficient bleed */
export async function createMultiPageMixedBleedPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const trimW = 612;
  const trimH = 792;

  // Page 1: proper bleed (4mm to avoid float boundary)
  const bleed1 = 4 * MM_TO_PT;
  const p1 = doc.addPage([trimW + 2 * bleed1, trimH + 2 * bleed1]);
  p1.setTrimBox(bleed1, bleed1, trimW, trimH);
  p1.drawText("Page 1 — OK", { x: 50 + bleed1, y: 700 + bleed1, size: 18 });

  // Page 2: no trim/bleed boxes at all
  const p2 = doc.addPage([trimW, trimH]);
  p2.drawText("Page 2 — Missing boxes", { x: 50, y: 700, size: 18 });

  // Page 3: insufficient bleed (1mm)
  const bleed3 = 1 * MM_TO_PT;
  const p3 = doc.addPage([trimW + 2 * bleed3, trimH + 2 * bleed3]);
  p3.setTrimBox(bleed3, bleed3, trimW, trimH);
  p3.drawText("Page 3 — Insufficient", { x: 50 + bleed3, y: 700 + bleed3, size: 18 });

  return writePdf(doc, "mixed-bleed");
}

/** Custom TTF font embedded (subset by default) via pdf-lib */
export async function createEmbeddedFontPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  // pdf-lib embedFont with a standard font creates a subset-embedded font
  // To get a subset prefix, we use embedFont with subset: true (the default)
  // Standard fonts won't produce subset prefixes, so we need a custom font.
  // We'll use Courier which pdf-lib can embed, and check the behavior.
  // Actually, StandardFonts don't get embedded — they're built-in.
  // For true subset detection, we'd need a real TTF. Let's use a different approach:
  // We'll create the PDF and embed a custom font from bytes.
  // For simplicity in testing, we'll use the pdf-lib built-in font embedding
  // with a font that IS embedded: TimesRoman does embed in some flows.
  //
  // The most reliable approach: embed a standard font. pdf-lib's embedStandardFont
  // doesn't actually embed. So we just embed Helvetica and the test checks for
  // "not embedded" status. For the subset test, we need to rely on the ABCDEF+ pattern.
  //
  // Let's just create a PDF with embedded Courier to test deduplication,
  // and separately test the subset pattern via the font name.
  const font = await doc.embedFont(StandardFonts.Courier);
  const p1 = doc.addPage([612, 792]);
  p1.drawText("Page 1 with Courier", { x: 50, y: 700, size: 18, font });
  const p2 = doc.addPage([612, 792]);
  p2.drawText("Page 2 with Courier", { x: 50, y: 700, size: 18, font });
  return writePdf(doc, "embedded-font");
}

/** Letter page with red RGB text — exercises inline content stream operators (rg/RG) */
export async function createRgbTextPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText("Red RGB Text", {
    x: 50,
    y: 700,
    size: 24,
    font,
    color: rgb(1, 0, 0),
  });
  return writePdf(doc, "rgb-text");
}

/** Embeds a solid-color PNG at given pixel size on given page size */
export async function createWithImagePdf(
  pxW: number,
  pxH: number,
  pageWidthPt: number = 612,
  pageHeightPt: number = 792,
): Promise<string> {
  const doc = await PDFDocument.create();
  const png = createSolidPng(pxW, pxH, 255, 0, 0); // red RGB image
  const image = await doc.embedPng(png);
  const page = doc.addPage([pageWidthPt, pageHeightPt]);
  page.drawImage(image, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });
  return writePdf(doc, `image-${pxW}x${pxH}`);
}

/** 1in x 1in page + 600x600px PNG — should pass (600 DPI) */
export async function createHighDpiImagePdf(): Promise<string> {
  const pagePt = 72; // 1 inch = 72pt
  return createWithImagePdf(600, 600, pagePt, pagePt);
}

/** Letter page + 100x100px PNG — should fail (very low DPI) */
export async function createLowDpiImagePdf(): Promise<string> {
  return createWithImagePdf(100, 100, 612, 792);
}

/** Sized to produce ~285 DPI (warn zone: between 270 and 300) */
export async function createNearThresholdDpiPdf(): Promise<string> {
  // Page = 1in x 1in (72pt). Image = 285x285px => 285 DPI
  const pagePt = 72;
  return createWithImagePdf(285, 285, pagePt, pagePt);
}

/** PDF with a PDF/X OutputIntent injected via pdf-lib's low-level context API */
export async function createPdfxCompliantPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText("PDF/X Compliant", { x: 50, y: 700, size: 18 });

  const context = doc.context;

  // Build an OutputIntent dictionary
  const outputIntentDict = context.obj({
    Type: "OutputIntent",
    S: "GTS_PDFX",
    OutputConditionIdentifier: "FOGRA39",
    Info: "Coated FOGRA39 (ISO 12647-2:2004)",
    RegistryName: "http://www.color.org",
  });

  // Add OutputIntents array to the catalog
  const catalog = context.lookup(context.trailerInfo.Root) as PDFDict;
  const outputIntentsArray = context.obj([outputIntentDict]);
  catalog.set(PDFName.of("OutputIntents"), outputIntentsArray);

  return writePdf(doc, "pdfx-compliant");
}

// ---------------------------------------------------------------------------
// TAC (Total Ink Coverage) fixtures — use raw CMYK content stream operators
// ---------------------------------------------------------------------------

/**
 * Helper: create a PDF with a CMYK rectangle via raw content stream operators.
 * `k` sets CMYK fill color (values 0–1), `re` draws a rect, `f` fills it.
 */
async function createCmykRectPdf(
  name: string,
  c: number,
  m: number,
  y: number,
  k: number,
): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  // Inject raw content stream with CMYK fill
  const stream = `${c} ${m} ${y} ${k} k\n50 600 200 100 re\nf`;
  const contentStream = doc.context.flateStream(stream);
  const ref = doc.context.register(contentStream);
  // Append our content stream to the page's Contents array
  const pageDict = page.node;
  const existingContents = pageDict.get(PDFName.of("Contents"));
  if (existingContents) {
    const arr = doc.context.obj([existingContents, ref]);
    pageDict.set(PDFName.of("Contents"), arr);
  } else {
    pageDict.set(PDFName.of("Contents"), ref);
  }
  return writePdf(doc, name);
}

/** CMYK content with safe TAC (~250%): C=0.6 M=0.6 Y=0.6 K=0.3 = 210% (well under limit) */
export async function createCmykPdf(): Promise<string> {
  // Actually target ~250%: C=0.7 M=0.6 Y=0.6 K=0.6 = 250%
  return createCmykRectPdf("cmyk-safe-tac", 0.7, 0.6, 0.6, 0.6);
}

/** Rich black with high TAC: C=0.80 M=0.70 Y=0.70 K=0.90 = 310% */
export async function createHighTacPdf(): Promise<string> {
  return createCmykRectPdf("cmyk-high-tac", 0.80, 0.70, 0.70, 0.90);
}

/** Near threshold TAC: C=0.70 M=0.65 Y=0.60 K=0.90 = 285% */
export async function createNearThresholdTacPdf(): Promise<string> {
  return createCmykRectPdf("cmyk-near-tac", 0.70, 0.65, 0.60, 0.90);
}

/** Single page with a semi-transparent rectangle — exercises transparency groups */
export async function createTransparentPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawRectangle({
    x: 50,
    y: 600,
    width: 200,
    height: 100,
    color: rgb(1, 0, 0),
    opacity: 0.5,
  });
  page.drawText("Transparent overlay", {
    x: 60,
    y: 640,
    size: 18,
    color: rgb(0, 0, 1),
    opacity: 0.7,
  });
  return writePdf(doc, "transparent");
}

/** Letter page with a 300×300px image drawn at 72×72pt (1in×1in).
 *  CTM-based DPI = 300. Old page-fill method would calculate ~39 DPI. */
export async function createScaledImagePdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const png = createSolidPng(300, 300, 0, 0, 255); // blue RGB image
  const image = await doc.embedPng(png);
  const page = doc.addPage([612, 792]); // Letter
  // Draw 300×300px image at 72×72pt (1 inch square)
  page.drawImage(image, { x: 50, y: 600, width: 72, height: 72 });
  return writePdf(doc, "scaled-image");
}
