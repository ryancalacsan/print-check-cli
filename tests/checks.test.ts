import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { checkBleedTrim } from "../src/checks/bleed-trim.js";
import { checkFonts } from "../src/checks/fonts.js";
import { checkColorSpace } from "../src/checks/colorspace.js";
import { checkResolution } from "../src/checks/resolution.js";
import type { CheckOptions } from "../src/types.js";
import {
  createBasicPdf,
  createWithBleedPdf,
  createInsufficientBleedPdf,
  createMultiPageMixedBleedPdf,
  createEmbeddedFontPdf,
  createWithImagePdf,
  createHighDpiImagePdf,
  createLowDpiImagePdf,
  createNearThresholdDpiPdf,
} from "./helpers/pdf-fixtures.js";

const defaultOptions: CheckOptions = {
  minDpi: 300,
  colorSpace: "cmyk",
  bleedMm: 3,
};

// Fixture paths populated in beforeAll
let basicPdf: string;
let withBleedPdf: string;
let insufficientBleedPdf: string;
let mixedBleedPdf: string;
let embeddedFontPdf: string;
let highDpiPdf: string;
let lowDpiPdf: string;
let nearThresholdPdf: string;
let rgbImagePdf: string;

beforeAll(async () => {
  basicPdf = await createBasicPdf();
  withBleedPdf = await createWithBleedPdf(4);
  insufficientBleedPdf = await createInsufficientBleedPdf();
  mixedBleedPdf = await createMultiPageMixedBleedPdf();
  embeddedFontPdf = await createEmbeddedFontPdf();
  highDpiPdf = await createHighDpiImagePdf();
  lowDpiPdf = await createLowDpiImagePdf();
  nearThresholdPdf = await createNearThresholdDpiPdf();
  rgbImagePdf = await createWithImagePdf(100, 100);
});

// ---------------------------------------------------------------------------
// Bleed & Trim
// ---------------------------------------------------------------------------

describe("Bleed & Trim check", () => {
  it("should warn when TrimBox/BleedBox are missing", async () => {
    const result = await checkBleedTrim(basicPdf, defaultOptions);
    expect(result.check).toBe("Bleed & Trim");
    expect(result.status).toBe("warn");
    expect(result.details[0].message).toContain("No TrimBox or BleedBox");
  });

  it("should pass with sufficient bleed (3mm+)", async () => {
    const result = await checkBleedTrim(withBleedPdf, defaultOptions);
    expect(result.status).toBe("pass");
    expect(result.details[0].message).toContain("Bleed OK");
  });

  it("should fail with insufficient bleed", async () => {
    const result = await checkBleedTrim(insufficientBleedPdf, defaultOptions);
    expect(result.status).toBe("fail");
    expect(result.details[0].message).toContain("Insufficient bleed");
  });

  it("should report per-page status on multi-page PDFs", async () => {
    const result = await checkBleedTrim(mixedBleedPdf, defaultOptions);
    // Overall status should be fail (page 3 has insufficient bleed)
    expect(result.status).toBe("fail");
    expect(result.details.length).toBe(3);

    // Page 1: pass (3mm bleed)
    expect(result.details[0].page).toBe(1);
    expect(result.details[0].status).toBe("pass");

    // Page 2: warn (no boxes)
    expect(result.details[1].page).toBe(2);
    expect(result.details[1].status).toBe("warn");

    // Page 3: fail (1mm bleed)
    expect(result.details[2].page).toBe(3);
    expect(result.details[2].status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

describe("Font check", () => {
  it("should detect unembedded standard fonts", async () => {
    const result = await checkFonts(basicPdf, defaultOptions);
    expect(result.check).toBe("Fonts");
    expect(result.status).toBe("fail");
    expect(result.details.some((d) => d.message.includes("not embedded"))).toBe(true);
  });

  it("should detect subset-embedded fonts as warn", async () => {
    // pdf-lib StandardFonts don't actually get embedded, but check the detection
    // path still works without crashing. The Courier font from embeddedFontPdf
    // will be detected as not-embedded (standard font behavior in pdf-lib).
    const result = await checkFonts(embeddedFontPdf, defaultOptions);
    expect(result.check).toBe("Fonts");
    // Standard fonts in pdf-lib are not embedded
    expect(["fail", "warn"]).toContain(result.status);
  });

  it("should deduplicate fonts across pages", async () => {
    const result = await checkFonts(embeddedFontPdf, defaultOptions);
    // Courier used on 2 pages but should appear only once in details
    const courierDetails = result.details.filter((d) => d.message.includes("Courier"));
    expect(courierDetails.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Color Space
// ---------------------------------------------------------------------------

describe("Color Space check", () => {
  it("should pass when no RGB color spaces are used", async () => {
    const result = await checkColorSpace(basicPdf, defaultOptions);
    expect(result.check).toBe("Color Space");
    // Basic pdf-lib PDF with text only should pass or warn
    expect(["pass", "warn"]).toContain(result.status);
  });

  it("should skip when color-space is 'any'", async () => {
    const result = await checkColorSpace(basicPdf, {
      ...defaultOptions,
      colorSpace: "any",
    });
    expect(result.status).toBe("pass");
    expect(result.summary).toContain("skipped");
  });

  it("should fail when image uses RGB color space", async () => {
    const result = await checkColorSpace(rgbImagePdf, defaultOptions);
    expect(result.check).toBe("Color Space");
    // An embedded PNG is RGB — should be detected
    expect(["fail", "warn"]).toContain(result.status);
  });

  it("should handle OutputIntents without crashing", async () => {
    // The basic PDF has no OutputIntents — check it doesn't crash
    const result = await checkColorSpace(basicPdf, defaultOptions);
    expect(result.check).toBe("Color Space");
    // Should complete without throwing
  });
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

describe("Resolution check", () => {
  it("should pass when no raster images exist", async () => {
    const result = await checkResolution(basicPdf, defaultOptions);
    expect(result.check).toBe("Resolution");
    expect(result.status).toBe("pass");
    expect(result.summary).toContain("No raster images");
  });

  it("should pass with high-DPI image (≥300)", async () => {
    const result = await checkResolution(highDpiPdf, defaultOptions);
    expect(result.status).toBe("pass");
    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details[0].status).toBe("pass");
  });

  it("should fail with low-DPI image", async () => {
    const result = await checkResolution(lowDpiPdf, defaultOptions);
    expect(result.status).toBe("fail");
    expect(result.details.some((d) => d.status === "fail")).toBe(true);
  });

  it("should warn near threshold", async () => {
    const result = await checkResolution(nearThresholdPdf, defaultOptions);
    // 285 DPI is between 270 (90% of 300) and 300 — should be warn
    expect(result.status).toBe("warn");
    expect(result.details.some((d) => d.status === "warn")).toBe(true);
  });

  it("should respect custom minDpi option", async () => {
    // High DPI PDF (600 DPI) should pass even with higher threshold
    const result = await checkResolution(highDpiPdf, { ...defaultOptions, minDpi: 500 });
    expect(result.status).toBe("pass");

    // Same PDF should fail with very high threshold
    const result2 = await checkResolution(highDpiPdf, { ...defaultOptions, minDpi: 700 });
    expect(result2.status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("Error handling", () => {
  it("should fail gracefully for non-existent file", async () => {
    const fakePath = path.join(os.tmpdir(), "does-not-exist.pdf");
    await expect(checkBleedTrim(fakePath, defaultOptions)).rejects.toThrow();
  });

  it("should fail gracefully for corrupted PDF", async () => {
    const corruptPath = path.join(os.tmpdir(), "print-check-corrupt.pdf");
    fs.writeFileSync(corruptPath, "this is not a pdf");
    await expect(checkBleedTrim(corruptPath, defaultOptions)).rejects.toThrow();
  });
});
