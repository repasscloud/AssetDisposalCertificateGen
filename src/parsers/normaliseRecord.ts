import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";

/**
 * Canonical property name → list of accepted input keys (case-insensitive).
 * Supports both PascalCase and camelCase variants.
 */
const KEY_MAP: Record<keyof Omit<AssetDisposalRecord, "certificateId" | "certificateFileName" | "evidenceHash">, string[]> = {
  assetId:            ["assetid", "asset_id"],
  serialNumber:       ["serialnumber", "serial_number"],
  deviceType:         ["devicetype", "device_type"],
  makeModel:          ["makemodel", "make_model", "makeanDmodel"],
  storageType:        ["storagetype", "storage_type"],
  wipeMethod:         ["wipemethod", "wipe_method"],
  wipeTool:           ["wipetool", "wipe_tool"],
  wipeResult:         ["wiperesult", "wipe_result"],
  wipeDate:           ["wipedate", "wipe_date"],
  wipedBy:            ["wipedby", "wiped_by"],
  verificationDate:   ["verificationdate", "verification_date"],
  verifiedBy:         ["verifiedby", "verified_by"],
  verificationStatus: ["verificationstatus", "verification_status"],
  disposalPath:       ["disposalpath", "disposal_path"],
  disposalDate:       ["disposaldate", "disposal_date"],
  disposalLocation:   ["disposallocation", "disposal_location"],
  batchId:            ["batchid", "batch_id"],
  approvedBy:         ["approvedby", "approved_by"],
  notes:              ["notes"],
};

/**
 * Builds a lookup from lower-cased input key → canonical property name.
 */
const INPUT_KEY_LOOKUP: Map<string, keyof typeof KEY_MAP> = new Map();
for (const [canonical, aliases] of Object.entries(KEY_MAP)) {
  // Also accept the canonical key itself (camelCase lowercased)
  INPUT_KEY_LOOKUP.set(canonical.toLowerCase(), canonical as keyof typeof KEY_MAP);
  for (const alias of aliases) {
    INPUT_KEY_LOOKUP.set(alias.toLowerCase(), canonical as keyof typeof KEY_MAP);
  }
}

/**
 * Normalises a raw key-value object (from CSV header or JSON property) into
 * a partial AssetDisposalRecord. Unknown keys are ignored.
 * All values are trimmed strings.
 */
export function normaliseRecord(raw: Record<string, unknown>): Partial<AssetDisposalRecord> {
  const result: Partial<AssetDisposalRecord> = {};

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const canonical = INPUT_KEY_LOOKUP.get(rawKey.trim().toLowerCase());
    if (!canonical) continue;
    const strVal = String(rawValue ?? "").trim();
    (result as Record<string, string>)[canonical] = strVal;
  }

  // Ensure optional fields default to empty string.
  if (result.batchId === undefined) result.batchId = "";
  if (result.notes === undefined) result.notes = "";

  return result;
}

/**
 * Returns the set of canonical property names that are present in
 * the header/key list. Used for header validation.
 */
export function detectPresentFields(headers: string[]): Set<string> {
  const found = new Set<string>();
  for (const h of headers) {
    const canonical = INPUT_KEY_LOOKUP.get(h.trim().toLowerCase());
    if (canonical) found.add(canonical);
  }
  return found;
}
