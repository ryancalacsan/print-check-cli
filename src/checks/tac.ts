import * as mupdf from "mupdf";
import type { CheckFn, CheckResult, CheckDetail } from "../types.js";

export const checkTac: CheckFn = async (engines, options) => {
  const { mupdf: doc } = engines;
  const details: CheckDetail[] = [];
  let worstStatus: CheckResult["status"] = "pass";
  let globalMaxTac = 0;
  let globalMaxPage = 1;

  const maxTac = options.maxTac;
  const warnThreshold = maxTac * 0.9;

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const page = doc.loadPage(i);
    let pageMaxTac = 0;

    function recordTac(tac: number) {
      if (tac > pageMaxTac) pageMaxTac = tac;
    }

    function handleVectorColor(
      colorspace: mupdf.ColorSpace,
      color: number[],
    ) {
      if (!colorspace.isCMYK()) return;
      const tac =
        (color[0] + color[1] + color[2] + color[3]) * 100;
      recordTac(tac);
    }

    const device = new mupdf.Device({
      fillPath(
        _path: mupdf.Path,
        _evenOdd: boolean,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        color: number[],
        _alpha: number,
      ) {
        handleVectorColor(colorspace, color);
      },
      strokePath(
        _path: mupdf.Path,
        _stroke: mupdf.StrokeState,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        color: number[],
        _alpha: number,
      ) {
        handleVectorColor(colorspace, color);
      },
      fillText(
        _text: mupdf.Text,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        color: number[],
        _alpha: number,
      ) {
        handleVectorColor(colorspace, color);
      },
      strokeText(
        _text: mupdf.Text,
        _stroke: mupdf.StrokeState,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        color: number[],
        _alpha: number,
      ) {
        handleVectorColor(colorspace, color);
      },
      fillImageMask(
        _image: mupdf.Image,
        _ctm: mupdf.Matrix,
        colorspace: mupdf.ColorSpace,
        color: number[],
        _alpha: number,
      ) {
        handleVectorColor(colorspace, color);
      },
      fillImage(image: mupdf.Image, _ctm: mupdf.Matrix, _alpha: number) {
        const cs = image.getColorSpace();
        if (!cs || !cs.isCMYK()) return;

        const pixmap = image.toPixmap();
        const w = pixmap.getWidth();
        const h = pixmap.getHeight();
        const n = pixmap.getNumberOfComponents();
        const samples = pixmap.getPixels();

        // Sample every Nth pixel for performance
        const totalPixels = w * h;
        const step = Math.max(1, Math.floor(totalPixels / 10000));
        const stride = n + (pixmap.getAlpha() ? 1 : 0);

        let imageMaxTac = 0;
        for (let px = 0; px < totalPixels; px += step) {
          const offset = px * stride;
          // Pixel values are 0–255, convert to percentage
          const c = samples[offset] / 255;
          const m = samples[offset + 1] / 255;
          const y = samples[offset + 2] / 255;
          const k = samples[offset + 3] / 255;
          const tac = (c + m + y + k) * 100;
          if (tac > imageMaxTac) imageMaxTac = tac;
        }

        recordTac(imageMaxTac);
      },
    });

    page.runPageContents(device, mupdf.Matrix.identity);

    if (pageMaxTac > globalMaxTac) {
      globalMaxTac = pageMaxTac;
      globalMaxPage = pageNum;
    }

    if (pageMaxTac > 0) {
      const tacRounded = Math.round(pageMaxTac);
      let status: CheckDetail["status"];
      if (pageMaxTac > maxTac) {
        status = "fail";
      } else if (pageMaxTac > warnThreshold) {
        status = "warn";
      } else {
        status = "pass";
      }

      details.push({
        page: pageNum,
        message: `Max TAC: ${tacRounded}% (limit: ${maxTac}%)`,
        status,
      });

      if (status === "fail") {
        worstStatus = "fail";
      } else if (status === "warn" && worstStatus === "pass") {
        worstStatus = "warn";
      }
    }
  }

  const tacRounded = Math.round(globalMaxTac);
  const summary =
    globalMaxTac === 0
      ? `All content within TAC limit (${maxTac}%)`
      : globalMaxTac > maxTac
        ? `Max TAC: ${tacRounded}% on page ${globalMaxPage} (limit: ${maxTac}%)`
        : `All content within TAC limit (${maxTac}%)`

  return {
    check: "Total Ink Coverage",
    status: worstStatus,
    summary,
    details,
  };
};
