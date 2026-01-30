import type { CheckFn, CheckResult, CheckDetail } from "../types.js";
import { loadPdf } from "../engine/pdf-engine.js";
import {
  safeResolve,
  safeGet,
  safeGetResolved,
  safeName,
  safeNumber,
  safeForEach,
} from "../engine/pdf-utils.js";
import type { PDFObject } from "mupdf";

const PT_TO_INCH = 1 / 72;

export const checkResolution: CheckFn = async (filePath, options) => {
  const { mupdf: doc } = await loadPdf(filePath);
  const details: CheckDetail[] = [];
  let worstStatus: CheckResult["status"] = "pass";

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const pageObj = doc.findPage(i);

    // Get MediaBox for page dimensions
    const mediaBox = safeGetResolved(pageObj, "MediaBox");
    if (!mediaBox) continue;

    const x0 = safeNumber(mediaBox.get(0)) ?? 0;
    const y0 = safeNumber(mediaBox.get(1)) ?? 0;
    const x1 = safeNumber(mediaBox.get(2)) ?? 0;
    const y1 = safeNumber(mediaBox.get(3)) ?? 0;

    const pageWidthPt = x1 - x0;
    const pageHeightPt = y1 - y0;
    const pageWidthInch = Math.abs(pageWidthPt) * PT_TO_INCH;
    const pageHeightInch = Math.abs(pageHeightPt) * PT_TO_INCH;

    const resources = safeGetResolved(pageObj, "Resources");
    if (!resources) continue;

    const xobjects = safeGetResolved(resources, "XObject");
    if (!xobjects) continue;

    safeForEach(xobjects, (value: PDFObject, key: string) => {
      const xobj = safeResolve(value);
      if (!xobj) return;
      const subtype = safeName(safeGet(xobj, "Subtype"));
      if (subtype !== "Image") return;

      const pixelWidth = safeNumber(safeGet(xobj, "Width"));
      const pixelHeight = safeNumber(safeGet(xobj, "Height"));
      if (!pixelWidth || !pixelHeight) return;

      // MVP simplification: assume image fills the page
      const dpiX = pageWidthInch > 0 ? pixelWidth / pageWidthInch : 0;
      const dpiY = pageHeightInch > 0 ? pixelHeight / pageHeightInch : 0;
      const effectiveDpi = Math.min(dpiX, dpiY);
      const roundedDpi = Math.round(effectiveDpi);

      const threshold = options.minDpi;
      const warnThreshold = threshold * 0.9;

      if (effectiveDpi < warnThreshold) {
        details.push({
          page: pageNum,
          message: `Image "${key}": ${roundedDpi} DPI (${pixelWidth}×${pixelHeight}px, min: ${threshold})`,
          status: "fail",
        });
        worstStatus = "fail";
      } else if (effectiveDpi < threshold) {
        details.push({
          page: pageNum,
          message: `Image "${key}": ${roundedDpi} DPI (${pixelWidth}×${pixelHeight}px, near threshold: ${threshold})`,
          status: "warn",
        });
        if (worstStatus === "pass") worstStatus = "warn";
      } else {
        details.push({
          page: pageNum,
          message: `Image "${key}": ${roundedDpi} DPI (${pixelWidth}×${pixelHeight}px)`,
          status: "pass",
        });
      }
    });
  }

  if (details.length === 0) {
    return {
      check: "Resolution",
      status: "pass",
      summary: "No raster images found",
      details: [],
    };
  }

  const failedDetails = details.filter((d) => d.status === "fail");
  const summary =
    worstStatus === "pass"
      ? `All images meet ${options.minDpi} DPI minimum`
      : worstStatus === "warn"
        ? `Some images near DPI threshold (${options.minDpi})`
        : failedDetails
            .map((d) => `Page ${d.page}: ${d.message}`)
            .slice(0, 3)
            .join("; ");

  return { check: "Resolution", status: worstStatus, summary, details };
};
