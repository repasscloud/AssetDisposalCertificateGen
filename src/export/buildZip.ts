import JSZip from "jszip";
import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";
import type { ValidationResult } from "../models/ValidationResult.ts";
import { generateCertificateSvg } from "../certificates/generateCertificateSvg.ts";
import { svgToPng } from "../certificates/svgToPng.ts";
import { generateCertificatePdf } from "../certificates/generateCertificatePdf.ts";
import { generatePdfReport } from "../reports/generatePdfReport.ts";
import { buildManifest, buildValidationResults } from "./buildManifest.ts";

export interface BuildZipOptions {
  records: AssetDisposalRecord[];
  validationResult: ValidationResult;
  exportBatchId: string;
  inputFileName: string;
  inputFileSha256: string;
  inputFileContent: string; // original raw source text (CSV or JSON)
  generatedAt: string;
  onProgress?: (message: string) => void;
}

/**
 * Assembles the complete export ZIP archive in memory and returns
 * its contents as a Blob.
 *
 * ZIP structure:
 *   asset-disposal-report.pdf
 *   manifest.json
 *   validation-results.json
 *   source-data.{csv|json}
 *   certificates/
 *     ├── {AssetId}.svg
 *     ├── {AssetId}.pdf
 *     ├── {AssetId}.png
 *     └── …
 */
export async function buildZip(opts: BuildZipOptions): Promise<Blob> {
  const {
    records,
    validationResult,
    exportBatchId,
    inputFileName,
    inputFileSha256,
    inputFileContent,
    generatedAt,
    onProgress,
  } = opts;

  const zip = new JSZip();

  /* ---- 1. Certificates (SVG + PNG + PDF per asset) ---- */
  onProgress?.("Generating certificates…");
  const certFolder = zip.folder("certificates")!;
  // Process in small batches to keep the UI responsive
  const BATCH_SIZE = 10;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (record) => {
        const baseName = record.certificateFileName.replace(/\.svg$/i, "");

        // 1a. SVG — pure string, synchronous
        const svg = generateCertificateSvg(record, generatedAt);
        certFolder.file(record.certificateFileName, svg);

        // 1b. PNG — render SVG via browser Canvas API
        const pngBytes = await svgToPng(svg);
        certFolder.file(`${baseName}.png`, pngBytes);

        // 1c. PDF — wrap PNG in a single-page pdf-lib document
        const certPdfBytes = await generateCertificatePdf(
          pngBytes,
          `Certificate ${record.certificateId} — ${record.assetId}`
        );
        certFolder.file(`${baseName}.pdf`, certPdfBytes);
      })
    );

    // Yield to browser between batches
    await new Promise((r) => setTimeout(r, 0));
    onProgress?.(
      `Generating certificates… (${Math.min(i + BATCH_SIZE, records.length)}/${records.length})`
    );
  }

  /* ---- 2. PDF report ---- */
  onProgress?.("Generating PDF report…");
  await new Promise((r) => setTimeout(r, 0));
  const pdfBytes = await generatePdfReport(
    records,
    validationResult,
    exportBatchId,
    inputFileName,
    inputFileSha256,
    generatedAt
  );
  zip.file("asset-disposal-report.pdf", pdfBytes);

  /* ---- 3. Manifest ---- */
  onProgress?.("Building manifest…");
  const manifest = buildManifest(
    records,
    validationResult,
    exportBatchId,
    inputFileName,
    inputFileSha256,
    generatedAt
  );
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  /* ---- 4. Validation results ---- */
  const validationResults = buildValidationResults(validationResult);
  zip.file("validation-results.json", JSON.stringify(validationResults, null, 2));

  /* ---- 5. Original source file ---- */
  const isJson = inputFileName.toLowerCase().endsWith(".json");
  const sourceFileName = isJson ? "source-data.json" : "source-data.csv";
  zip.file(sourceFileName, inputFileContent);

  /* ---- 6. Compress and return ---- */
  onProgress?.("Compressing archive…");
  await new Promise((r) => setTimeout(r, 0));
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return blob;
}
