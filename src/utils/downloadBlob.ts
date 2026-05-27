/**
 * Triggers a browser download of `blob` with the given `filename`.
 * Creates and immediately removes a temporary anchor element.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke shortly after to free memory.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
