import { execFile } from "node:child_process";
import * as path from "node:path";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const CLI_ENTRY = path.resolve(
  import.meta.dirname,
  "../../src/index.ts",
);

export function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      "npx",
      ["tsx", CLI_ENTRY, ...args],
      { timeout: 25_000 },
      (error, stdout, stderr) => {
        let exitCode = 0;
        if (error) {
          // execFile puts numeric exit code in error.code
          exitCode = typeof error.code === "number" ? error.code : 1;
        }
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode,
        });
      },
    );
  });
}
