import { Command } from "commander";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  checkBleedTrim,
  checkFonts,
  checkColorSpace,
  checkResolution,
  checkPdfxCompliance,
  checkTac,
} from "./checks/index.js";
import { loadPdf } from "./engine/pdf-engine.js";
import { printReport } from "./reporter/console.js";
import { buildJsonReport } from "./reporter/json.js";
import { PROFILES, PROFILE_NAMES } from "./profiles.js";
import type { CheckFn, CheckOptions, JsonReport } from "./types.js";

const ALL_CHECKS: Record<string, CheckFn> = {
  bleed: checkBleedTrim,
  fonts: checkFonts,
  colorspace: checkColorSpace,
  resolution: checkResolution,
  pdfx: checkPdfxCompliance,
  tac: checkTac,
};

const OptionsSchema = z.object({
  minDpi: z.coerce.number().int().positive().optional(),
  colorSpace: z.enum(["cmyk", "any"]).optional(),
  bleed: z.coerce.number().nonnegative().optional(),
  maxTac: z.coerce.number().positive().optional(),
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
  .argument("<files...>", "PDF file(s) to check")
  .option("--min-dpi <number>", "Minimum acceptable DPI")
  .option("--color-space <mode>", "Expected color space: cmyk | any")
  .option("--bleed <mm>", "Required bleed in mm")
  .option("--max-tac <percent>", "Maximum total ink coverage %")
  .option("--checks <list>", "Comma-separated checks to run", "all")
  .option("--verbose", "Show detailed per-page results", false)
  .option("--format <type>", "Output format: text | json", "text")
  .option("--profile <name>", "Print profile: standard | magazine | newspaper | large-format")
  .action(async (files: string[], rawOpts: Record<string, unknown>) => {
    const parsed = OptionsSchema.safeParse(rawOpts);
    if (!parsed.success) {
      console.error("Invalid options:", parsed.error.format());
      process.exit(1);
    }

    const opts = parsed.data;

    const base = opts.profile ? PROFILES[opts.profile] : PROFILES.standard;
    const checkOptions: CheckOptions = {
      minDpi: opts.minDpi !== undefined ? opts.minDpi : base.minDpi,
      colorSpace: opts.colorSpace !== undefined ? opts.colorSpace : base.colorSpace,
      bleedMm: opts.bleed !== undefined ? opts.bleed : base.bleedMm,
      maxTac: opts.maxTac !== undefined ? opts.maxTac : base.maxTac,
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

    const allReports: JsonReport[] = [];
    let anyFail = false;

    for (const file of files) {
      const filePath = path.resolve(file);

      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        anyFail = true;
        continue;
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

      if (results.some((r) => r.status === "fail")) anyFail = true;

      if (opts.format === "json") {
        allReports.push(buildJsonReport(path.basename(filePath), results));
      } else {
        if (files.indexOf(file) > 0) {
          console.log();
        }
        printReport(path.basename(filePath), results, opts.verbose);
      }
    }

    if (opts.format === "json") {
      if (allReports.length === 1) {
        console.log(JSON.stringify(allReports[0], null, 2));
      } else {
        console.log(JSON.stringify(allReports, null, 2));
      }
    }

    process.exit(anyFail ? 1 : 0);
  });

program.parse();
