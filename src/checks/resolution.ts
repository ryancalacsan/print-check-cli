import * as mupdf from "mupdf";
import type { CheckFn, CheckResult, CheckDetail } from "../types.js";

export const checkResolution: CheckFn = async (engines, options) => {
  const { mupdf: doc } = engines;
  const details: CheckDetail[] = [];
  let worstStatus: CheckResult["status"] = "pass";

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const page = doc.loadPage(i);

    // Collect image placements via the Device API
    const placements: { image: mupdf.Image; ctm: mupdf.Matrix }[] = [];

    const device = new mupdf.Device({
      fillImage(image: mupdf.Image, ctm: mupdf.Matrix, _alpha: number) {
        placements.push({ image, ctm });
      },
      fillImageMask(
        image: mupdf.Image,
        ctm: mupdf.Matrix,
        _colorspace: mupdf.ColorSpace,
        _color: number[],
        _alpha: number,
      ) {
        placements.push({ image, ctm });
      },
    });

    page.run(device, mupdf.Matrix.identity);

    for (const { image, ctm } of placements) {
      const pixelWidth = image.getWidth();
      const pixelHeight = image.getHeight();
      if (!pixelWidth || !pixelHeight) continue;

      const [a, b, c, d] = ctm;
      const renderedWidthPt = Math.sqrt(a * a + b * b);
      const renderedHeightPt = Math.sqrt(c * c + d * d);

      const renderedWidthIn = renderedWidthPt / 72;
      const renderedHeightIn = renderedHeightPt / 72;

      const dpiX = renderedWidthIn > 0 ? pixelWidth / renderedWidthIn : 0;
      const dpiY = renderedHeightIn > 0 ? pixelHeight / renderedHeightIn : 0;
      const effectiveDpi = Math.min(dpiX, dpiY);
      const roundedDpi = Math.round(effectiveDpi);

      const label = `${pixelWidth}×${pixelHeight}px image`;
      const threshold = options.minDpi;
      const warnThreshold = threshold * 0.9;

      if (effectiveDpi < warnThreshold) {
        details.push({
          page: pageNum,
          message: `${label}: ${roundedDpi} DPI (min: ${threshold})`,
          status: "fail",
        });
        worstStatus = "fail";
      } else if (effectiveDpi < threshold) {
        details.push({
          page: pageNum,
          message: `${label}: ${roundedDpi} DPI (near threshold: ${threshold})`,
          status: "warn",
        });
        if (worstStatus === "pass") worstStatus = "warn";
      } else {
        details.push({
          page: pageNum,
          message: `${label}: ${roundedDpi} DPI`,
          status: "pass",
        });
      }
    }
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
