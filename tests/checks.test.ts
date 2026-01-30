import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { checkBleedTrim } from "../src/checks/bleed-trim.js";
import { checkFonts } from "../src/checks/fonts.js";
import { checkColorSpace } from "../src/checks/colorspace.js";
import { checkResolution } from "../src/checks/resolution.js";
import type { CheckOptions } from "../src/types.js";

const defaultOptions: CheckOptions = {
  minDpi: 300,
  colorSpace: "cmyk",
  bleedMm: 3,
};

let testPdfPath: string;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);

  page.drawText("Test PDF", {
    x: 50,
    y: 700,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  });

  const bytes = await doc.save();
  testPdfPath = path.join(os.tmpdir(), "print-check-test.pdf");
  fs.writeFileSync(testPdfPath, bytes);
});

describe("Bleed & Trim check", () => {
  it("should warn when TrimBox/BleedBox are missing", async () => {
    const result = await checkBleedTrim(testPdfPath, defaultOptions);
    expect(result.check).toBe("Bleed & Trim");
    expect(result.status).toBe("warn");
    expect(result.details[0].message).toContain("No TrimBox or BleedBox");
  });
});

describe("Font check", () => {
  it("should detect unembedded standard fonts", async () => {
    const result = await checkFonts(testPdfPath, defaultOptions);
    expect(result.check).toBe("Fonts");
    expect(result.status).toBe("fail");
    expect(result.details.some((d) => d.message.includes("not embedded"))).toBe(
      true,
    );
  });
});

describe("Color Space check", () => {
  it("should pass when no RGB color spaces are used", async () => {
    const result = await checkColorSpace(testPdfPath, defaultOptions);
    expect(result.check).toBe("Color Space");
    // Simple pdf-lib PDFs may not have explicit DeviceRGB in resources
    expect(["pass", "warn"]).toContain(result.status);
  });

  it("should skip when color-space is 'any'", async () => {
    const result = await checkColorSpace(testPdfPath, {
      ...defaultOptions,
      colorSpace: "any",
    });
    expect(result.status).toBe("pass");
    expect(result.summary).toContain("skipped");
  });
});

describe("Resolution check", () => {
  it("should pass when no raster images exist", async () => {
    const result = await checkResolution(testPdfPath, defaultOptions);
    expect(result.check).toBe("Resolution");
    expect(result.status).toBe("pass");
    expect(result.summary).toContain("No raster images");
  });
});
