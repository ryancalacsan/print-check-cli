import pc from "picocolors";
import type { CheckResult } from "../types.js";

const STATUS_ICON: Record<string, string> = {
  pass: pc.green("✓"),
  warn: pc.yellow("⚠"),
  fail: pc.red("✗"),
};

const STATUS_COLOR: Record<string, (s: string) => string> = {
  pass: pc.green,
  warn: pc.yellow,
  fail: pc.red,
};

export function printReport(
  fileName: string,
  results: CheckResult[],
  verbose: boolean,
): void {
  console.log();
  console.log(` ${pc.bold("print-check results:")} ${fileName}`);
  console.log(pc.dim("─".repeat(45)));

  for (const result of results) {
    const icon = STATUS_ICON[result.status];
    const color = STATUS_COLOR[result.status];
    const checkName = result.check.padEnd(16);
    console.log(` ${icon} ${pc.bold(checkName)} ${color(result.summary)}`);

    if (verbose && result.details.length > 0) {
      for (const detail of result.details) {
        const detailIcon = STATUS_ICON[detail.status];
        const pagePrefix = detail.page ? `Page ${detail.page}: ` : "";
        console.log(`     ${detailIcon} ${pc.dim(pagePrefix)}${detail.message}`);
      }
    }
  }

  console.log(pc.dim("─".repeat(45)));

  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  const parts: string[] = [];
  if (passed > 0) parts.push(pc.green(`${passed} passed`));
  if (warned > 0) parts.push(pc.yellow(`${warned} warned`));
  if (failed > 0) parts.push(pc.red(`${failed} failed`));

  console.log(` ${parts.join(pc.dim(" · "))}`);
  console.log();
}
