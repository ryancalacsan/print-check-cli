import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fs from "node:fs";

async function createTestPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.addPage([612, 792]); // US Letter

  page.drawText("Print Check CLI — Test PDF", {
    x: 50,
    y: 700,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText("This is a test page with embedded Helvetica font.", {
    x: 50,
    y: 650,
    size: 14,
    font,
    color: rgb(0.2, 0.2, 0.8), // RGB blue
  });

  const bytes = await doc.save();
  fs.writeFileSync("test-sample.pdf", bytes);
  console.log("Created test-sample.pdf");
}

createTestPdf();
