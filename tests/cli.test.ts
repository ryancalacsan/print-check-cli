import { describe, it, expect, beforeAll } from "vitest";
import { runCli } from "./helpers/run-cli.js";
import { createBasicPdf } from "./helpers/pdf-fixtures.js";

let basicPdf: string;

beforeAll(async () => {
  basicPdf = await createBasicPdf();
});

describe("CLI integration tests", { timeout: 30_000 }, () => {
  it("should exit non-zero with no arguments", async () => {
    const result = await runCli([]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBeTruthy();
  });

  it("should exit 1 for non-existent file", async () => {
    const result = await runCli(["/tmp/does-not-exist-xyz.pdf"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });

  it("should output all check names in text mode", async () => {
    const result = await runCli([basicPdf]);
    expect(result.stdout).toContain("Bleed & Trim");
    expect(result.stdout).toContain("Fonts");
    expect(result.stdout).toContain("Color Space");
    expect(result.stdout).toContain("Resolution");
    expect(result.stdout).toContain("Total Ink Coverage");
  });

  it("should exit 1 when checks fail (unembedded fonts)", async () => {
    const result = await runCli([basicPdf]);
    expect(result.exitCode).toBe(1);
  });

  it("should exit 0 when all selected checks pass", async () => {
    // basicPdf has no images, so resolution check passes
    const result = await runCli([basicPdf, "--checks", "resolution"]);
    expect(result.exitCode).toBe(0);
  });

  it("should show detail lines with --verbose", async () => {
    const result = await runCli([basicPdf, "--verbose"]);
    expect(result.stdout).toMatch(/Page \d/);
  });

  it("should only run named checks with --checks", async () => {
    const result = await runCli([basicPdf, "--checks", "fonts"]);
    expect(result.stdout).toContain("Fonts");
    expect(result.stdout).not.toContain("Bleed & Trim");
    expect(result.stdout).not.toContain("Resolution");
  });

  it("should warn about unknown check names", async () => {
    const result = await runCli([basicPdf, "--checks", "fonts,bogus"]);
    expect(result.stderr).toMatch(/Unknown check.*bogus/i);
    // Valid check should still run
    expect(result.stdout).toContain("Fonts");
  });

  it("should output valid JSON with --format json", async () => {
    const result = await runCli([basicPdf, "--format", "json"]);
    const json = JSON.parse(result.stdout);
    expect(json).toHaveProperty("file");
    expect(json).toHaveProperty("results");
    expect(json).toHaveProperty("summary");
  });

  it("should include correct result count in JSON output", async () => {
    const result = await runCli([basicPdf, "--format", "json"]);
    const json = JSON.parse(result.stdout);
    expect(json.results).toHaveLength(6);
    const checkNames = json.results.map((r: { check: string }) => r.check);
    expect(checkNames).toContain("Bleed & Trim");
    expect(checkNames).toContain("Fonts");
    expect(checkNames).toContain("Color Space");
    expect(checkNames).toContain("Resolution");
    expect(checkNames).toContain("PDF/X Compliance");
    expect(checkNames).toContain("Total Ink Coverage");
  });

  it("should respect --min-dpi option", async () => {
    // With resolution-only check and default 300 DPI on a text-only PDF, should pass
    const result = await runCli([basicPdf, "--checks", "resolution", "--min-dpi", "1", "--format", "json"]);
    const json = JSON.parse(result.stdout);
    expect(json.results[0].check).toBe("Resolution");
    expect(json.results[0].status).toBe("pass");
  });

  it("--profile magazine should apply bleed=5", async () => {
    const result = await runCli([basicPdf, "--profile", "magazine", "--checks", "bleed", "--format", "json"]);
    const json = JSON.parse(result.stdout);
    // magazine profile requires 5mm bleed; basicPdf lacks sufficient bleed
    expect(json.results[0].check).toBe("Bleed & Trim");
    expect(["warn", "fail"]).toContain(json.results[0].status);
  });

  it("--profile newspaper should skip colorspace enforcement", async () => {
    const result = await runCli([basicPdf, "--profile", "newspaper", "--checks", "colorspace", "--format", "json"]);
    const json = JSON.parse(result.stdout);
    // newspaper profile uses colorSpace "any" so no enforcement → pass
    expect(json.results[0].check).toBe("Color Space");
    expect(json.results[0].status).toBe("pass");
  });

  it("--profile with explicit override uses the override value", async () => {
    // newspaper defaults to minDpi 150; override with 300
    const result = await runCli([
      basicPdf,
      "--profile", "newspaper",
      "--min-dpi", "300",
      "--checks", "resolution",
      "--format", "json",
    ]);
    const json = JSON.parse(result.stdout);
    expect(json.results[0].check).toBe("Resolution");
    // text-only PDF passes regardless, but we verify the CLI accepts the combo
    expect(json.results[0].status).toBe("pass");
  });

  it("should exit non-zero for unknown profile name", async () => {
    const result = await runCli([basicPdf, "--profile", "bogus"]);
    expect(result.exitCode).not.toBe(0);
  });

  // Batch file processing tests
  describe("batch file processing", () => {
    it("should show both filenames in text mode with multiple files", async () => {
      const result = await runCli([basicPdf, basicPdf, "--checks", "resolution"]);
      const matches = result.stdout.match(/print-check results:/g);
      expect(matches).toHaveLength(2);
    });

    it("should output an array of reports in JSON mode with multiple files", async () => {
      const result = await runCli([basicPdf, basicPdf, "--format", "json"]);
      const json = JSON.parse(result.stdout);
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(2);
      expect(json[0]).toHaveProperty("file");
      expect(json[0]).toHaveProperty("results");
      expect(json[0]).toHaveProperty("summary");
      expect(json[1]).toHaveProperty("file");
    });

    it("should output a single object (not array) in JSON mode with one file", async () => {
      const result = await runCli([basicPdf, "--format", "json"]);
      const json = JSON.parse(result.stdout);
      expect(Array.isArray(json)).toBe(false);
      expect(json).toHaveProperty("file");
      expect(json).toHaveProperty("results");
      expect(json).toHaveProperty("summary");
    });

    it("should report error for missing file and still check valid files", async () => {
      const result = await runCli(["/tmp/does-not-exist-xyz.pdf", basicPdf, "--checks", "resolution"]);
      expect(result.stderr).toMatch(/not found/i);
      expect(result.stdout).toContain("print-check results:");
    });
  });
});
