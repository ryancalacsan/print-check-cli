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

  it("should output all 4 check names in text mode", async () => {
    const result = await runCli([basicPdf]);
    expect(result.stdout).toContain("Bleed & Trim");
    expect(result.stdout).toContain("Fonts");
    expect(result.stdout).toContain("Color Space");
    expect(result.stdout).toContain("Resolution");
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
    expect(json.results).toHaveLength(4);
    const checkNames = json.results.map((r: { check: string }) => r.check);
    expect(checkNames).toContain("Bleed & Trim");
    expect(checkNames).toContain("Fonts");
    expect(checkNames).toContain("Color Space");
    expect(checkNames).toContain("Resolution");
  });

  it("should respect --min-dpi option", async () => {
    // With resolution-only check and default 300 DPI on a text-only PDF, should pass
    const result = await runCli([basicPdf, "--checks", "resolution", "--min-dpi", "1", "--format", "json"]);
    const json = JSON.parse(result.stdout);
    expect(json.results[0].check).toBe("Resolution");
    expect(json.results[0].status).toBe("pass");
  });
});
