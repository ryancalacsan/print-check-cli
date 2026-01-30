import type { CheckResult, JsonReport } from "../types.js";

export function buildJsonReport(fileName: string, results: CheckResult[]): JsonReport {
  return {
    file: fileName,
    results,
    summary: {
      passed: results.filter((r) => r.status === "pass").length,
      warned: results.filter((r) => r.status === "warn").length,
      failed: results.filter((r) => r.status === "fail").length,
    },
  };
}
