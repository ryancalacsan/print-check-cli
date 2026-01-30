import * as fs from "node:fs";
import * as mupdf from "mupdf";
import { PDFDocument } from "pdf-lib";

export interface PdfEngines {
  mupdf: mupdf.PDFDocument;
  pdfLib: PDFDocument;
}

export async function loadPdf(filePath: string): Promise<PdfEngines> {
  const buffer = fs.readFileSync(filePath);

  const mupdfDoc = mupdf.PDFDocument.openDocument(
    buffer,
    "application/pdf",
  ) as mupdf.PDFDocument;

  const pdfLibDoc = await PDFDocument.load(buffer, {
    ignoreEncryption: true,
  });

  return { mupdf: mupdfDoc, pdfLib: pdfLibDoc };
}
