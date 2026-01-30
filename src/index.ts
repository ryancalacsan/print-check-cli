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
  checkTransparency,
  checkPageSize,
} from "./checks/index.js";
import { loadPdf } from "./engine/pdf-engine.js";
import { printReport } from "./reporter/console.js";
import { buildJsonReport } from "./reporter/json.js";
import { PROFILES, PROFILE_NAMES } from "./profiles.js";
import { loadConfig } from "./config.js";
import type { CheckFn, CheckOptions, CheckResult, JsonReport, SeverityOverride } from "./types.js";

function parseSeverityString(val: string): Record<string, string> {
  if (!val.trim()) return {};
  const result: Record<string, string> = {};
  for (const pair of val.split(",")) {
    const [check, level] = pair.split(":").map((s) => s.trim());
    if (check && level) result[check] = level;
  }
  return result;
}

function applySeverityOverride(
  result: CheckResult,
  override: SeverityOverride | undefined,
): CheckResult {
  if (!override || override === "fail") return result;
  if (override === "warn" && result.status === "fail") {
    return {
      ...result,
      status: "warn",
      details: result.details.map((d) =>
        d.status === "fail" ? { ...d, status: "warn" as const } : d,
      ),
    };
  }
  return result;
}

const ALL_CHECKS: Record<string, CheckFn> = {
  bleed: checkBleedTrim,
  fonts: checkFonts,
  colorspace: checkColorSpace,
  resolution: checkResolution,
  pdfx: checkPdfxCompliance,
  tac: checkTac,
  transparency: checkTransparency,
  pagesize: checkPageSize,
};

const OptionsSchema = z.object({
  minDpi: z.coerce.number().int().positive().optional(),
  colorSpace: z.enum(["cmyk", "any"]).optional(),
  bleed: z.coerce.number().nonnegative().optional(),
  maxTac: z.coerce.number().positive().optional(),
  pageSize: z.string().optional(),
  checks: z
    .string()
    .default("all")
    .transform((val) => (val === "all" ? Object.keys(ALL_CHECKS) : val.split(",").map((s) => s.trim()))),
  verbose: z.boolean().default(false),
  format: z.enum(["text", "json"]).default("text"),
  profile: z.enum(PROFILE_NAMES).optional(),
  severity: z
    .union([z.string().transform(parseSeverityString), z.record(z.string(), z.enum(["fail", "warn", "off"]))])
    .default({}),
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
  .option("--page-size <WxH>", "Expected page size in mm (e.g. 210x297)")
  .option("--checks <list>", "Comma-separated checks to run", "all")
  .option("--verbose", "Show detailed per-page results", false)
  .option("--format <type>", "Output format: text | json", "text")
  .option("--profile <name>", "Print profile: standard | magazine | newspaper | large-format")
  .option("--severity <overrides>", "Per-check severity: check:level,... (fail|warn|off)")
  .action(async (files: string[], rawOpts: Record<string, unknown>) => {
    const config = await loadConfig();

    const stripped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawOpts)) {
      if (value !== undefined) stripped[key] = value;
    }

    const configSeverity = config?.options?.severity || {};
    const cliSeverity = typeof stripped.severity === "string"
      ? parseSeverityString(stripped.severity)
      : {};
    const mergedSeverity = { ...configSeverity, ...cliSeverity };

    const merged = {
      ...config?.options,
      ...stripped,
      severity: Object.keys(mergedSeverity).length > 0 ? mergedSeverity : undefined,
    };
    const parsed = OptionsSchema.safeParse(merged);
    if (!parsed.success) {
      console.error("Invalid options:", parsed.error.format());
      process.exit(1);
    }

    const opts = parsed.data;

    if (config && opts.verbose) {
      console.log(`Using config: ${config.filePath}`);
    }

    const base = opts.profile ? PROFILES[opts.profile] : PROFILES.standard;
    const checkOptions: CheckOptions = {
      minDpi: opts.minDpi !== undefined ? opts.minDpi : base.minDpi,
      colorSpace: opts.colorSpace !== undefined ? opts.colorSpace : base.colorSpace,
      bleedMm: opts.bleed !== undefined ? opts.bleed : base.bleedMm,
      maxTac: opts.maxTac !== undefined ? opts.maxTac : base.maxTac,
      pageSize: opts.pageSize !== undefined ? opts.pageSize : base.pageSize,
    };

    const checksToRun = opts.checks.filter((name) => {
      if (!ALL_CHECKS[name]) {
        console.warn(`Unknown check: "${name}" (skipping)`);
        return false;
      }
      if (opts.severity[name] === "off") return false;
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
          const raw = await ALL_CHECKS[name](engines, checkOptions);
          results.push(applySeverityOverride(raw, opts.severity[name]));
        } catch (err) {
          const raw = {
            check: name,
            status: "fail" as const,
            summary: `Error: ${err instanceof Error ? err.message : String(err)}`,
            details: [],
          };
          results.push(applySeverityOverride(raw, opts.severity[name]));
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
