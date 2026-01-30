import type { CheckFn, CheckResult, CheckDetail } from "../types.js";

const PT_TO_MM = 25.4 / 72;

export const checkBleedTrim: CheckFn = async (engines, options) => {
  const { pdfLib } = engines;
  const pages = pdfLib.getPages();
  const details: CheckDetail[] = [];
  let worstStatus: CheckResult["status"] = "pass";

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageNum = i + 1;

    const mediaBox = page.getMediaBox();
    const trimBox = page.getTrimBox();
    const bleedBox = page.getBleedBox();

    const hasTrimBox =
      trimBox.x !== mediaBox.x ||
      trimBox.y !== mediaBox.y ||
      trimBox.width !== mediaBox.width ||
      trimBox.height !== mediaBox.height;

    const hasBleedBox =
      bleedBox.x !== mediaBox.x ||
      bleedBox.y !== mediaBox.y ||
      bleedBox.width !== mediaBox.width ||
      bleedBox.height !== mediaBox.height;

    if (!hasTrimBox && !hasBleedBox) {
      details.push({
        page: pageNum,
        message: "No TrimBox or BleedBox defined (only MediaBox found)",
        status: "warn",
      });
      if (worstStatus === "pass") worstStatus = "warn";
      continue;
    }

    if (!hasTrimBox) {
      details.push({
        page: pageNum,
        message: "No TrimBox defined",
        status: "warn",
      });
      if (worstStatus === "pass") worstStatus = "warn";
      continue;
    }

    // Calculate bleed on each side in mm
    // BleedBox should be larger than TrimBox; if no BleedBox, use MediaBox
    const refBox = hasBleedBox ? bleedBox : mediaBox;

    const bleedLeft = (trimBox.x - refBox.x) * PT_TO_MM;
    const bleedBottom = (trimBox.y - refBox.y) * PT_TO_MM;
    const bleedRight = (refBox.x + refBox.width - (trimBox.x + trimBox.width)) * PT_TO_MM;
    const bleedTop = (refBox.y + refBox.height - (trimBox.y + trimBox.height)) * PT_TO_MM;

    const minBleed = Math.min(bleedLeft, bleedBottom, bleedRight, bleedTop);
    const requiredMm = options.bleedMm;

    if (minBleed < requiredMm) {
      const sides: string[] = [];
      if (bleedLeft < requiredMm) sides.push(`left: ${bleedLeft.toFixed(1)}mm`);
      if (bleedRight < requiredMm) sides.push(`right: ${bleedRight.toFixed(1)}mm`);
      if (bleedTop < requiredMm) sides.push(`top: ${bleedTop.toFixed(1)}mm`);
      if (bleedBottom < requiredMm) sides.push(`bottom: ${bleedBottom.toFixed(1)}mm`);

      details.push({
        page: pageNum,
        message: `Insufficient bleed (need ${requiredMm}mm): ${sides.join(", ")}`,
        status: "fail",
      });
      worstStatus = "fail";
    } else {
      details.push({
        page: pageNum,
        message: `Bleed OK (min ${minBleed.toFixed(1)}mm)`,
        status: "pass",
      });
    }
  }

  const summary =
    worstStatus === "pass"
      ? `All pages have ${options.bleedMm}mm+ bleed`
      : worstStatus === "warn"
        ? "TrimBox or BleedBox missing on some pages"
        : "Insufficient bleed on some pages";

  return { check: "Bleed & Trim", status: worstStatus, summary, details };
};
