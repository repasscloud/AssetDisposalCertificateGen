import "./styles.css";

import type { AssetDisposalRecord } from "./models/AssetDisposalRecord.ts";
import type { ValidationResult } from "./models/ValidationResult.ts";
import { parseCsv } from "./parsers/parseCsv.ts";
import { parseJson } from "./parsers/parseJson.ts";
import { validateAssets } from "./validation/validateAssets.ts";
import { sha256Hex, sha256HexOfFile } from "./crypto/sha256.ts";
import { makeCertificateFileName } from "./utils/sanitiseFileName.ts";
import { formatDatetime, makeBatchId } from "./utils/dates.ts";
import { HASH_FIELDS } from "./models/AssetDisposalRecord.ts";
import { buildZip } from "./export/buildZip.ts";
import { downloadBlob } from "./utils/downloadBlob.ts";

/* ------------------------------------------------------------------ */
/* Sample data strings (for the "Download sample" buttons)            */
/* ------------------------------------------------------------------ */
const SAMPLE_CSV = `AssetId,SerialNumber,DeviceType,MakeModel,StorageType,WipeMethod,WipeTool,WipeResult,WipeDate,WipedBy,VerificationDate,VerifiedBy,VerificationStatus,DisposalPath,DisposalDate,DisposalLocation,BatchId,ApprovedBy,Notes
M005370,PF1YFKPN,Laptop,Lenovo ThinkPad P53s,SSD,NIST 800-88 Purge,Lenovo BIOS/UEFI Secure Erase + BitLocker key destruction,Successful,2026-05-27,Bob Marley,2026-05-27,Jordan Whitaker,Verified,E-waste recycling,2026-05-28,Local Asset Disposal Company,,Kate Winslet,No recoverable organisational data identified after verification. Device released for recycling after internal verification.
M005371,5CG1234XYZ,Desktop,HP EliteDesk 800 G5,HDD,DoD 5220.22-M (7-pass),Blancco Drive Eraser v7.4,Successful,2026-05-25,Maria Nguyen,2026-05-26,James Liu,Verified,E-waste recycling,2026-05-28,Local Asset Disposal Company,,Kate Winslet,Three-pass overwrite completed and verified. Hard drive verified as data-free before disposal.
M005372,4ZXCVBN7,Server,Dell PowerEdge R740,SSD,NIST 800-88 Purge,Dell OpenManage Secure Erase,Successful,2026-05-20,Alice Park,2026-05-21,Bob Chen,Verified,Certified hardware destruction,2026-05-27,SecureWipe Pty Ltd,DISP-20260520-090000,Kate Winslet,Server NVMe drives purged via Dell OpenManage. Physical destruction certificate received from SecureWipe Pty Ltd. All RAID volumes dismembered prior to disposal.
M005373,ABCD1234EF,Tablet,Microsoft Surface Pro 7,SSD,NIST 800-88 Purge,Microsoft Surface UEFI Reset + BitLocker destruction,Successful,2026-05-22,Bob Marley,2026-05-23,Jordan Whitaker,Verified,E-waste recycling,2026-05-28,Local Asset Disposal Company,,Kate Winslet,Factory reset performed after UEFI Secure Erase. BitLocker recovery key destroyed. No user data found post-verification.
M005374,XYZ9876543,All-in-One,Apple iMac 27-inch,SSD,Apple Erase All Content and Settings,Apple Configurator 2 + Erase All Content,Successful,2026-05-24,Maria Nguyen,2026-05-25,James Liu,Verified,E-waste recycling,2026-05-28,Local Asset Disposal Company,,Kate Winslet,Apple M1 iMac erased via Erase All Content and Settings. Verified by reboot showing Setup Assistant. iCloud account removed and activation lock disabled prior to disposal.
`;

const SAMPLE_JSON = JSON.stringify(
  [
    {
      assetId: "M005370",
      serialNumber: "PF1YFKPN",
      deviceType: "Laptop",
      makeModel: "Lenovo ThinkPad P53s",
      storageType: "SSD",
      wipeMethod: "NIST 800-88 Purge",
      wipeTool: "Lenovo BIOS/UEFI Secure Erase + BitLocker key destruction",
      wipeResult: "Successful",
      wipeDate: "2026-05-27",
      wipedBy: "Bob Marley",
      verificationDate: "2026-05-27",
      verifiedBy: "Jordan Whitaker",
      verificationStatus: "Verified",
      disposalPath: "E-waste recycling",
      disposalDate: "2026-05-28",
      disposalLocation: "Local Asset Disposal Company",
      batchId: "",
      approvedBy: "Kate Winslet",
      notes:
        "No recoverable organisational data identified after verification. Device released for recycling after internal verification.",
    },
    {
      assetId: "M005371",
      serialNumber: "5CG1234XYZ",
      deviceType: "Desktop",
      makeModel: "HP EliteDesk 800 G5",
      storageType: "HDD",
      wipeMethod: "DoD 5220.22-M (7-pass)",
      wipeTool: "Blancco Drive Eraser v7.4",
      wipeResult: "Successful",
      wipeDate: "2026-05-25",
      wipedBy: "Maria Nguyen",
      verificationDate: "2026-05-26",
      verifiedBy: "James Liu",
      verificationStatus: "Verified",
      disposalPath: "E-waste recycling",
      disposalDate: "2026-05-28",
      disposalLocation: "Local Asset Disposal Company",
      batchId: "",
      approvedBy: "Kate Winslet",
      notes:
        "Three-pass overwrite completed and verified. Hard drive verified as data-free before disposal.",
    },
    {
      assetId: "M005372",
      serialNumber: "4ZXCVBN7",
      deviceType: "Server",
      makeModel: "Dell PowerEdge R740",
      storageType: "SSD",
      wipeMethod: "NIST 800-88 Purge",
      wipeTool: "Dell OpenManage Secure Erase",
      wipeResult: "Successful",
      wipeDate: "2026-05-20",
      wipedBy: "Alice Park",
      verificationDate: "2026-05-21",
      verifiedBy: "Bob Chen",
      verificationStatus: "Verified",
      disposalPath: "Certified hardware destruction",
      disposalDate: "2026-05-27",
      disposalLocation: "SecureWipe Pty Ltd",
      batchId: "DISP-20260520-090000",
      approvedBy: "Kate Winslet",
      notes:
        "Server NVMe drives purged via Dell OpenManage. Physical destruction certificate received from SecureWipe Pty Ltd. All RAID volumes dismembered prior to disposal.",
    },
  ],
  null,
  2
);

/* ------------------------------------------------------------------ */
/* Application state                                                   */
/* ------------------------------------------------------------------ */
interface AppState {
  partials: Partial<AssetDisposalRecord>[];
  records: AssetDisposalRecord[];
  validationResult: ValidationResult | null;
  sourceFile: File | null;
  sourceContent: string;
  isGenerating: boolean;
}

const state: AppState = {
  partials: [],
  records: [],
  validationResult: null,
  sourceFile: null,
  sourceContent: "",
  isGenerating: false,
};

/* ------------------------------------------------------------------ */
/* DOM references                                                      */
/* ------------------------------------------------------------------ */
function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

const fileInput       = getEl<HTMLInputElement>("file-input");
const fileHint        = getEl<HTMLParagraphElement>("file-hint");
const uploadArea      = getEl<HTMLDivElement>("upload-area");
const validationSec   = getEl<HTMLElement>("validation-section");
const validationStats = getEl<HTMLDivElement>("validation-stats");
const validationMsgs  = getEl<HTMLDivElement>("validation-messages");
const previewSec      = getEl<HTMLElement>("preview-section");
const previewTbody    = getEl<HTMLTableSectionElement>("preview-tbody");
const previewNote     = getEl<HTMLSpanElement>("preview-note");
const btnGenerate     = getEl<HTMLButtonElement>("btn-generate");
const btnClear        = getEl<HTMLButtonElement>("btn-clear");
const generateHelp    = getEl<HTMLParagraphElement>("generate-help");
const progressSec     = getEl<HTMLDivElement>("progress-section");
const progressText    = getEl<HTMLParagraphElement>("progress-text");
const btnSampleCsv    = getEl<HTMLButtonElement>("btn-sample-csv");
const btnSampleJson   = getEl<HTMLButtonElement>("btn-sample-json");

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function show(el: HTMLElement): void { el.classList.remove("hidden"); }
function hide(el: HTMLElement): void { el.classList.add("hidden"); }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setProgress(msg: string): void {
  progressText.textContent = msg;
  show(progressSec);
}

function clearProgress(): void {
  hide(progressSec);
}

/* ------------------------------------------------------------------ */
/* Evidence hash computation                                           */
/* ------------------------------------------------------------------ */

/**
 * Builds the canonical JSON string used for SHA-256 hashing.
 * Only source evidence fields are included.
 */
function buildHashPayload(partial: Partial<AssetDisposalRecord>): string {
  const obj: Record<string, string> = {};
  for (const field of HASH_FIELDS) {
    obj[field as string] = ((partial as Record<string, string>)[field as string] ?? "").trim();
  }
  return JSON.stringify(obj);
}

/* ------------------------------------------------------------------ */
/* Process uploaded file                                               */
/* ------------------------------------------------------------------ */

async function processFile(file: File): Promise<void> {
  state.sourceFile = file;
  fileHint.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  setProgress("Reading file…");
  const text = await file.text();
  state.sourceContent = text;

  setProgress("Parsing…");
  await new Promise((r) => setTimeout(r, 0));

  let partials: Partial<AssetDisposalRecord>[] = [];
  let missingHeaders: string[] = [];
  let parseError: string | undefined;

  const isJson = file.name.toLowerCase().endsWith(".json");

  if (isJson) {
    const result = parseJson(text);
    partials = result.records;
    parseError = result.parseError;
  } else {
    const result = parseCsv(text);
    partials = result.records;
    missingHeaders = result.missingHeaders;
    parseError = result.parseError;
  }

  if (parseError) {
    showParseError(parseError);
    clearProgress();
    return;
  }

  if (partials.length === 0) {
    showParseError("No records found in the file.");
    clearProgress();
    return;
  }

  state.partials = partials;

  setProgress("Validating records…");
  await new Promise((r) => setTimeout(r, 0));

  // Inject missing header errors as validation errors
  const validationResult = validateAssets(partials);
  if (missingHeaders.length > 0) {
    for (const mh of missingHeaders) {
      validationResult.errors.unshift({
        assetId: "(header)",
        rowIndex: -1,
        field: mh,
        message: `Required column/property "${mh}" is missing from the input file.`,
      });
    }
    validationResult.isValid = validationResult.errors.length === 0;
  }

  state.validationResult = validationResult;

  showValidationSummary(validationResult, partials.length);
  showPreviewTable(partials, validationResult);

  clearProgress();
  updateGenerateButton(validationResult);
  show(btnClear);
}

/* ------------------------------------------------------------------ */
/* UI update functions                                                 */
/* ------------------------------------------------------------------ */

function showParseError(msg: string): void {
  show(validationSec);
  validationStats.innerHTML = `<span class="stat-chip error">⛔ Parse Error</span>`;
  validationMsgs.innerHTML = `<p style="color:var(--color-error);font-weight:600;font-size:.875rem;">
    ${escapeHtml(msg)}</p>`;
  hide(previewSec);
  updateGenerateButton(null);
  show(btnClear);
}

function showValidationSummary(
  vr: ValidationResult,
  totalRecords: number
): void {
  show(validationSec);

  // Re-set correctly
  validationStats.innerHTML = `
    <span class="stat-chip total">📋 ${totalRecords} Record${totalRecords !== 1 ? "s" : ""}</span>
    <span class="stat-chip ${vr.isValid ? "valid" : "error"}">
      ${vr.isValid ? "✅" : "⛔"} ${vr.isValid ? "All Valid" : `${vr.errors.length} Error${vr.errors.length !== 1 ? "s" : ""}`}
    </span>
    <span class="stat-chip warning">⚠ ${vr.warnings.length} Warning${vr.warnings.length !== 1 ? "s" : ""}</span>
    ${!vr.isValid ? `<span class="stat-chip error" style="font-style:italic;font-size:.8rem;">Fix errors before generating ZIP</span>` : ""}
  `;

  let html = "";

  if (vr.errors.length > 0) {
    html += `<div class="message-group errors">
      <div class="message-group-header">⛔ ${vr.errors.length} Error${vr.errors.length !== 1 ? "s" : ""} — generation blocked</div>
      <ul class="message-list">`;
    for (const e of vr.errors) {
      html += `<li>
        <span class="msg-asset">${escapeHtml(e.assetId)}</span>
        <span class="msg-field">${escapeHtml(e.field)}</span>
        ${escapeHtml(e.message)}
      </li>`;
    }
    html += `</ul></div>`;
  }

  if (vr.warnings.length > 0) {
    html += `<div class="message-group warnings">
      <div class="message-group-header">⚠ ${vr.warnings.length} Warning${vr.warnings.length !== 1 ? "s" : ""}</div>
      <ul class="message-list">`;
    for (const w of vr.warnings) {
      html += `<li>
        <span class="msg-asset">${escapeHtml(w.assetId)}</span>
        <span class="msg-field">${escapeHtml(w.field)}</span>
        ${escapeHtml(w.message)}
      </li>`;
    }
    html += `</ul></div>`;
  }

  if (vr.errors.length === 0 && vr.warnings.length === 0) {
    html = `<p style="color:var(--color-success);font-weight:500;font-size:.875rem;">✅ All records passed validation.</p>`;
  }

  validationMsgs.innerHTML = html;
}

function showPreviewTable(
  partials: Partial<AssetDisposalRecord>[],
  vr: ValidationResult
): void {
  show(previewSec);

  const MAX_PREVIEW = 100;
  const shown = partials.slice(0, MAX_PREVIEW);

  if (partials.length > MAX_PREVIEW) {
    previewNote.textContent = `Showing first ${MAX_PREVIEW} of ${partials.length} records.`;
  } else {
    previewNote.textContent = "";
  }

  // Build a set of row indices with errors and warnings for status badges
  const rowErrors = new Set<number>();
  const rowWarnings = new Set<number>();
  for (const e of vr.errors) if (e.rowIndex >= 0) rowErrors.add(e.rowIndex);
  for (const w of vr.warnings) if (w.rowIndex >= 0) rowWarnings.add(w.rowIndex);

  // Build a seen-names set to preview certificate filenames
  const seenNames = new Set<string>();
  const certFileNames: string[] = [];
  for (let i = 0; i < partials.length; i++) {
    const assetId = (partials[i] as Record<string, string>)["assetId"] ?? "";
    certFileNames.push(makeCertificateFileName(assetId, i, seenNames));
  }

  let html = "";
  for (let i = 0; i < shown.length; i++) {
    const r = shown[i] as Record<string, string>;
    const hasErr = rowErrors.has(i);
    const hasWarn = !hasErr && rowWarnings.has(i);
    const badgeClass = hasErr ? "badge-error" : hasWarn ? "badge-warning" : "badge-valid";
    const badgeLabel = hasErr ? "⛔ Error" : hasWarn ? "⚠ Warning" : "✅ Valid";

    html += `<tr>
      <td title="${escapeHtml(r["assetId"] ?? "")}">${escapeHtml(r["assetId"] ?? "—")}</td>
      <td title="${escapeHtml(r["serialNumber"] ?? "")}">${escapeHtml(r["serialNumber"] ?? "—")}</td>
      <td>${escapeHtml(r["deviceType"] ?? "—")}</td>
      <td title="${escapeHtml(r["makeModel"] ?? "")}">${escapeHtml(r["makeModel"] ?? "—")}</td>
      <td>${escapeHtml(r["wipeResult"] ?? "—")}</td>
      <td>${escapeHtml(r["verificationStatus"] ?? "—")}</td>
      <td>${escapeHtml(r["disposalDate"] ?? "—")}</td>
      <td title="${escapeHtml(certFileNames[i] ?? "")}">${escapeHtml(certFileNames[i] ?? "—")}</td>
      <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
    </tr>`;
  }
  previewTbody.innerHTML = html;
}

function updateGenerateButton(vr: ValidationResult | null): void {
  const canGenerate = vr !== null && vr.isValid && !state.isGenerating;
  btnGenerate.disabled = !canGenerate;
  btnGenerate.setAttribute("aria-disabled", canGenerate ? "false" : "true");

  if (vr !== null && !vr.isValid) {
    generateHelp.textContent = `Fix ${vr.errors.length} validation error${vr.errors.length !== 1 ? "s" : ""} before generating the ZIP.`;
    show(generateHelp);
  } else {
    hide(generateHelp);
  }
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */

function resetState(): void {
  state.partials = [];
  state.records = [];
  state.validationResult = null;
  state.sourceFile = null;
  state.sourceContent = "";
  state.isGenerating = false;

  fileInput.value = "";
  fileHint.textContent = "No file selected";
  previewTbody.innerHTML = "";
  validationStats.innerHTML = "";
  validationMsgs.innerHTML = "";

  hide(validationSec);
  hide(previewSec);
  hide(btnClear);
  hide(generateHelp);
  hide(progressSec);

  btnGenerate.disabled = true;
  btnGenerate.setAttribute("aria-disabled", "true");
}

/* ------------------------------------------------------------------ */
/* Generate ZIP                                                        */
/* ------------------------------------------------------------------ */

async function generateZip(): Promise<void> {
  if (state.isGenerating) return;
  const vr = state.validationResult;
  if (!vr || !vr.isValid) return;

  state.isGenerating = true;
  btnGenerate.disabled = true;

  try {
    const now = new Date();
    const generatedAt = formatDatetime(now);
    const exportBatchId = makeBatchId(now);

    setProgress("Computing evidence hashes…");
    await new Promise((r) => setTimeout(r, 0));

    // Compute file hash
    const inputFileSha256 = state.sourceFile
      ? await sha256HexOfFile(state.sourceFile)
      : await sha256Hex(state.sourceContent);

    // Resolve batch IDs and generate certificate metadata
    const seenNames = new Set<string>();
    const records: AssetDisposalRecord[] = [];

    // Compute hashes in parallel batches
    const HASH_BATCH = 50;
    for (let i = 0; i < state.partials.length; i += HASH_BATCH) {
      const batch = state.partials.slice(i, i + HASH_BATCH);
      const hashes = await Promise.all(
        batch.map((p) => sha256Hex(buildHashPayload(p)))
      );

      for (let j = 0; j < batch.length; j++) {
        const partial = batch[j] as Record<string, string>;
        const idx = i + j;
        const assetId = (partial["assetId"] ?? "").trim();
        const resolvedBatchId = partial["batchId"]?.trim() || exportBatchId;
        partial["batchId"] = resolvedBatchId;

        const certFileName = makeCertificateFileName(assetId, idx, seenNames);
        const certId = `CERT-${exportBatchId}-${assetId || `ROW${idx + 1}`}`;

        records.push({
          ...(partial as unknown as AssetDisposalRecord),
          batchId: resolvedBatchId,
          certificateId: certId,
          certificateFileName: certFileName,
          evidenceHash: hashes[j],
        });
      }

      setProgress(`Computing hashes… (${Math.min(i + HASH_BATCH, state.partials.length)}/${state.partials.length})`);
      await new Promise((r) => setTimeout(r, 0));
    }

    state.records = records;

    const zipBlob = await buildZip({
      records,
      validationResult: vr,
      exportBatchId,
      inputFileName: state.sourceFile?.name ?? "source-data",
      inputFileSha256,
      inputFileContent: state.sourceContent,
      generatedAt,
      onProgress: (msg) => setProgress(msg),
    });

    setProgress("Preparing download…");
    await new Promise((r) => setTimeout(r, 0));

    const zipFileName = `asset-disposal-export-${exportBatchId}.zip`;
    downloadBlob(zipBlob, zipFileName);

    clearProgress();
    // Show brief success message
    progressText.textContent = `✅ ZIP downloaded: ${zipFileName}`;
    show(progressSec);
    setTimeout(() => hide(progressSec), 8000);
  } catch (err) {
    console.error("ZIP generation failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    progressText.textContent = `❌ Error: ${msg}`;
    show(progressSec);
  } finally {
    state.isGenerating = false;
    if (state.validationResult?.isValid) {
      btnGenerate.disabled = false;
      btnGenerate.setAttribute("aria-disabled", "false");
    }
  }
}

/* ------------------------------------------------------------------ */
/* Event listeners                                                     */
/* ------------------------------------------------------------------ */

// File input change
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  resetState();
  processFile(file);
});

// Drag and drop
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("drag-over");
});
uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("drag-over");
});
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  if (!file.name.match(/\.(csv|json)$/i)) {
    alert("Please drop a .csv or .json file.");
    return;
  }
  resetState();
  processFile(file);
});

// Keyboard activate for upload area
uploadArea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

// Generate ZIP
btnGenerate.addEventListener("click", () => {
  generateZip();
});

// Clear data
btnClear.addEventListener("click", () => {
  resetState();
});

// Sample downloads
btnSampleCsv.addEventListener("click", () => {
  downloadBlob(new Blob([SAMPLE_CSV], { type: "text/csv" }), "sample-assets.csv");
});
btnSampleJson.addEventListener("click", () => {
  downloadBlob(
    new Blob([SAMPLE_JSON], { type: "application/json" }),
    "sample-assets.json"
  );
});

/* ------------------------------------------------------------------ */
/* Service worker registration                                         */
/* ------------------------------------------------------------------ */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
