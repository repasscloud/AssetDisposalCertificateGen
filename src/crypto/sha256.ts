/**
 * Computes the SHA-256 hash of a UTF-8 string using the browser SubtleCrypto API.
 * Returns an uppercase hexadecimal string (64 characters).
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Computes the SHA-256 hash of a File's binary contents.
 * Used for the input-file hash stored in the manifest.
 */
export async function sha256HexOfFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
