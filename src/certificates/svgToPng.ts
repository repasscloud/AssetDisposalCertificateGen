/**
 * Converts an SVG string to a PNG Uint8Array using the browser Canvas API.
 *
 * The output pixel dimensions are the SVG's natural width/height, optionally
 * scaled by `scale` (default 1).  A scale of 2 gives a 2× retina-quality
 * image at twice the memory cost.
 */
export function svgToPng(svgString: string, scale = 1): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    /* ---- Parse SVG dimensions from the root element ---- */
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = svgDoc.documentElement;

    const parseErr = svgEl.querySelector("parsererror");
    if (parseErr) {
      reject(new Error("SVG parse error: " + parseErr.textContent));
      return;
    }

    const rawW = svgEl.getAttribute("width");
    const rawH = svgEl.getAttribute("height");
    const canvasW = Math.round((rawW ? parseFloat(rawW) : 1600) * scale);
    const canvasH = Math.round((rawH ? parseFloat(rawH) : 900) * scale);

    /* ---- Load SVG as an Image via Blob URL ---- */
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();

    img.onload = (): void => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2D canvas context"));
        return;
      }

      /* White background (SVG already has one but belt-and-braces) */
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, 0, 0, canvasW, canvasH);

      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) {
            reject(new Error("canvas.toBlob() returned null"));
            return;
          }
          pngBlob
            .arrayBuffer()
            .then((buf) => resolve(new Uint8Array(buf)))
            .catch(reject);
        },
        "image/png"
      );
    };

    img.onerror = (): void => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG into Image element"));
    };

    img.src = url;
  });
}
