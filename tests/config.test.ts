import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// We need to test findConfigFile (not exported) and loadConfig (exported).
// Since findConfigFile is private, we test it indirectly through loadConfig,
// but we also import the module to test the schema validation path.
import { loadConfig, ConfigSchema } from "../src/config.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "printcheck-config-test-"));
}

describe("ConfigSchema", () => {
  it("should accept a valid full config", () => {
    const result = ConfigSchema.safeParse({
      minDpi: 300,
      colorSpace: "cmyk",
      bleed: 3,
      maxTac: 300,
      pageSize: "210x297",
      checks: "bleed,fonts",
      verbose: true,
      format: "json",
      profile: "standard",
      severity: { fonts: "warn", transparency: "off" },
    });
    expect(result.success).toBe(true);
  });

  it("should accept a partial config (only some fields)", () => {
    const result = ConfigSchema.safeParse({ minDpi: 150 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minDpi).toBe(150);
      expect(result.data.colorSpace).toBeUndefined();
    }
  });

  it("should accept an empty config", () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject invalid minDpi (string)", () => {
    const result = ConfigSchema.safeParse({ minDpi: "not a number" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid colorSpace value", () => {
    const result = ConfigSchema.safeParse({ colorSpace: "rgb" });
    expect(result.success).toBe(false);
  });

  it("should reject negative bleed", () => {
    const result = ConfigSchema.safeParse({ bleed: -1 });
    expect(result.success).toBe(false);
  });

  it("should reject invalid format", () => {
    const result = ConfigSchema.safeParse({ format: "xml" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid profile name", () => {
    const result = ConfigSchema.safeParse({ profile: "nonexistent" });
    expect(result.success).toBe(false);
  });
});

describe("loadConfig", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return null when no config file exists", async () => {
    process.chdir(tmpDir);
    const result = await loadConfig();
    expect(result).toBeNull();
  });

  it("should find .printcheckrc in current directory", async () => {
    const configPath = path.join(tmpDir, ".printcheckrc");
    fs.writeFileSync(configPath, JSON.stringify({ minDpi: 150 }));
    process.chdir(tmpDir);

    const result = await loadConfig();
    expect(result).not.toBeNull();
    expect(result!.options.minDpi).toBe(150);
    expect(fs.realpathSync(result!.filePath)).toBe(fs.realpathSync(configPath));
  });

  it("should find .printcheckrc.json when .printcheckrc is missing", async () => {
    const configPath = path.join(tmpDir, ".printcheckrc.json");
    fs.writeFileSync(configPath, JSON.stringify({ colorSpace: "any" }));
    process.chdir(tmpDir);

    const result = await loadConfig();
    expect(result).not.toBeNull();
    expect(result!.options.colorSpace).toBe("any");
    expect(fs.realpathSync(result!.filePath)).toBe(fs.realpathSync(configPath));
  });

  it("should prefer .printcheckrc over .printcheckrc.json", async () => {
    fs.writeFileSync(path.join(tmpDir, ".printcheckrc"), JSON.stringify({ minDpi: 100 }));
    fs.writeFileSync(path.join(tmpDir, ".printcheckrc.json"), JSON.stringify({ minDpi: 200 }));
    process.chdir(tmpDir);

    const result = await loadConfig();
    expect(result).not.toBeNull();
    expect(result!.options.minDpi).toBe(100);
  });

  it("should find printcheck.config.js (JS module)", async () => {
    const configPath = path.join(tmpDir, "printcheck.config.js");
    fs.writeFileSync(configPath, "export default { maxTac: 280 };");
    process.chdir(tmpDir);

    const result = await loadConfig();
    expect(result).not.toBeNull();
    expect(result!.options.maxTac).toBe(280);
    expect(fs.realpathSync(result!.filePath)).toBe(fs.realpathSync(configPath));
  });

  it("should walk up directory tree to find config in parent", async () => {
    // Create config in tmpDir (parent)
    fs.writeFileSync(path.join(tmpDir, ".printcheckrc"), JSON.stringify({ bleed: 5 }));
    // Create a child directory and chdir into it
    const childDir = path.join(tmpDir, "subdir");
    fs.mkdirSync(childDir);
    process.chdir(childDir);

    const result = await loadConfig();
    expect(result).not.toBeNull();
    expect(result!.options.bleed).toBe(5);
  });

  it("should load partial config (only some fields)", async () => {
    fs.writeFileSync(path.join(tmpDir, ".printcheckrc"), JSON.stringify({ verbose: true }));
    process.chdir(tmpDir);

    const result = await loadConfig();
    expect(result).not.toBeNull();
    expect(result!.options.verbose).toBe(true);
    expect(result!.options.minDpi).toBeUndefined();
  });

  it("should exit with code 1 for invalid schema", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".printcheckrc"),
      JSON.stringify({ minDpi: "not a number" }),
    );
    process.chdir(tmpDir);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(loadConfig()).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should load config with severity overrides", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".printcheckrc"),
      JSON.stringify({ severity: { fonts: "warn", transparency: "off" } }),
    );
    process.chdir(tmpDir);

    const result = await loadConfig();
    expect(result).not.toBeNull();
    expect(result!.options.severity).toEqual({ fonts: "warn", transparency: "off" });
  });
});
