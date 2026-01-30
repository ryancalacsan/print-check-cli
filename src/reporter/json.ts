import type { CheckResult, JsonReport } from "../types.js";

export function printJsonReport(
  fileName: string,
  results: CheckResult[],
): void {
  const report: JsonReport = {
    file: fileName,
    results,
    summary: {
      passed: results.filter((r) => r.status === "pass").length,
      warned: results.filter((r) => r.status === "warn").length,
      failed: results.filter((r) => r.status === "fail").length,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}
