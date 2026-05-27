/** One entry in the manifest output array — one per asset. */
export interface ManifestEntry {
  assetId: string;
  serialNumber: string;
  certificateId: string;
  /** Path inside the ZIP to the SVG certificate. */
  certificateFile: string;
  /** Path inside the ZIP to the PDF certificate. */
  certificatePdfFile: string;
  /** Path inside the ZIP to the PNG certificate. */
  certificatePngFile: string;
  evidenceHash: string;
}

/** The top-level manifest.json structure. */
export interface ExportManifest {
  applicationName: string;
  exportBatchId: string;
  generatedAt: string;
  inputFileName: string;
  inputFileSha256: string;
  assetCount: number;
  validAssetCount: number;
  errorCount: number;
  warningCount: number;
  outputs: ManifestEntry[];
}
