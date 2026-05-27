import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";
import { MANDATORY_FIELDS, DATE_FIELDS } from "../models/AssetDisposalRecord.ts";
import type { ValidationResult, ValidationIssue } from "../models/ValidationResult.ts";
import { isIsoDate, daysBetween } from "../utils/dates.ts";

/** Characters that are all invalid in a filename (after sanitisation). */
const ALL_INVALID_CHARS_RE = /^[<>:"/\\|?*\x00-\x1f\s_]+$/;

/** Generic-sounding disposal locations that warrant a warning. */
const GENERIC_LOCATIONS = [
  "unknown",
  "n/a",
  "na",
  "none",
  "tbd",
  "to be determined",
  "various",
  "local",
];

function warn(
  assetId: string,
  rowIndex: number,
  field: string,
  message: string
): ValidationIssue {
  return { assetId, rowIndex, field, message };
}

function err(
  assetId: string,
  rowIndex: number,
  field: string,
  message: string
): ValidationIssue {
  return { assetId, rowIndex, field, message };
}

/**
 * Validates a batch of partially-constructed asset records.
 *
 * This is called BEFORE hash/certificate fields are generated.
 * It returns a ValidationResult with errors and warnings.
 * `isValid` is true iff `errors` is empty.
 */
export function validateAssets(
  partials: Partial<AssetDisposalRecord>[]
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const seenAssetIds = new Map<string, number>(); // assetId → first row index

  for (let i = 0; i < partials.length; i++) {
    const r = partials[i] as Record<string, string>;
    const rawId: string = (r["assetId"] ?? "").trim();
    const label = rawId || `(row ${i + 1})`;

    /* ----------------------------------------------------------------
       1. Required fields must not be blank.
    ---------------------------------------------------------------- */
    for (const field of MANDATORY_FIELDS) {
      const value = r[field as string] ?? "";
      if (!value.trim()) {
        errors.push(
          err(label, i, field as string, `Required field "${field}" is blank.`)
        );
      }
    }

    /* ----------------------------------------------------------------
       2. Duplicate AssetId.
    ---------------------------------------------------------------- */
    if (rawId) {
      const idLower = rawId.toLowerCase();
      if (seenAssetIds.has(idLower)) {
        const firstRow = seenAssetIds.get(idLower)!;
        errors.push(
          err(
            label,
            i,
            "assetId",
            `Duplicate AssetId "${rawId}" — also seen at row ${firstRow + 1}.`
          )
        );
      } else {
        seenAssetIds.set(idLower, i);
      }
    }

    /* ----------------------------------------------------------------
       3. AssetId must contain at least one valid filename character.
    ---------------------------------------------------------------- */
    if (rawId && ALL_INVALID_CHARS_RE.test(rawId)) {
      errors.push(
        err(
          label,
          i,
          "assetId",
          `AssetId "${rawId}" contains only invalid filename characters.`
        )
      );
    }

    /* ----------------------------------------------------------------
       4. Date fields must be valid ISO yyyy-MM-dd.
    ---------------------------------------------------------------- */
    for (const dateField of DATE_FIELDS) {
      const val = r[dateField as string] ?? "";
      if (val && !isIsoDate(val)) {
        errors.push(
          err(
            label,
            i,
            dateField as string,
            `"${dateField}" value "${val}" is not a valid ISO date. Use yyyy-MM-dd (e.g. 2026-05-27).`
          )
        );
      }
    }

    /* ----------------------------------------------------------------
       5. Date order checks.
    ---------------------------------------------------------------- */
    const wipeDate = r["wipeDate"] ?? "";
    const verifDate = r["verificationDate"] ?? "";
    const disposalDate = r["disposalDate"] ?? "";

    if (wipeDate && verifDate && isIsoDate(wipeDate) && isIsoDate(verifDate)) {
      if (wipeDate > verifDate) {
        errors.push(
          err(
            label,
            i,
            "wipeDate",
            `WipeDate (${wipeDate}) cannot be after VerificationDate (${verifDate}).`
          )
        );
      }
    }
    if (verifDate && disposalDate && isIsoDate(verifDate) && isIsoDate(disposalDate)) {
      if (verifDate > disposalDate) {
        errors.push(
          err(
            label,
            i,
            "verificationDate",
            `VerificationDate (${verifDate}) cannot be after DisposalDate (${disposalDate}).`
          )
        );
      }
    }

    /* ----------------------------------------------------------------
       6. WipeResult must be "Successful".
    ---------------------------------------------------------------- */
    const wipeResult = (r["wipeResult"] ?? "").trim();
    if (wipeResult && wipeResult.toLowerCase() !== "successful") {
      errors.push(
        err(
          label,
          i,
          "wipeResult",
          `WipeResult "${wipeResult}" is not acceptable. Expected: "Successful".`
        )
      );
    }

    /* ----------------------------------------------------------------
       7. VerificationStatus must be "Verified".
    ---------------------------------------------------------------- */
    const verifStatus = (r["verificationStatus"] ?? "").trim();
    if (verifStatus && verifStatus.toLowerCase() !== "verified") {
      errors.push(
        err(
          label,
          i,
          "verificationStatus",
          `VerificationStatus "${verifStatus}" is not acceptable. Expected: "Verified".`
        )
      );
    }

    /* ================================================================
       WARNINGS
    ================================================================ */

    /* W1. BatchId is blank. */
    if (!(r["batchId"] ?? "").trim()) {
      warnings.push(
        warn(label, i, "batchId", "BatchId is blank — the export batch ID will be used.")
      );
    }

    /* W2. Notes is blank. */
    if (!(r["notes"] ?? "").trim()) {
      warnings.push(
        warn(label, i, "notes", "Notes field is blank.")
      );
    }

    /* W3. DisposalLocation appears generic. */
    const disposalLoc = (r["disposalLocation"] ?? "").trim().toLowerCase();
    if (
      disposalLoc &&
      GENERIC_LOCATIONS.some((g) => disposalLoc === g || disposalLoc.startsWith(g + " "))
    ) {
      warnings.push(
        warn(
          label,
          i,
          "disposalLocation",
          `DisposalLocation "${r["disposalLocation"]}" appears generic — consider a specific vendor or site.`
        )
      );
    }

    /* W4. WipeTool is very short or vague. */
    const wipeTool = (r["wipeTool"] ?? "").trim();
    if (wipeTool && wipeTool.length < 6) {
      warnings.push(
        warn(label, i, "wipeTool", `WipeTool "${wipeTool}" is very short — consider adding more detail.`)
      );
    }

    /* W5. ApprovedBy matches WipedBy. */
    const approvedBy = (r["approvedBy"] ?? "").trim().toLowerCase();
    const wipedBy = (r["wipedBy"] ?? "").trim().toLowerCase();
    if (approvedBy && wipedBy && approvedBy === wipedBy) {
      warnings.push(
        warn(
          label,
          i,
          "approvedBy",
          "ApprovedBy and WipedBy are the same person — consider independent approval."
        )
      );
    }

    /* W6. VerifiedBy matches WipedBy. */
    const verifiedBy = (r["verifiedBy"] ?? "").trim().toLowerCase();
    if (verifiedBy && wipedBy && verifiedBy === wipedBy) {
      warnings.push(
        warn(
          label,
          i,
          "verifiedBy",
          "VerifiedBy and WipedBy are the same person — independent verification is recommended."
        )
      );
    }

    /* W7. DisposalDate is more than 30 days after VerificationDate. */
    if (verifDate && disposalDate && isIsoDate(verifDate) && isIsoDate(disposalDate)) {
      const gap = daysBetween(verifDate, disposalDate);
      if (gap > 30) {
        warnings.push(
          warn(
            label,
            i,
            "disposalDate",
            `DisposalDate is ${Math.round(gap)} days after VerificationDate — this is more than 30 days.`
          )
        );
      }
    }
  }

  /* ----------------------------------------------------------------
     W_BATCH. Mixed / multiple batch IDs.
  ---------------------------------------------------------------- */
  const batchIds = new Set(
    partials
      .map((p) => ((p as Record<string, string>)["batchId"] ?? "").trim())
      .filter(Boolean)
  );
  if (batchIds.size > 1) {
    warnings.push({
      assetId: "(batch)",
      rowIndex: -1,
      field: "batchId",
      message: `Multiple different BatchIds detected (${batchIds.size} distinct values). The export will use a generated batch ID for blank records.`,
    });
  }

  return { errors, warnings, isValid: errors.length === 0 };
}
