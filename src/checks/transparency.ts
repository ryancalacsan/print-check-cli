import * as mupdf from "mupdf";
import type { CheckFn, CheckResult, CheckDetail } from "../types.js";

interface TransparencyInfo {
  blendModes: Set<string>;
  hasAlpha: boolean;
  alphaValues: number[];
  hasSoftMask: boolean;
}

export const checkTransparency: CheckFn = async (engines) => {
  const { mupdf: doc } = engines;
  const details: CheckDetail[] = [];
  const pagesWithTransparency: number[] = [];

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const page = doc.loadPage(i);

    const info: TransparencyInfo = {
      blendModes: new Set(),
      hasAlpha: false,
      alphaValues: [],
      hasSoftMask: false,
    };

    function recordAlpha(alpha: number) {
      if (alpha < 1) {
        info.hasAlpha = true;
        if (!info.alphaValues.includes(alpha)) {
          info.alphaValues.push(alpha);
        }
      }
    }

    const device = new mupdf.Device({
      fillPath(
        _path: mupdf.Path,
        _evenOdd: boolean,
        _ctm: mupdf.Matrix,
        _colorspace: mupdf.ColorSpace,
        _color: number[],
        alpha: number,
      ) {
        recordAlpha(alpha);
      },
      strokePath(
        _path: mupdf.Path,
        _stroke: mupdf.StrokeState,
        _ctm: mupdf.Matrix,
        _colorspace: mupdf.ColorSpace,
        _color: number[],
        alpha: number,
      ) {
        recordAlpha(alpha);
      },
      fillText(
        _text: mupdf.Text,
        _ctm: mupdf.Matrix,
        _colorspace: mupdf.ColorSpace,
        _color: number[],
        alpha: number,
      ) {
        recordAlpha(alpha);
      },
      strokeText(
        _text: mupdf.Text,
        _stroke: mupdf.StrokeState,
        _ctm: mupdf.Matrix,
        _colorspace: mupdf.ColorSpace,
        _color: number[],
        alpha: number,
      ) {
        recordAlpha(alpha);
      },
      fillImageMask(
        _image: mupdf.Image,
        _ctm: mupdf.Matrix,
        _colorspace: mupdf.ColorSpace,
        _color: number[],
        alpha: number,
      ) {
        recordAlpha(alpha);
      },
      fillImage(
        _image: mupdf.Image,
        _ctm: mupdf.Matrix,
        alpha: number,
      ) {
        recordAlpha(alpha);
      },
      beginGroup(
        _bbox: mupdf.Rect,
        _colorspace: mupdf.ColorSpace,
        _isolated: boolean,
        _knockout: boolean,
        blendmode: string,
        alpha: number,
      ) {
        if (blendmode !== "Normal") {
          info.blendModes.add(blendmode);
        }
        recordAlpha(alpha);
      },
      beginMask(
        _bbox: mupdf.Rect,
        _luminosity: boolean,
        _colorspace: mupdf.ColorSpace,
        _color: number[],
      ) {
        info.hasSoftMask = true;
      },
    });

    page.runPageContents(device, mupdf.Matrix.identity);

    const parts: string[] = [];
    if (info.blendModes.size > 0) {
      const modes = Array.from(info.blendModes).join(", ");
      parts.push(`Blend mode (${modes})`);
    }
    if (info.hasAlpha) {
      const minAlpha = Math.min(...info.alphaValues);
      parts.push(`Alpha transparency (${minAlpha})`);
    }
    if (info.hasSoftMask) {
      parts.push("soft mask");
    }

    if (parts.length > 0) {
      pagesWithTransparency.push(pageNum);
      details.push({
        page: pageNum,
        message: `Page ${pageNum}: ${parts.join(", ")}`,
        status: "warn",
      });
    }
  }

  const status: CheckResult["status"] =
    pagesWithTransparency.length > 0 ? "warn" : "pass";

  const summary =
    pagesWithTransparency.length > 0
      ? `Transparency detected on ${pagesWithTransparency.length === 1 ? "page" : "pages"} ${pagesWithTransparency.join(", ")}`
      : "No transparency detected";

  return {
    check: "Transparency",
    status,
    summary,
    details,
  };
};
