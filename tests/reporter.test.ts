import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printReport } from "../src/reporter/console.js";
import { buildJsonReport } from "../src/reporter/json.js";
import type { CheckResult } from "../src/types.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const passResult: CheckResult = {
  check: "Resolution",
  status: "pass",
  summary: "All images ≥300 DPI",
  details: [{ message: "300×300px image at 300 DPI", status: "pass", page: 1 }],
};

const warnResult: CheckResult = {
  check: "Transparency",
  status: "warn",
  summary: "Transparency detected on page 1",
  details: [{ message: "Page 1: Alpha transparency (0.5)", status: "warn", page: 1 }],
};

const failResult: CheckResult = {
  check: "Fonts",
  status: "fail",
  summary: "1 font(s) not embedded",
  details: [
    { message: 'Font "Helvetica" is not embedded', status: "fail", page: 1 },
    { message: 'Font "Courier" is not embedded', status: "fail" },
  ],
};

// ---------------------------------------------------------------------------
// JSON reporter
// ---------------------------------------------------------------------------

describe("buildJsonReport", () => {
  it("should build a report with correct file name", () => {
    const report = buildJsonReport("test.pdf", [passResult]);
    expect(report.file).toBe("test.pdf");
  });

  it("should include all results", () => {
    const report = buildJsonReport("test.pdf", [passResult, warnResult, failResult]);
    expect(report.results).toHaveLength(3);
    expect(report.results[0].check).toBe("Resolution");
    expect(report.results[2].check).toBe("Fonts");
  });

  it("should count passed/warned/failed correctly", () => {
    const report = buildJsonReport("test.pdf", [passResult, warnResult, failResult]);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.warned).toBe(1);
    expect(report.summary.failed).toBe(1);
  });

  it("should handle all-pass results", () => {
    const report = buildJsonReport("test.pdf", [passResult]);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.warned).toBe(0);
    expect(report.summary.failed).toBe(0);
  });

  it("should handle empty results", () => {
    const report = buildJsonReport("test.pdf", []);
    expect(report.results).toHaveLength(0);
    expect(report.summary.passed).toBe(0);
    expect(report.summary.warned).toBe(0);
    expect(report.summary.failed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Console reporter
// ---------------------------------------------------------------------------

describe("printReport", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("should print the file name", () => {
    printReport("test.pdf", [passResult], false);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("test.pdf");
  });

  it("should print check names and summaries", () => {
    printReport("test.pdf", [passResult, failResult], false);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Resolution");
    expect(output).toContain("Fonts");
  });

  it("should print status icons", () => {
    printReport("test.pdf", [passResult, warnResult, failResult], false);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    // Check for the unicode characters (with or without color codes)
    expect(output).toContain("✓");
    expect(output).toContain("⚠");
    expect(output).toContain("✗");
  });

  it("should print summary counts", () => {
    printReport("test.pdf", [passResult, warnResult, failResult], false);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1 passed");
    expect(output).toContain("1 warned");
    expect(output).toContain("1 failed");
  });

  it("should not print details when verbose is false", () => {
    printReport("test.pdf", [failResult], false);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).not.toContain("Helvetica");
  });

  it("should print details when verbose is true", () => {
    printReport("test.pdf", [failResult], true);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Helvetica");
    expect(output).toContain("Courier");
  });

  it("should print page prefix in verbose details when page is set", () => {
    printReport("test.pdf", [failResult], true);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    // First detail has page: 1, second has no page
    expect(output).toContain("Page 1:");
  });

  it("should omit page prefix when detail has no page", () => {
    const nopageResult: CheckResult = {
      check: "Test",
      status: "fail",
      summary: "test",
      details: [{ message: "no page detail", status: "fail" }],
    };
    printReport("test.pdf", [nopageResult], true);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("no page detail");
    // Should not have "Page" prefix before this detail
    expect(output).not.toMatch(/Page \d+:.*no page detail/);
  });

  it("should handle results with only passes", () => {
    printReport("test.pdf", [passResult], false);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1 passed");
    expect(output).not.toContain("warned");
    expect(output).not.toContain("failed");
  });
});
