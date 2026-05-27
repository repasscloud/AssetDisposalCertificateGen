import { normaliseRecord } from "./normaliseRecord.ts";
import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";

export interface ParseJsonResult {
  records: Partial<AssetDisposalRecord>[];
  parseError?: string;
}

/**
 * Parses a JSON string (expected: array of objects) into partial AssetDisposalRecords.
 * Supports both PascalCase and camelCase property names.
 */
export function parseJson(jsonText: string): ParseJsonResult {
  if (!jsonText.trim()) {
    return { records: [], parseError: "The file is empty." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { records: [], parseError: `JSON parse error: ${msg}` };
  }

  if (!Array.isArray(parsed)) {
    return {
      records: [],
      parseError: "JSON input must be an array of asset objects (e.g. [ { ... }, ... ]).",
    };
  }

  if (parsed.length === 0) {
    return { records: [], parseError: "The JSON array is empty — no records found." };
  }

  const records = (parsed as Record<string, unknown>[]).map((item) =>
    normaliseRecord(item)
  );

  return { records };
}
