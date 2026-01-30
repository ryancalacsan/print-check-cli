import type { PdfEngines } from "./engine/pdf-engine.js";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckDetail {
  page?: number;
  message: string;
  status: CheckStatus;
}

export interface CheckResult {
  check: string;
  status: CheckStatus;
  summary: string;
  details: CheckDetail[];
}

export interface CheckOptions {
  minDpi: number;
  colorSpace: "cmyk" | "any";
  bleedMm: number;
  maxTac: number;
  pageSize?: string;
}

export type CheckFn = (
  engines: PdfEngines,
  options: CheckOptions,
) => Promise<CheckResult>;

export type OutputFormat = "text" | "json";

export interface JsonReport {
  file: string;
  results: CheckResult[];
  summary: {
    passed: number;
    warned: number;
    failed: number;
  };
}
