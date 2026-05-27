import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";
import type { ValidationResult } from "../models/ValidationResult.ts";
import type { ExportManifest } from "../models/ExportManifest.ts";

/**
 * Builds the manifest.json object for the export package.
 */
export function buildManifest(
  records: AssetDisposalRecord[],
  validationResult: ValidationResult,
  exportBatchId: string,
  inputFileName: string,
  inputFileSha256: string,
  generatedAt: string
): ExportManifest {
  return {
    applicationName: "Asset Disposal Certificate Generator",
    exportBatchId,
    generatedAt,
    inputFileName,
    inputFileSha256,
    assetCount: records.length,
    validAssetCount: records.length, // all records reaching this point passed validation
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings.length,
    outputs: records.map((r) => {
      const baseName = r.certificateFileName.replace(/\.svg$/i, "");
      return {
        assetId: r.assetId,
        serialNumber: r.serialNumber,
        certificateId: r.certificateId,
        certificateFile: `certificates/${r.certificateFileName}`,
        certificatePdfFile: `certificates/${baseName}.pdf`,
        certificatePngFile: `certificates/${baseName}.png`,
        evidenceHash: r.evidenceHash,
      };
    }),
  };
}

/**
 * Builds the validation-results.json object for the export package.
 */
export function buildValidationResults(
  validationResult: ValidationResult
): object {
  return {
    errors: validationResult.errors.map((e) => ({
      assetId: e.assetId,
      field: e.field,
      message: e.message,
    })),
    warnings: validationResult.warnings.map((w) => ({
      assetId: w.assetId,
      field: w.field,
      message: w.message,
    })),
  };
}
