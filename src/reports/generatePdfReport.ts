import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";
import type { ValidationResult } from "../models/ValidationResult.ts";

/* ------------------------------------------------------------------ */
/* Page geometry (A4 landscape in points: 1 pt = 1/72 inch)           */
/* ------------------------------------------------------------------ */
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 28;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 18;

/* ----- Colours ----- */
const C_BLACK = rgb(0.067, 0.094, 0.153);   // #111827
const C_DARK = rgb(0.102, 0.137, 0.196);     // #1a2332
const C_GRAY = rgb(0.42, 0.45, 0.502);       // #6b7280
const C_LIGHT_GRAY = rgb(0.953, 0.957, 0.965); // #f3f4f6
const C_WHITE = rgb(1, 1, 1);
const C_HEADER_BG = rgb(0.102, 0.137, 0.196); // #1a2332
const C_HEADER_TEXT = rgb(1, 1, 1);
const C_ERR_BG = rgb(0.996, 0.949, 0.949);   // #fef2f2
const C_ERR_TEXT = rgb(0.6, 0.11, 0.11);      // #991b1b
const C_WARN_BG = rgb(1, 0.984, 0.922);       // #fffbeb
const C_WARN_TEXT = rgb(0.573, 0.251, 0);     // #92400e
const C_SUCCESS_BG = rgb(0.941, 0.992, 0.961); // #f0fdf4
const C_SUCCESS_TEXT = rgb(0.086, 0.506, 0.29); // #166534
const C_BORDER = rgb(0.82, 0.839, 0.863);     // #d1d5db

/* ----- Font sizes ----- */
const FS_TITLE = 18;
const FS_H2 = 10;
const FS_BODY = 8;
const FS_TABLE_HEADER = 7;
const FS_TABLE_BODY = 6.5;

/* ------------------------------------------------------------------ */
/* Column definitions                                                  */
/* ------------------------------------------------------------------ */
interface ColDef {
  header: string;
  width: number;
  getValue: (r: AssetDisposalRecord) => string;
}

function buildCols(): ColDef[] {
  return [
    { header: "Asset ID",        width: 48, getValue: (r) => r.assetId },
    { header: "Serial No.",      width: 52, getValue: (r) => r.serialNumber },
    { header: "Device Type",     width: 44, getValue: (r) => r.deviceType },
    { header: "Make / Model",    width: 62, getValue: (r) => r.makeModel },
    { header: "Wipe Method",     width: 60, getValue: (r) => r.wipeMethod },
    { header: "Wipe Tool",       width: 72, getValue: (r) => r.wipeTool },
    { header: "Wipe Date",       width: 44, getValue: (r) => r.wipeDate },
    { header: "Wiped By",        width: 50, getValue: (r) => r.wipedBy },
    { header: "Verif. Date",     width: 44, getValue: (r) => r.verificationDate },
    { header: "Verified By",     width: 50, getValue: (r) => r.verifiedBy },
    { header: "Verif. Status",   width: 44, getValue: (r) => r.verificationStatus },
    { header: "Disposal Date",   width: 44, getValue: (r) => r.disposalDate },
    { header: "Disposal Loc.",   width: 55, getValue: (r) => r.disposalLocation },
    { header: "Certificate",     width: 50, getValue: (r) => r.certificateFileName },
    { header: "Evidence Hash",   width: 79, getValue: (r) => r.evidenceHash.slice(0, 16) + "..." },
  ];
}

/* ------------------------------------------------------------------ */
/* Low-level helpers                                                   */
/* ------------------------------------------------------------------ */

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "..." : text;
}

/** Measure text width using pdf-lib's font metrics. */
function measureText(text: string, font: PDFFont, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.5;
  }
}

/** Fit text to available width by truncating with ellipsis. */
function fitText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number
): string {
  if (measureText(text, font, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && measureText(t + "...", font, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "...";
}

/** Draw text at (x, y) where y is measured from the TOP of the page. */
function drawText(
  page: PDFPage,
  text: string,
  x: number,
  yFromTop: number,
  font: PDFFont,
  size: number,
  color = C_BLACK
): void {
  const y = PAGE_H - yFromTop - size;
  if (y < 0 || y > PAGE_H) return;
  page.drawText(text, { x, y, size, font, color });
}

/** Draw a filled rectangle. yFromTop = distance from top of page. */
function drawRect(
  page: PDFPage,
  x: number,
  yFromTop: number,
  width: number,
  height: number,
  color: ReturnType<typeof rgb>,
  borderColor?: ReturnType<typeof rgb>
): void {
  const y = PAGE_H - yFromTop - height;
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color,
    borderColor,
    borderWidth: borderColor ? 0.5 : 0,
  });
}

/** Draw a horizontal rule. */
function drawHRule(
  page: PDFPage,
  yFromTop: number,
  x1 = MARGIN,
  x2 = PAGE_W - MARGIN,
  color = C_BORDER,
  thickness = 0.5
): void {
  const y = PAGE_H - yFromTop;
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

/* ------------------------------------------------------------------ */
/* Page management                                                     */
/* ------------------------------------------------------------------ */

interface DrawState {
  doc: PDFDocument;
  page: PDFPage;
  pageIndex: number;
  yTop: number;       // current y position from top
  font: PDFFont;
  bold: PDFFont;
  totalPages: () => number;
}

function addPage(
  state: DrawState,
  generatedAt: string
): PDFPage {
  const page = state.doc.addPage([PAGE_W, PAGE_H]);
  state.page = page;
  state.pageIndex++;
  state.yTop = MARGIN;
  drawFooter(page, state.bold, state.font, generatedAt);
  return page;
}

function drawFooter(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  generatedAt: string
): void {
  const y = FOOTER_H;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: C_BORDER,
  });
  page.drawText(`Asset Disposal Batch Report  |  Generated: ${generatedAt}`, {
    x: MARGIN,
    y: y - 9,
    size: 6,
    font: regular,
    color: C_GRAY,
  });
  // Page number placeholder — we'll update after all pages created
  page.drawText("Page", {
    x: PAGE_W - MARGIN - 30,
    y: y - 9,
    size: 6,
    font: bold,
    color: C_GRAY,
  });
}

/* ------------------------------------------------------------------ */
/* Cover / Summary page                                                */
/* ------------------------------------------------------------------ */

function drawCoverPage(
  state: DrawState,
  {
    exportBatchId,
    generatedAt,
    inputFileName,
    inputFileSha256,
    assetCount,
    validCount,
    errorCount,
    warningCount,
    validationResult,
  }: {
    exportBatchId: string;
    generatedAt: string;
    inputFileName: string;
    inputFileSha256: string;
    assetCount: number;
    validCount: number;
    errorCount: number;
    warningCount: number;
    validationResult: ValidationResult;
  }
): void {
  const { page, font, bold } = state;
  let y = MARGIN;

  /* Header bar */
  drawRect(page, 0, 0, PAGE_W, 56, C_HEADER_BG);
  page.drawText("Asset Disposal Batch Report", {
    x: MARGIN,
    y: PAGE_H - 38,
    size: FS_TITLE,
    font: bold,
    color: C_HEADER_TEXT,
  });

  y = 68;

  /* Key-value metadata */
  const kv = (label: string, value: string): void => {
    drawText(page, label + ":", MARGIN, y, bold, FS_H2, C_GRAY);
    drawText(page, value, MARGIN + 110, y, font, FS_H2, C_BLACK);
    y += 16;
  };

  kv("Export Batch ID", exportBatchId);
  kv("Generated At", generatedAt);
  kv("Input File", inputFileName);
  kv("Input SHA-256", truncate(inputFileSha256, 72));
  kv("Total Assets", String(assetCount));
  y += 4;
  drawHRule(page, y, MARGIN, PAGE_W - MARGIN);
  y += 10;

  /* Validation summary chips */
  const chips: { label: string; value: string; bg: ReturnType<typeof rgb>; fg: ReturnType<typeof rgb> }[] = [
    { label: "Total Records", value: String(assetCount), bg: C_LIGHT_GRAY, fg: C_BLACK },
    { label: "Valid", value: String(validCount), bg: C_SUCCESS_BG, fg: C_SUCCESS_TEXT },
    { label: "Warnings", value: String(warningCount), bg: C_WARN_BG, fg: C_WARN_TEXT },
    { label: "Errors", value: String(errorCount), bg: errorCount > 0 ? C_ERR_BG : C_LIGHT_GRAY, fg: errorCount > 0 ? C_ERR_TEXT : C_GRAY },
  ];

  let chipX = MARGIN;
  for (const chip of chips) {
    const chipW = 90;
    drawRect(page, chipX, y, chipW, 32, chip.bg, C_BORDER);
    drawText(page, chip.label, chipX + 6, y + 8, bold, 6.5, chip.fg);
    drawText(page, chip.value, chipX + 6, y + 18, bold, 10, chip.fg);
    chipX += chipW + 8;
  }
  y += 46;

  drawHRule(page, y);
  y += 12;

  /* Declaration */
  drawText(page, "Declaration:", MARGIN, y, bold, FS_H2, C_DARK);
  y += 14;

  const declaration =
    "This report records assets sanitised and verified internally before release for e-waste recycling or disposal. " +
    "Each listed asset has an individual SVG certificate included in the export package.";
  const words = declaration.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (measureText(test, font, FS_BODY) < CONTENT_W - 10) {
      line = test;
    } else {
      drawText(page, line, MARGIN + 8, y, font, FS_BODY, C_BLACK);
      y += 12;
      line = word;
    }
  }
  if (line) {
    drawText(page, line, MARGIN + 8, y, font, FS_BODY, C_BLACK);
    y += 16;
  }

  drawHRule(page, y);
  y += 12;

  /* Errors (first 8) */
  if (validationResult.errors.length > 0) {
    drawRect(page, MARGIN, y, CONTENT_W, 14, C_ERR_BG, C_BORDER);
    drawText(page, `[ERROR] ${validationResult.errors.length} Validation Error(s) - generation was blocked`, MARGIN + 6, y + 2, bold, FS_BODY, C_ERR_TEXT);
    y += 16;
    const shown = validationResult.errors.slice(0, 8);
    for (const e of shown) {
      drawText(page, `- [${e.assetId}] ${e.field}: ${truncate(e.message, 100)}`, MARGIN + 8, y, font, 6.5, C_ERR_TEXT);
      y += 10;
    }
    if (validationResult.errors.length > 8) {
      drawText(page, `  ... and ${validationResult.errors.length - 8} more errors.`, MARGIN + 8, y, font, 6.5, C_ERR_TEXT);
      y += 10;
    }
    y += 6;
  }

  /* Warnings (first 8) */
  if (validationResult.warnings.length > 0) {
    drawRect(page, MARGIN, y, CONTENT_W, 14, C_WARN_BG, C_BORDER);
    drawText(page, `[WARN] ${validationResult.warnings.length} Warning(s)`, MARGIN + 6, y + 2, bold, FS_BODY, C_WARN_TEXT);
    y += 16;
    const shown = validationResult.warnings.slice(0, 8);
    for (const w of shown) {
      drawText(page, `- [${w.assetId}] ${w.field}: ${truncate(w.message, 100)}`, MARGIN + 8, y, font, 6.5, C_WARN_TEXT);
      y += 10;
    }
    if (validationResult.warnings.length > 8) {
      drawText(page, `  ... and ${validationResult.warnings.length - 8} more warnings.`, MARGIN + 8, y, font, 6.5, C_WARN_TEXT);
      y += 10;
    }
  }

  state.yTop = y + 10;
}

/* ------------------------------------------------------------------ */
/* Table pages                                                         */
/* ------------------------------------------------------------------ */

const TABLE_ROW_H = 12;  // points per table row
const TABLE_HEADER_H = 16;

function drawTableHeaderRow(
  page: PDFPage,
  cols: ColDef[],
  yFromTop: number,
  bold: PDFFont
): void {
  let x = MARGIN;
  drawRect(page, MARGIN, yFromTop, CONTENT_W, TABLE_HEADER_H, C_HEADER_BG);
  for (const col of cols) {
    const label = fitText(col.header, col.width - 4, bold, FS_TABLE_HEADER);
    drawText(page, label, x + 3, yFromTop + 4, bold, FS_TABLE_HEADER, C_WHITE);
    x += col.width;
  }
}

function drawTableDataRow(
  page: PDFPage,
  record: AssetDisposalRecord,
  cols: ColDef[],
  rowIndex: number,
  yFromTop: number,
  font: PDFFont,
  bold: PDFFont
): void {
  const bg = rowIndex % 2 === 0 ? C_WHITE : C_LIGHT_GRAY;
  drawRect(page, MARGIN, yFromTop, CONTENT_W, TABLE_ROW_H, bg);

  let x = MARGIN;
  for (const col of cols) {
    const raw = col.getValue(record);
    const fitted = fitText(raw, col.width - 4, font, FS_TABLE_BODY);
    const isFirst = col.header === "Asset ID";
    drawText(page, fitted, x + 3, yFromTop + 3, isFirst ? bold : font, FS_TABLE_BODY, C_BLACK);
    x += col.width;
  }

  // Bottom border of row
  const y = PAGE_H - yFromTop - TABLE_ROW_H;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.25,
    color: C_BORDER,
  });
}

function drawTablePages(
  state: DrawState,
  records: AssetDisposalRecord[],
  cols: ColDef[],
  generatedAt: string
): void {
  // Start new page for the table
  addPage(state, generatedAt);
  let { page, font, bold } = state;

  let y = MARGIN;

  // Section heading
  drawRect(page, MARGIN, y, CONTENT_W, 16, C_DARK);
  drawText(
    page,
    `Asset Table  (${records.length} record${records.length !== 1 ? "s" : ""})`,
    MARGIN + 8,
    y + 2,
    bold,
    FS_H2,
    C_WHITE
  );
  y += 20;

  // Table header
  drawTableHeaderRow(page, cols, y, bold);
  y += TABLE_HEADER_H;

  for (let i = 0; i < records.length; i++) {
    // Check if we need a new page (leave room for footer)
    const remaining = PAGE_H - y - FOOTER_H - 10;
    if (remaining < TABLE_ROW_H * 2) {
      addPage(state, generatedAt);
      page = state.page;
      bold = state.bold;
      font = state.font;
      y = MARGIN;
      drawTableHeaderRow(page, cols, y, bold);
      y += TABLE_HEADER_H;
    }

    drawTableDataRow(page, records[i], cols, i, y, font, bold);
    y += TABLE_ROW_H;
  }

  state.yTop = y + 10;
}

/* ------------------------------------------------------------------ */
/* Page numbers (post-processing)                                     */
/* ------------------------------------------------------------------ */

function addPageNumbers(doc: PDFDocument, bold: PDFFont): void {
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    page.drawText(`Page ${i + 1} of ${total}`, {
      x: PAGE_W - MARGIN - 55,
      y: FOOTER_H - 9,
      size: 6,
      font: bold,
      color: C_GRAY,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Main export                                                         */
/* ------------------------------------------------------------------ */

export async function generatePdfReport(
  records: AssetDisposalRecord[],
  validationResult: ValidationResult,
  exportBatchId: string,
  inputFileName: string,
  inputFileSha256: string,
  generatedAt: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const validCount = records.length; // all records that passed validation

  /* Cover page */
  const firstPage = doc.addPage([PAGE_W, PAGE_H]);
  drawFooter(firstPage, bold, font, generatedAt);

  const state: DrawState = {
    doc,
    page: firstPage,
    pageIndex: 0,
    yTop: MARGIN,
    font,
    bold,
    totalPages: () => doc.getPageCount(),
  };

  drawCoverPage(state, {
    exportBatchId,
    generatedAt,
    inputFileName,
    inputFileSha256,
    assetCount: records.length,
    validCount,
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings.length,
    validationResult,
  });

  /* Asset table pages */
  const cols = buildCols();
  if (records.length > 0) {
    drawTablePages(state, records, cols, generatedAt);
  }

  /* Page numbers */
  addPageNumbers(doc, bold);

  return doc.save();
}
