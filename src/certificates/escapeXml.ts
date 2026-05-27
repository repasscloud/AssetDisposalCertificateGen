/**
 * Escapes characters that are invalid inside XML/SVG text content.
 * Covers the five predefined XML entities:
 *   & → &amp;   < → &lt;   > → &gt;   " → &quot;   ' → &apos;
 *
 * Must be applied to every user-supplied value inserted into SVG output.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
