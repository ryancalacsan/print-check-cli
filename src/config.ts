import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { PROFILE_NAMES } from "./profiles.js";

export const ConfigSchema = z.object({
  minDpi: z.number().int().positive().optional(),
  colorSpace: z.enum(["cmyk", "any"]).optional(),
  bleed: z.number().nonnegative().optional(),
  maxTac: z.number().positive().optional(),
  pageSize: z.string().optional(),
  checks: z.string().optional(),
  verbose: z.boolean().optional(),
  format: z.enum(["text", "json"]).optional(),
  profile: z.enum(PROFILE_NAMES).optional(),
  severity: z.record(z.string(), z.enum(["fail", "warn", "off"])).optional(),
});

export type ConfigFileResult = {
  options: z.infer<typeof ConfigSchema>;
  filePath: string;
};

const CONFIG_FILES = [
  ".printcheckrc",
  ".printcheckrc.json",
  "printcheck.config.js",
] as const;

function findConfigFile(startDir: string): string | null {
  let dir = path.resolve(startDir);

  while (true) {
    for (const name of CONFIG_FILES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export async function loadConfig(): Promise<ConfigFileResult | null> {
  const filePath = findConfigFile(process.cwd());
  if (!filePath) return null;

  const ext = path.extname(filePath);
  let raw: unknown;

  if (ext === ".js") {
    const module = await import(pathToFileURL(filePath).href);
    raw = module.default;
  } else {
    const content = fs.readFileSync(filePath, "utf-8");
    raw = JSON.parse(content);
  }

  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`Invalid config file (${filePath}):`, parsed.error.format());
    process.exit(1);
  }

  return { options: parsed.data, filePath };
}
