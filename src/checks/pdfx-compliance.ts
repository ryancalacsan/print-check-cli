import type { CheckFn, CheckResult, CheckDetail } from "../types.js";
import { safeGet, safeGetResolved, safeResolve, safeName, safeString } from "../engine/pdf-utils.js";

export const checkPdfxCompliance: CheckFn = async (engines, _options) => {
  const details: CheckDetail[] = [];
  const doc = engines.mupdf;
  const trailer = doc.getTrailer();

  // Traverse trailer → Root → OutputIntents
  const root = safeGetResolved(trailer, "Root");
  const outputIntents = safeGetResolved(root, "OutputIntents");

  let pdfxVersion: string | undefined;
  let pdfxCondition: string | undefined;

  // Check Info dict for GTS_PDFXVersion
  const infoDict = safeGetResolved(trailer, "Info");
  if (infoDict) {
    const versionStr = safeString(safeGet(infoDict, "GTS_PDFXVersion"));
    if (versionStr) {
      pdfxVersion = versionStr;
      details.push({
        message: `PDF/X version: ${versionStr}`,
        status: "pass",
      });
    }
  }

  // Process OutputIntents array
  if (outputIntents && outputIntents.isArray()) {
    const len = outputIntents.length;
    for (let i = 0; i < len; i++) {
      const raw = outputIntents.get(i);
      const intent = raw && !raw.isNull() ? safeResolve(raw) : undefined;
      if (!intent) continue;

      const subtype = safeName(safeGet(intent, "S")) ?? "unknown";
      const conditionId = safeString(safeGet(intent, "OutputConditionIdentifier")) ?? "";
      const info = safeString(safeGet(intent, "Info"));
      const registryName = safeString(safeGet(intent, "RegistryName"));

      const isPdfx = subtype.startsWith("GTS_PDFX");

      const parts = [subtype];
      if (conditionId) parts.push(conditionId);
      if (info) parts.push(info);
      if (registryName) parts.push(registryName);

      const label = isPdfx ? "PDF/X OutputIntent" : "OutputIntent";
      details.push({
        message: `${label}: ${parts.join(" — ")}`,
        status: "pass",
      });

      if (isPdfx && conditionId) {
        pdfxCondition = conditionId;
      }
    }
  }

  // If nothing found at all
  if (details.length === 0) {
    return {
      check: "PDF/X Compliance",
      status: "pass",
      summary: "No PDF/X compliance detected",
      details: [{ message: "No PDF/X compliance detected", status: "pass" }],
    };
  }

  // Build summary
  let summary: string;
  if (pdfxVersion && pdfxCondition) {
    summary = `${pdfxVersion} (${pdfxCondition})`;
  } else if (pdfxVersion) {
    summary = pdfxVersion;
  } else if (pdfxCondition) {
    summary = `PDF/X (${pdfxCondition})`;
  } else {
    summary = "No PDF/X compliance detected";
  }

  return {
    check: "PDF/X Compliance",
    status: "pass",
    summary,
    details,
  };
};
