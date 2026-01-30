import type { PDFObject } from "mupdf";

/** Safely resolve a PDFObject, returning undefined if null/invalid */
export function safeResolve(obj: PDFObject | undefined): PDFObject | undefined {
  if (!obj || obj.isNull()) return undefined;
  return obj.resolve();
}

/** Safely get a key from a PDFObject, returning undefined if null */
export function safeGet(
  obj: PDFObject | undefined,
  key: string,
): PDFObject | undefined {
  if (!obj || obj.isNull()) return undefined;
  const val = obj.get(key);
  if (!val || val.isNull()) return undefined;
  return val;
}

/** Safely get and resolve a key from a PDFObject */
export function safeGetResolved(
  obj: PDFObject | undefined,
  key: string,
): PDFObject | undefined {
  const val = safeGet(obj, key);
  return val ? safeResolve(val) : undefined;
}

/** Safe name extraction */
export function safeName(obj: PDFObject | undefined): string | undefined {
  if (!obj || obj.isNull()) return undefined;
  if (obj.isName()) return obj.asName();
  return undefined;
}

/** Safe number extraction */
export function safeNumber(obj: PDFObject | undefined): number | undefined {
  if (!obj || obj.isNull()) return undefined;
  if (obj.isNumber()) return obj.asNumber();
  return undefined;
}

/** Safe forEach that handles null objects */
export function safeForEach(
  obj: PDFObject | undefined,
  callback: (value: PDFObject, key: string) => void,
): void {
  if (!obj || obj.isNull()) return;
  obj.forEach(callback);
}
