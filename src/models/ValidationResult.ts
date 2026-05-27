/** A single validation issue attached to a specific record and field. */
export interface ValidationIssue {
  assetId: string;
  /** Row index (0-based) — useful when assetId is blank or duplicated. */
  rowIndex: number;
  field: string;
  message: string;
}

/** Aggregated result of validating a full batch of asset records. */
export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];

  /** True when there are zero errors (warnings do not block generation). */
  isValid: boolean;
}
