/** Characters that are invalid in common file system names. */
const INVALID_CHARS_RE = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Sanitises a string for use as a file name (no extension).
 * - Replaces invalid characters with `_`.
 * - Trims leading/trailing whitespace and underscores.
 * - Collapses repeated underscores.
 * Returns `null` if the result is empty after sanitisation.
 */
export function sanitiseBaseName(value: string): string | null {
  const sanitised = value
    .trim()
    .replace(INVALID_CHARS_RE, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitised.length > 0 ? sanitised : null;
}

/**
 * Builds a unique, sanitised SVG certificate filename.
 * Tracks already-seen names to avoid collisions.
 *
 * @param assetId   Raw asset ID string.
 * @param rowIndex  0-based row index as fallback.
 * @param seen      Set of already-allocated base names (without extension).
 */
export function makeCertificateFileName(
  assetId: string,
  rowIndex: number,
  seen: Set<string>
): string {
  const base = sanitiseBaseName(assetId) ?? `unknown-asset-${rowIndex}`;

  if (!seen.has(base)) {
    seen.add(base);
    return `${base}.svg`;
  }

  // Append incrementing suffix until unique.
  let n = 2;
  while (seen.has(`${base}-${n}`)) n++;
  seen.add(`${base}-${n}`);
  return `${base}-${n}.svg`;
}
