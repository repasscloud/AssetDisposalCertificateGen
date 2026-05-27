import type { AssetDisposalRecord } from "../models/AssetDisposalRecord.ts";
import { escapeXml } from "./escapeXml.ts";

/* ------------------------------------------------------------------ */
/* Layout constants (SVG user units = pixels at 1:1)                  */
/* ------------------------------------------------------------------ */
const W = 1600;       // canvas width
const MARGIN = 44;    // left / right margin
const COL_GAP = 48;   // gap between left and right columns
const COL_W = (W - MARGIN * 2 - COL_GAP) / 2; // ≈ 732 px per column
const LABEL_W = 190;  // width reserved for the field label
const VALUE_X_LEFT = MARGIN + LABEL_W;
const VALUE_X_RIGHT = MARGIN + COL_W + COL_GAP + LABEL_W;
const VALUE_W = COL_W - LABEL_W;   // available width for value text

const FONT_LABEL = 13;
const FONT_VALUE = 13;
const FONT_SECTION = 12;
const FONT_TITLE = 26;
const FONT_SUBTITLE = 14;
const ROW_H = 28;          // normal row height
const SECTION_PAD_TOP = 18;
const SECTION_HEADING_H = 32;
const HEADER_H = 88;       // coloured top banner height

/* Approximate average character width for the font used.             */
/* Helvetica / Arial at 13px ≈ 0.56 × fontSize per char.             */
const AVG_CHAR_W = FONT_VALUE * 0.56;
const MAX_CHARS_VALUE = Math.floor(VALUE_W / AVG_CHAR_W);

// For full-width text areas (declaration, notes, hash)
const FULL_VALUE_W = W - MARGIN * 2 - LABEL_W;
const MAX_CHARS_FULL = Math.floor(FULL_VALUE_W / AVG_CHAR_W);

/* ------------------------------------------------------------------ */
/* Text-wrap helper                                                    */
/* ------------------------------------------------------------------ */
function wrapText(text: string, maxChars: number): string[] {
  if (!text) return ["—"];
  if (text.length <= maxChars) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) lines.push(current);
      // Handle words longer than maxChars
      let w = word;
      while (w.length > maxChars) {
        lines.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

/* ------------------------------------------------------------------ */
/* SVG building blocks                                                 */
/* ------------------------------------------------------------------ */
function text(
  x: number,
  y: number,
  content: string,
  opts: {
    size?: number;
    weight?: "normal" | "bold";
    fill?: string;
    anchor?: "start" | "middle" | "end";
  } = {}
): string {
  const size = opts.size ?? FONT_VALUE;
  const weight = opts.weight ?? "normal";
  const fill = opts.fill ?? "#111827";
  const anchor = opts.anchor ?? "start";
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Helvetica,Arial,sans-serif">${escapeXml(content)}</text>`;
}

function hLine(y: number, x1 = MARGIN, x2 = W - MARGIN, stroke = "#d1d5db", sw = 1): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
  sw = 1
): string {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${s}/>`;
}

/* ------------------------------------------------------------------ */
/* Section helpers — return [svgLines, newY]                          */
/* ------------------------------------------------------------------ */

interface Field {
  label: string;
  value: string;
}

/**
 * Renders a two-column field grid.
 * Returns SVG fragment strings and the Y position after the last row.
 */
function renderTwoColumnFields(
  leftFields: Field[],
  rightFields: Field[],
  startY: number
): { svgLines: string[]; endY: number } {
  const svgLines: string[] = [];
  const rows = Math.max(leftFields.length, rightFields.length);
  let y = startY;

  for (let i = 0; i < rows; i++) {
    const lf = leftFields[i];
    const rf = rightFields[i];

    // Calculate row height based on wrapped value lines
    const lLines = lf ? wrapText(lf.value, MAX_CHARS_VALUE) : [];
    const rLines = rf ? wrapText(rf.value, MAX_CHARS_VALUE) : [];
    const maxLines = Math.max(lLines.length, rLines.length, 1);
    const rowHeight = Math.max(ROW_H, maxLines * 18 + 10);

    const baseY = y + 18; // baseline of first text line

    if (lf) {
      // Label
      svgLines.push(
        text(MARGIN, baseY, lf.label + ":", {
          weight: "bold",
          size: FONT_LABEL,
          fill: "#374151",
        })
      );
      // Value (possibly multi-line)
      lLines.forEach((line, li) => {
        svgLines.push(text(VALUE_X_LEFT, baseY + li * 18, line, { size: FONT_VALUE }));
      });
    }

    if (rf) {
      const rx = MARGIN + COL_W + COL_GAP;
      svgLines.push(
        text(rx, baseY, rf.label + ":", {
          weight: "bold",
          size: FONT_LABEL,
          fill: "#374151",
        })
      );
      rLines.forEach((line, li) => {
        svgLines.push(
          text(VALUE_X_RIGHT, baseY + li * 18, line, { size: FONT_VALUE })
        );
      });
    }

    y += rowHeight;
    // Subtle row divider (skip last row)
    if (i < rows - 1) {
      svgLines.push(hLine(y, MARGIN, W - MARGIN, "#f3f4f6"));
    }
  }

  return { svgLines, endY: y + 8 };
}

/**
 * Renders a full-width labelled block (declaration, hash, notes).
 */
function renderFullWidthBlock(
  label: string,
  value: string,
  startY: number,
  maxChars = MAX_CHARS_FULL,
  italic = false
): { svgLines: string[]; endY: number } {
  const svgLines: string[] = [];
  const lines = wrapText(value, maxChars);

  svgLines.push(
    text(MARGIN, startY + 16, label, {
      weight: "bold",
      size: FONT_LABEL,
      fill: "#374151",
    })
  );

  lines.forEach((line, i) => {
    const style = italic
      ? ` font-style="italic"`
      : "";
    svgLines.push(
      `<text x="${VALUE_X_LEFT}" y="${startY + 16 + i * 18}" font-size="${FONT_VALUE}" fill="#111827" font-family="Helvetica,Arial,sans-serif"${style}>${escapeXml(line)}</text>`
    );
  });

  return { svgLines, endY: startY + 16 + lines.length * 18 + 8 };
}

/**
 * Renders a section heading bar (grey background, bold label).
 */
function renderSectionHeading(label: string, y: number): { svgLines: string[]; endY: number } {
  return {
    svgLines: [
      rect(MARGIN, y, W - MARGIN * 2, SECTION_HEADING_H, "#f3f4f6", "#e5e7eb"),
      text(MARGIN + 10, y + 21, label.toUpperCase(), {
        weight: "bold",
        size: FONT_SECTION,
        fill: "#6b7280",
      }),
    ],
    endY: y + SECTION_HEADING_H,
  };
}

/* ------------------------------------------------------------------ */
/* Main export                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generates a complete SVG certificate string for one asset record.
 * The SVG height is computed dynamically to fit the content.
 */
export function generateCertificateSvg(
  record: AssetDisposalRecord,
  generatedAt: string
): string {
  const lines: string[] = [];
  let y = 0;

  /* ---- Header banner ---- */
  lines.push(rect(0, 0, W, HEADER_H, "#1a2332"));
  lines.push(
    text(W / 2, 42, "ASSET DISPOSAL & DATA SANITISATION CERTIFICATE", {
      size: FONT_TITLE,
      weight: "bold",
      fill: "#ffffff",
      anchor: "middle",
    })
  );
  lines.push(
    text(W / 2, 68, `Certificate ID: ${record.certificateId}`, {
      size: FONT_SUBTITLE,
      fill: "#94a3b8",
      anchor: "middle",
    })
  );
  y = HEADER_H;

  /* ---- Meta bar (generated at / file) ---- */
  y += 14;
  lines.push(
    text(MARGIN, y, `Generated: ${generatedAt}`, { size: 12, fill: "#6b7280" })
  );
  y += 22;
  lines.push(hLine(y, MARGIN, W - MARGIN, "#e5e7eb", 1));
  y += SECTION_PAD_TOP;

  /* ---- Section 1: Asset Details ---- */
  {
    const { svgLines: sh, endY: endH } = renderSectionHeading("Asset Details", y);
    lines.push(...sh);
    y = endH + 8;

    const left: Field[] = [
      { label: "Asset ID", value: record.assetId },
      { label: "Device Type", value: record.deviceType },
      { label: "Storage Type", value: record.storageType },
      { label: "Batch ID", value: record.batchId || "—" },
      { label: "Approved By", value: record.approvedBy },
    ];
    const right: Field[] = [
      { label: "Serial Number", value: record.serialNumber },
      { label: "Make / Model", value: record.makeModel },
      { label: "Disposal Path", value: record.disposalPath },
      { label: "Disposal Date", value: record.disposalDate },
      { label: "Disposal Location", value: record.disposalLocation },
    ];
    const { svgLines, endY } = renderTwoColumnFields(left, right, y);
    lines.push(...svgLines);
    y = endY + SECTION_PAD_TOP;
  }

  lines.push(hLine(y, MARGIN, W - MARGIN, "#e5e7eb", 1));
  y += SECTION_PAD_TOP;

  /* ---- Section 2: Sanitisation Details ---- */
  {
    const { svgLines: sh, endY: endH } = renderSectionHeading("Sanitisation Details", y);
    lines.push(...sh);
    y = endH + 8;

    const left: Field[] = [
      { label: "Wipe Method", value: record.wipeMethod },
      { label: "Wipe Result", value: record.wipeResult },
      { label: "Wipe Date", value: record.wipeDate },
      { label: "Wiped By", value: record.wipedBy },
    ];
    const right: Field[] = [
      { label: "Wipe Tool", value: record.wipeTool },
      { label: "", value: "" }, // spacer
      { label: "", value: "" }, // spacer
      { label: "", value: "" }, // spacer
    ];
    const { svgLines, endY } = renderTwoColumnFields(left, right, y);
    lines.push(...svgLines);
    y = endY + SECTION_PAD_TOP;
  }

  lines.push(hLine(y, MARGIN, W - MARGIN, "#e5e7eb", 1));
  y += SECTION_PAD_TOP;

  /* ---- Section 3: Verification Details ---- */
  {
    const { svgLines: sh, endY: endH } = renderSectionHeading("Verification Details", y);
    lines.push(...sh);
    y = endH + 8;

    const left: Field[] = [
      { label: "Verification Date", value: record.verificationDate },
      { label: "Verified By", value: record.verifiedBy },
      { label: "Verif. Status", value: record.verificationStatus },
    ];
    const right: Field[] = [];
    const { svgLines, endY } = renderTwoColumnFields(left, right, y);
    lines.push(...svgLines);
    y = endY + SECTION_PAD_TOP;
  }

  lines.push(hLine(y, MARGIN, W - MARGIN, "#e5e7eb", 1));
  y += SECTION_PAD_TOP;

  /* ---- Section 4: Declaration ---- */
  {
    const { svgLines: sh, endY: endH } = renderSectionHeading("Declaration", y);
    lines.push(...sh);
    y = endH + 8;

    const declaration =
      "The asset listed on this certificate was sanitised and verified internally before release for e-waste recycling or disposal.";
    const { svgLines, endY } = renderFullWidthBlock("Statement:", declaration, y, MAX_CHARS_FULL, true);
    lines.push(...svgLines);
    y = endY + SECTION_PAD_TOP;
  }

  lines.push(hLine(y, MARGIN, W - MARGIN, "#e5e7eb", 1));
  y += SECTION_PAD_TOP;

  /* ---- Section 5: Evidence Hash ---- */
  {
    const { svgLines: sh, endY: endH } = renderSectionHeading(
      "SHA-256 Evidence Hash",
      y
    );
    lines.push(...sh);
    y = endH + 8;

    // Hash: 64 chars. At full width, one line. Add monospace style.
    const hashLines = wrapText(record.evidenceHash, MAX_CHARS_FULL);
    lines.push(
      text(MARGIN, y + 16, "SHA-256:", {
        weight: "bold",
        size: FONT_LABEL,
        fill: "#374151",
      })
    );
    hashLines.forEach((hl, i) => {
      lines.push(
        `<text x="${VALUE_X_LEFT}" y="${y + 16 + i * 18}" font-size="12" fill="#111827" font-family="Cascadia Code,Consolas,Courier New,monospace">${escapeXml(hl)}</text>`
      );
    });
    y += 16 + hashLines.length * 18 + 8 + SECTION_PAD_TOP;
  }

  if (record.notes) {
    lines.push(hLine(y, MARGIN, W - MARGIN, "#e5e7eb", 1));
    y += SECTION_PAD_TOP;

    const { svgLines: sh, endY: endH } = renderSectionHeading("Notes", y);
    lines.push(...sh);
    y = endH + 8;

    const { svgLines, endY } = renderFullWidthBlock("Notes:", record.notes, y, MAX_CHARS_FULL);
    lines.push(...svgLines);
    y = endY + SECTION_PAD_TOP;
  }

  /* ---- Bottom border ---- */
  y += 16;
  lines.push(hLine(y, MARGIN, W - MARGIN, "#1a2332", 2));
  y += 12;

  /* ---- Outer border ---- */
  const H = y + 8;
  const outerBorder = rect(2, 2, W - 4, H - 4, "none", "#1a2332", 2);

  /* ---- Assemble SVG ---- */
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    outerBorder +
    lines.join("") +
    `</svg>`
  );
}
