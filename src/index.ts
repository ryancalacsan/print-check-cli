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
import { PROFILES, PROFILE_NAMES } from "./profiles.js";
import type { CheckFn, CheckOptions } from "./types.js";

const ALL_CHECKS: Record<string, CheckFn> = {
  bleed: checkBleedTrim,
  fonts: checkFonts,
  colorspace: checkColorSpace,
  resolution: checkResolution,
};

const OptionsSchema = z.object({
  minDpi: z.coerce.number().int().positive().optional(),
  colorSpace: z.enum(["cmyk", "any"]).optional(),
  bleed: z.coerce.number().nonnegative().optional(),
  checks: z
    .string()
    .default("all")
    .transform((val) => (val === "all" ? Object.keys(ALL_CHECKS) : val.split(",").map((s) => s.trim()))),
  verbose: z.boolean().default(false),
  format: z.enum(["text", "json"]).default("text"),
  profile: z.enum(PROFILE_NAMES).optional(),
});

const program = new Command();

program
  .name("print-check")
  .description("Validate print-ready PDF files")
  .version("1.0.0")
  .argument("<file>", "PDF file to check")
  .option("--min-dpi <number>", "Minimum acceptable DPI")
  .option("--color-space <mode>", "Expected color space: cmyk | any")
  .option("--bleed <mm>", "Required bleed in mm")
  .option("--checks <list>", "Comma-separated checks to run", "all")
  .option("--verbose", "Show detailed per-page results", false)
  .option("--format <type>", "Output format: text | json", "text")
  .option("--profile <name>", "Print profile: standard | magazine | newspaper | large-format")
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

    const base = opts.profile ? PROFILES[opts.profile] : PROFILES.standard;
    const checkOptions: CheckOptions = {
      minDpi: opts.minDpi !== undefined ? opts.minDpi : base.minDpi,
      colorSpace: opts.colorSpace !== undefined ? opts.colorSpace : base.colorSpace,
      bleedMm: opts.bleed !== undefined ? opts.bleed : base.bleedMm,
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
