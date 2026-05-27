import Papa from "papaparse";
import { normaliseRecord, detectPresentFields } from "./normaliseRecord.ts";
import { MANDATORY_FIELDS } from "../models/AssetDisposalRecord.ts";
import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";

export interface ParseCsvResult {
  records: Partial<AssetDisposalRecord>[];
  /** Missing mandatory headers detected at parse time. */
  missingHeaders: string[];
  /** Raw parse error (if PapaParse failed). */
  parseError?: string;
}

/**
 * Parses a CSV string into an array of partial AssetDisposalRecords.
 * - Trims header and value whitespace.
 * - Supports quoted fields and commas inside quotes.
 * - Reports missing required headers.
 */
export function parseCsv(csvText: string): ParseCsvResult {
  if (!csvText.trim()) {
    return { records: [], missingHeaders: [], parseError: "The file is empty." };
  }

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    return {
      records: [],
      missingHeaders: [],
      parseError: result.errors[0].message,
    };
  }

  // Detect which mandatory headers are present.
  const headers: string[] = result.meta.fields ?? [];
  const presentFields = detectPresentFields(headers);
  const missingHeaders: string[] = MANDATORY_FIELDS.filter(
    (f) => !presentFields.has(f as string)
  );

  const records = result.data.map((row) => normaliseRecord(row));

  return { records, missingHeaders };
}
