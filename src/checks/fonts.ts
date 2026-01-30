import type { CheckFn, CheckResult, CheckDetail } from "../types.js";
import {
  safeResolve,
  safeGet,
  safeGetResolved,
  safeName,
  safeForEach,
} from "../engine/pdf-utils.js";
import type { PDFObject } from "mupdf";

interface FontInfo {
  name: string;
  embedded: boolean;
  subset: boolean;
  page: number;
}

function collectFonts(
  fontDict: PDFObject,
  pageNum: number,
  seen: Set<string>,
): FontInfo[] {
  const fonts: FontInfo[] = [];

  safeForEach(fontDict, (value: PDFObject, key: string) => {
    const font = safeResolve(value);
    if (!font) return;

    const baseFontName = safeName(safeGet(font, "BaseFont")) ?? key;

    if (seen.has(baseFontName)) return;
    seen.add(baseFontName);

    const subtype = safeName(safeGet(font, "Subtype"));

    // CIDFont (Type0) — follow DescendantFonts
    if (subtype === "Type0") {
      const descendants = safeGet(font, "DescendantFonts");
      if (descendants) {
        for (let i = 0; i < descendants.length; i++) {
          const cidFont = safeResolve(descendants.get(i));
          if (!cidFont) continue;
          const cidName =
            safeName(safeGet(cidFont, "BaseFont")) ?? baseFontName;
          const descriptor = safeGetResolved(cidFont, "FontDescriptor");
          const embedded = hasEmbeddedFile(descriptor);
          const subset = /^[A-Z]{6}\+/.test(cidName);
          fonts.push({ name: cidName, embedded, subset, page: pageNum });
        }
      }
      return;
    }

    // Simple font — check FontDescriptor directly
    const descriptor = safeGetResolved(font, "FontDescriptor");
    const embedded = hasEmbeddedFile(descriptor);
    const subset = /^[A-Z]{6}\+/.test(baseFontName);
    fonts.push({ name: baseFontName, embedded, subset, page: pageNum });
  });

  return fonts;
}

function hasEmbeddedFile(descriptor: PDFObject | undefined): boolean {
  if (!descriptor) return false;
  return !!(
    safeGet(descriptor, "FontFile") ||
    safeGet(descriptor, "FontFile2") ||
    safeGet(descriptor, "FontFile3")
  );
}

export const checkFonts: CheckFn = async (engines) => {
  const { mupdf: doc } = engines;
  const details: CheckDetail[] = [];
  const seen = new Set<string>();
  const allFonts: FontInfo[] = [];

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageObj = doc.findPage(i);
    const resources = safeGetResolved(pageObj, "Resources");
    if (!resources) continue;

    const fontDict = safeGetResolved(resources, "Font");
    if (!fontDict) continue;

    const pageFonts = collectFonts(fontDict, i + 1, seen);
    allFonts.push(...pageFonts);
  }

  let worstStatus: CheckResult["status"] = "pass";
  const notEmbedded = allFonts.filter((f) => !f.embedded);
  const subsetOnly = allFonts.filter((f) => f.embedded && f.subset);

  for (const font of notEmbedded) {
    details.push({
      page: font.page,
      message: `Font "${font.name}" is not embedded`,
      status: "fail",
    });
    worstStatus = "fail";
  }

  for (const font of subsetOnly) {
    details.push({
      page: font.page,
      message: `Font "${font.name}" is subset-embedded`,
      status: "warn",
    });
    if (worstStatus === "pass") worstStatus = "warn";
  }

  for (const font of allFonts.filter((f) => f.embedded && !f.subset)) {
    details.push({
      page: font.page,
      message: `Font "${font.name}" is fully embedded`,
      status: "pass",
    });
  }

  const embeddedCount = allFonts.filter((f) => f.embedded).length;
  const subsetCount = subsetOnly.length;

  const summary =
    worstStatus === "fail"
      ? `${notEmbedded.length} font(s) not embedded`
      : `${embeddedCount} fonts embedded (${subsetCount} subset)`;

  return { check: "Fonts", status: worstStatus, summary, details };
};
