import * as mupdf from "mupdf";
import type { CheckFn, CheckResult, CheckDetail } from "../types.js";
import {
  safeResolve,
  safeGet,
  safeGetResolved,
  safeName,
  safeString,
} from "../engine/pdf-utils.js";

export const checkColorSpace: CheckFn = async (engines, options) => {
  if (options.colorSpace === "any") {
    return {
      check: "Color Space",
      status: "pass",
      summary: "Color space check skipped (--color-space any)",
      details: [],
    };
  }

  const { mupdf: doc } = engines;
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
      const condition = safeString(safeGet(intent, "OutputConditionIdentifier"));
      details.push({
        message: `OutputIntent: ${subtype} — ${condition ?? "unknown"}`,
        status: "pass",
      });
    }
  }

  // Walk each page's content stream via the Device API
  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const page = doc.loadPage(i);

    const device = new mupdf.Device({
      fillPath(
        _path: mupdf.Path,
        _evenOdd: boolean,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        _color: number[],
        _alpha: number,
      ) {
        classifyColorSpace(colorspace, pageNum, "fill path", _color);
      },
      strokePath(
        _path: mupdf.Path,
        _stroke: mupdf.StrokeState,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        _color: number[],
        _alpha: number,
      ) {
        classifyColorSpace(colorspace, pageNum, "stroke path", _color);
      },
      fillText(
        _text: mupdf.Text,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        _color: number[],
        _alpha: number,
      ) {
        classifyColorSpace(colorspace, pageNum, "fill text", _color);
      },
      strokeText(
        _text: mupdf.Text,
        _stroke: mupdf.StrokeState,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        _color: number[],
        _alpha: number,
      ) {
        classifyColorSpace(colorspace, pageNum, "stroke text", _color);
      },
      fillImage(image: mupdf.Image, _ctm: mupdf.Matrix, _alpha: number) {
        const cs = image.getColorSpace();
        if (cs) {
          const w = image.getWidth();
          const h = image.getHeight();
          classifyColorSpace(cs, pageNum, `image (${w}×${h}px)`);
        }
      },
      fillImageMask(
        _image: mupdf.Image,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        _color: number[],
        _alpha: number,
      ) {
        classifyColorSpace(colorspace, pageNum, "image mask", _color);
      },
    });

    page.runPageContents(device, mupdf.Matrix.identity);
  }

  function classifyColorSpace(
    cs: mupdf.ColorSpace,
    pageNum: number,
    source: string,
    color?: number[],
  ) {
    if (cs.isRGB()) {
      // Skip neutral colors (all channels equal — maps to CMYK gray/white/black)
      if (color && color.length >= 3) {
        const [r, g, b] = color;
        if (r === g && g === b) return;
      }
      if (!rgbPages.includes(pageNum)) rgbPages.push(pageNum);
      details.push({
        page: pageNum,
        message: `RGB ${source}`,
        status: "fail",
      });
      worstStatus = "fail";
    } else if (cs.isDeviceN()) {
      const name = cs.getName();
      if (!spotColors.includes(name)) spotColors.push(name);
    } else if (cs.getType() === "Separation") {
      const name = cs.getName();
      if (!spotColors.includes(name)) spotColors.push(name);
    } else if (cs.isGray() || cs.isCMYK()) {
      // Compatible — no action needed
    } else {
      details.push({
        page: pageNum,
        message: `Unknown color space "${cs.getName()}" in ${source}`,
        status: "warn",
      });
      if (worstStatus === "pass") worstStatus = "warn";
    }
  }

  if (spotColors.length > 0) {
    details.push({
      message: `Spot colors found: ${spotColors.join(", ")}`,
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
