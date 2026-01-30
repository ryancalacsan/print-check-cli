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

function getColorSpaceName(csObj: PDFObject): string {
  if (csObj.isNull()) return "null";
  if (csObj.isName()) return csObj.asName();
  if (csObj.isArray() && csObj.length > 0) {
    const first = csObj.get(0);
    if (first && !first.isNull() && first.isName()) return first.asName();
  }
  return csObj.toString();
}

function isCmykCompatible(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("devicecmyk") ||
    lower.includes("iccbased") ||
    lower.includes("separation") ||
    lower.includes("devicen") ||
    lower.includes("devicegray") ||
    lower.includes("indexed")
  );
}

function hasRGBProfile(csObj: PDFObject): boolean {
  if (csObj.isArray() && csObj.length >= 2) {
    const stream = safeResolve(csObj.get(1));
    if (!stream) return false;
    const n = safeNumber(safeGet(stream, "N"));
    return n === 3;
  }
  return false;
}

export const checkColorSpace: CheckFn = async (filePath, options) => {
  if (options.colorSpace === "any") {
    return {
      check: "Color Space",
      status: "pass",
      summary: "Color space check skipped (--color-space any)",
      details: [],
    };
  }

  const { mupdf: doc } = await loadPdf(filePath);
  const details: CheckDetail[] = [];
  let worstStatus: CheckResult["status"] = "pass";
  const rgbPages: number[] = [];
  const spotColors: string[] = [];

  // Check document-level OutputIntents
  const trailer = doc.getTrailer();
  const root = safeGetResolved(trailer, "Root");
  const outputIntents = safeGet(root, "OutputIntents");
  if (outputIntents) {
    for (let i = 0; i < outputIntents.length; i++) {
      const intent = safeResolve(outputIntents.get(i));
      if (!intent) continue;
      const subtype = safeName(safeGet(intent, "S"));
      const conditionObj = safeGet(intent, "OutputConditionIdentifier");
      const condition =
        conditionObj && !conditionObj.isNull() ? conditionObj.asString() : null;
      details.push({
        message: `OutputIntent: ${subtype} — ${condition ?? "unknown"}`,
        status: "pass",
      });
    }
  }

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const pageObj = doc.findPage(i);
    const resources = safeGetResolved(pageObj, "Resources");
    if (!resources) continue;

    // Check page-level color spaces
    const csDict = safeGetResolved(resources, "ColorSpace");
    if (csDict) {
      safeForEach(csDict, (value: PDFObject, key: string) => {
        const resolved = safeResolve(value);
        if (!resolved) return;
        const csName = getColorSpaceName(resolved);

        if (
          csName.toLowerCase().includes("separation") ||
          csName.toLowerCase().includes("devicen")
        ) {
          spotColors.push(key);
        }

        if (csName.toLowerCase().includes("devicergb")) {
          rgbPages.push(pageNum);
          details.push({
            page: pageNum,
            message: `Color space "${key}" uses DeviceRGB`,
            status: "warn",
          });
          if (worstStatus === "pass") worstStatus = "warn";
        }
      });
    }

    // Check image XObjects for color spaces
    const xobjects = safeGetResolved(resources, "XObject");
    if (xobjects) {
      safeForEach(xobjects, (value: PDFObject, key: string) => {
        const xobj = safeResolve(value);
        if (!xobj) return;
        const subtype = safeName(safeGet(xobj, "Subtype"));
        if (subtype !== "Image") return;

        const imgCs = safeGetResolved(xobj, "ColorSpace");
        if (!imgCs) return;

        const csName = getColorSpaceName(imgCs);
        if (
          csName.toLowerCase().includes("devicergb") ||
          (csName.toLowerCase().includes("iccbased") && hasRGBProfile(imgCs))
        ) {
          if (!rgbPages.includes(pageNum)) rgbPages.push(pageNum);
          details.push({
            page: pageNum,
            message: `Image "${key}" uses RGB color space`,
            status: "fail",
          });
          worstStatus = "fail";
        } else if (!isCmykCompatible(csName)) {
          details.push({
            page: pageNum,
            message: `Image "${key}" uses "${csName}"`,
            status: "warn",
          });
          if (worstStatus === "pass") worstStatus = "warn";
        }
      });
    }
  }

  if (spotColors.length > 0) {
    details.push({
      message: `Spot colors found: ${[...new Set(spotColors)].join(", ")}`,
      status: "pass",
    });
  }

  const summary =
    worstStatus === "pass"
      ? "All color spaces are CMYK-compatible"
      : rgbPages.length > 0
        ? `RGB detected on pages ${[...new Set(rgbPages)].join(", ")}`
        : "Non-CMYK color spaces detected";

  return { check: "Color Space", status: worstStatus, summary, details };
};
