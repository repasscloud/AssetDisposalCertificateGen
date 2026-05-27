import { PDFDocument } from "pdf-lib";

/**
 * Wraps a pre-rendered PNG image into a single-page PDF sized to match the
 * image's natural pixel dimensions (1 px → 1 pt).  The result is a
 * standalone, print-ready certificate PDF.
 *
 * @param pngBytes - Raw PNG file bytes (Uint8Array from svgToPng).
 * @param title    - Optional PDF document title metadata.
 * @returns        - PDF bytes as a Uint8Array.
 */
export async function generateCertificatePdf(
  pngBytes: Uint8Array,
  title = "Asset Disposal & Data Sanitisation Certificate"
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  /* Embed the PNG and obtain its natural pixel dimensions */
  const img = await doc.embedPng(pngBytes);
  const { width: imgW, height: imgH } = img;

  /*
   * Scale to a target page width of 841.89 pt (A4 landscape).
   * This gives a nicely-sized PDF that prints cleanly on A4 paper.
   * Height is proportional to preserve the certificate's aspect ratio.
   */
  const TARGET_W = 841.89;
  const scale = TARGET_W / imgW;
  const pageW = TARGET_W;
  const pageH = Math.round(imgH * scale * 100) / 100; // round to 2 dp

  const page = doc.addPage([pageW, pageH]);
  page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });

  /* PDF metadata */
  doc.setTitle(title);
  doc.setProducer("Asset Disposal Certificate Generator");

  return doc.save();
}
