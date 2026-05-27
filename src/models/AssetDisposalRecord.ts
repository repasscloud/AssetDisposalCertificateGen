/**
 * Core data model for a single asset disposal & sanitisation record.
 *
 * Source fields come from the uploaded CSV or JSON.
 * Generated fields (certificateId, certificateFileName, evidenceHash) are
 * computed at runtime and are EXCLUDED from the SHA-256 evidence hash.
 */
export interface AssetDisposalRecord {
  // ----- Source evidence fields (included in SHA-256 hash) -----
  assetId: string;
  serialNumber: string;
  deviceType: string;
  makeModel: string;
  storageType: string;
  wipeMethod: string;
  wipeTool: string;
  wipeResult: string;
  wipeDate: string;
  wipedBy: string;
  verificationDate: string;
  verifiedBy: string;
  verificationStatus: string;
  disposalPath: string;
  disposalDate: string;
  disposalLocation: string;
  batchId: string;
  approvedBy: string;
  notes: string;

  // ----- Generated fields (excluded from SHA-256 hash) -----
  certificateId: string;
  certificateFileName: string;
  evidenceHash: string;
}

/** Fields that must be non-blank in a valid record. */
export const MANDATORY_FIELDS: ReadonlyArray<keyof AssetDisposalRecord> = [
  "assetId",
  "serialNumber",
  "deviceType",
  "makeModel",
  "storageType",
  "wipeMethod",
  "wipeTool",
  "wipeResult",
  "wipeDate",
  "wipedBy",
  "verificationDate",
  "verifiedBy",
  "verificationStatus",
  "disposalPath",
  "disposalDate",
  "disposalLocation",
  "approvedBy",
];

/** Fields that must contain a valid ISO yyyy-MM-dd date. */
export const DATE_FIELDS: ReadonlyArray<keyof AssetDisposalRecord> = [
  "wipeDate",
  "verificationDate",
  "disposalDate",
];

/** The canonical list of source fields included in the evidence hash. */
export const HASH_FIELDS: ReadonlyArray<keyof AssetDisposalRecord> = [
  "assetId",
  "serialNumber",
  "deviceType",
  "makeModel",
  "storageType",
  "wipeMethod",
  "wipeTool",
  "wipeResult",
  "wipeDate",
  "wipedBy",
  "verificationDate",
  "verifiedBy",
  "verificationStatus",
  "disposalPath",
  "disposalDate",
  "disposalLocation",
  "batchId",
  "approvedBy",
  "notes",
];
