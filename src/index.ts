import { Command } from "commander";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  checkBleedTrim,
  checkFonts,
  checkColorSpace,
  checkResolution,
} from "./checks/index.js";
import { loadPdf } from "./engine/pdf-engine.js";
import { printReport } from "./reporter/console.js";
import { printJsonReport } from "./reporter/json.js";
import type { CheckFn, CheckOptions } from "./types.js";

const ALL_CHECKS: Record<string, CheckFn> = {
  bleed: checkBleedTrim,
  fonts: checkFonts,
  colorspace: checkColorSpace,
  resolution: checkResolution,
};

const OptionsSchema = z.object({
  minDpi: z.coerce.number().int().positive().default(300),
  colorSpace: z.enum(["cmyk", "any"]).default("cmyk"),
  bleed: z.coerce.number().nonnegative().default(3),
  checks: z
    .string()
    .default("all")
    .transform((val) => (val === "all" ? Object.keys(ALL_CHECKS) : val.split(",").map((s) => s.trim()))),
  verbose: z.boolean().default(false),
  format: z.enum(["text", "json"]).default("text"),
});

const program = new Command();

program
  .name("print-check")
  .description("Validate print-ready PDF files")
  .version("1.0.0")
  .argument("<file>", "PDF file to check")
  .option("--min-dpi <number>", "Minimum acceptable DPI", "300")
  .option("--color-space <mode>", "Expected color space: cmyk | any", "cmyk")
  .option("--bleed <mm>", "Required bleed in mm", "3")
  .option("--checks <list>", "Comma-separated checks to run", "all")
  .option("--verbose", "Show detailed per-page results", false)
  .option("--format <type>", "Output format: text | json", "text")
  .action(async (file: string, rawOpts: Record<string, unknown>) => {
    const parsed = OptionsSchema.safeParse(rawOpts);
    if (!parsed.success) {
      console.error("Invalid options:", parsed.error.format());
      process.exit(1);
    }

    const opts = parsed.data;
    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    const checkOptions: CheckOptions = {
      minDpi: opts.minDpi,
      colorSpace: opts.colorSpace,
      bleedMm: opts.bleed,
    };

    const checksToRun = opts.checks.filter((name) => {
      if (!ALL_CHECKS[name]) {
        console.warn(`Unknown check: "${name}" (skipping)`);
        return false;
      }
      return true;
    });

    if (checksToRun.length === 0) {
      console.error("No valid checks to run.");
      process.exit(1);
    }

    const engines = await loadPdf(filePath);

    const results = [];
    for (const name of checksToRun) {
      try {
        const result = await ALL_CHECKS[name](engines, checkOptions);
        results.push(result);
      } catch (err) {
        results.push({
          check: name,
          status: "fail" as const,
          summary: `Error: ${err instanceof Error ? err.message : String(err)}`,
          details: [],
        });
      }
    }

    if (opts.format === "json") {
      printJsonReport(path.basename(filePath), results);
    } else {
      printReport(path.basename(filePath), results, opts.verbose);
    }

    const hasFail = results.some((r) => r.status === "fail");
    process.exit(hasFail ? 1 : 0);
  });

program.parse();
