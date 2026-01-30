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
}

export type CheckFn = (
  filePath: string,
  options: CheckOptions,
) => Promise<CheckResult>;
