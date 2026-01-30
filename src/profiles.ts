import type { CheckOptions } from "./types.js";

export const PROFILE_NAMES = ["standard", "magazine", "newspaper", "large-format"] as const;

export type ProfileName = (typeof PROFILE_NAMES)[number];

export const PROFILES: Record<ProfileName, CheckOptions> = {
  standard: { minDpi: 300, colorSpace: "cmyk", bleedMm: 3, maxTac: 300, pageSize: undefined },
  magazine: { minDpi: 300, colorSpace: "cmyk", bleedMm: 5, maxTac: 300, pageSize: undefined },
  newspaper: { minDpi: 150, colorSpace: "any", bleedMm: 0, maxTac: 240, pageSize: undefined },
  "large-format": { minDpi: 150, colorSpace: "cmyk", bleedMm: 5, maxTac: 300, pageSize: undefined },
};
