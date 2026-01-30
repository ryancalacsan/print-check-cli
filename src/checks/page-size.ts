import type { CheckFn, CheckResult, CheckDetail } from "../types.js";

const PT_TO_MM = 25.4 / 72;
const TOLERANCE_MM = 0.5;

function dimToMm(pt: number): number {
  return pt * PT_TO_MM;
}

function fmtMm(mm: number): string {
  return mm.toFixed(0);
}

function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE_MM;
}

export const checkPageSize: CheckFn = async (engines, options) => {
  const { pdfLib } = engines;
  const pages = pdfLib.getPages();
  const details: CheckDetail[] = [];
  let worstStatus: CheckResult["status"] = "pass";

  const pageDims: { wMm: number; hMm: number }[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const mediaBox = page.getMediaBox();
    const trimBox = page.getTrimBox();

    // Use TrimBox if it differs from MediaBox, otherwise MediaBox
    const hasTrimBox =
      trimBox.x !== mediaBox.x ||
      trimBox.y !== mediaBox.y ||
      trimBox.width !== mediaBox.width ||
      trimBox.height !== mediaBox.height;

    const box = hasTrimBox ? trimBox : mediaBox;
    const wMm = dimToMm(box.width);
    const hMm = dimToMm(box.height);
    pageDims.push({ wMm, hMm });
  }

  // Check against expected page size if specified
  let expectedW: number | undefined;
  let expectedH: number | undefined;

  if (options.pageSize) {
    const parts = options.pageSize.split("x");
    if (parts.length === 2) {
      expectedW = parseFloat(parts[0]);
      expectedH = parseFloat(parts[1]);
    }
  }

  // Build per-page details
  for (let i = 0; i < pageDims.length; i++) {
    const { wMm, hMm } = pageDims[i];
    const pageNum = i + 1;
    const sizeStr = `${fmtMm(wMm)} × ${fmtMm(hMm)} mm`;

    if (expectedW !== undefined && expectedH !== undefined) {
      const matchesExpected =
        withinTolerance(wMm, expectedW) && withinTolerance(hMm, expectedH);

      if (!matchesExpected) {
        details.push({
          page: pageNum,
          message: `Page ${pageNum}: ${sizeStr} (expected ${expectedW}x${expectedH} mm)`,
          status: "fail",
        });
        worstStatus = "fail";
      } else {
        details.push({
          page: pageNum,
          message: `Page ${pageNum}: ${sizeStr}`,
          status: "pass",
        });
      }
    } else {
      // Consistency check against page 1
      const ref = pageDims[0];
      const consistent =
        withinTolerance(wMm, ref.wMm) && withinTolerance(hMm, ref.hMm);

      if (!consistent) {
        details.push({
          page: pageNum,
          message: `Page ${pageNum}: ${sizeStr}`,
          status: "warn",
        });
        if (worstStatus === "pass") worstStatus = "warn";
      } else {
        details.push({
          page: pageNum,
          message: `Page ${pageNum}: ${sizeStr}`,
          status: "pass",
        });
      }
    }
  }

  const refSize = pageDims[0];
  const summary =
    worstStatus === "pass"
      ? `All pages are ${fmtMm(refSize.wMm)} × ${fmtMm(refSize.hMm)} mm`
      : worstStatus === "warn"
        ? "Inconsistent page sizes detected"
        : "Page size mismatch";

  return { check: "Page Size", status: worstStatus, summary, details };
};
