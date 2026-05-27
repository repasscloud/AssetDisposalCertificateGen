# Asset Disposal Certificate Generator

A privacy-first, client-side Progressive Web App (PWA) for generating tamper-evident asset disposal certificates, a consolidated PDF batch report, and an audit-ready ZIP archive — entirely within your browser.

> **All processing occurs locally in your browser. No data is uploaded, stored, or retained.**

---

## Features

- 📥 **Import CSV or JSON** — drag-and-drop or browse; parsed entirely in-browser
- ✅ **Comprehensive validation** — errors block generation; warnings surface audit concerns
- 📄 **Per-asset certificates** — SVG, PNG, and print-ready A4 landscape PDF for every record
- 📋 **Consolidated PDF batch report** — asset table, summary, and declaration on one document
- 🔒 **SHA-256 evidence hashing** — per-record canonical hash via browser SubtleCrypto API, plus a hash of the entire source file
- 📦 **Single ZIP download** — all certificates, reports, manifest, validation results, and original source file in one archive
- 🗂️ **machine-readable manifest** — `manifest.json` records export metadata and all per-record hashes
- 🔁 **Zero persistence** — refreshing or closing the tab clears all in-memory state
- 📲 **Installable PWA** — works offline after first load via service worker

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- npm (bundled with Node.js)

### Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Production build

```bash
npm run build       # type-checks then bundles to dist/
npm run preview     # serve the production bundle locally
```

---

## Usage

1. **Import** — drag and drop (or browse to) a `.csv` or `.json` file containing asset disposal records.
2. **Validate** — the app validates all records instantly and displays any errors and warnings. All errors must be resolved before you can proceed.
3. **Generate** — click **Generate ZIP** to produce the export archive. A browser download is triggered automatically.

Sample files are available inside the app via **Download sample CSV** / **Download sample JSON**, or in [`samples/`](samples/).

---

## ZIP Archive Contents

```
asset-disposal-export-<batchId>.zip
├── asset-disposal-report.pdf          # Consolidated batch PDF report
├── manifest.json                      # Export metadata & per-record evidence hashes
├── validation-results.json            # All validation errors and warnings
├── source-data.{csv|json}             # Original uploaded input file (verbatim copy)
└── certificates/
    ├── <AssetId>.svg                  # Certificate — SVG source
    ├── <AssetId>.png                  # Certificate — PNG render
    └── <AssetId>.pdf                  # Certificate — print-ready A4 landscape PDF
```

---

## Input Format

### Required CSV columns (any order)

```
AssetId, SerialNumber, DeviceType, MakeModel, StorageType,
WipeMethod, WipeTool, WipeResult, WipeDate, WipedBy,
VerificationDate, VerifiedBy, VerificationStatus,
DisposalPath, DisposalDate, DisposalLocation, ApprovedBy
```

### Optional columns

```
BatchId, Notes
```

### Field reference

| Field | Required | Notes |
|-------|----------|-------|
| `AssetId` | ✅ | Unique identifier — used as the certificate filename base |
| `SerialNumber` | ✅ | Device serial number |
| `DeviceType` | ✅ | e.g. `Laptop`, `Desktop`, `Server`, `Tablet` |
| `MakeModel` | ✅ | e.g. `Lenovo ThinkPad P53s` |
| `StorageType` | ✅ | e.g. `SSD`, `HDD` |
| `WipeMethod` | ✅ | e.g. `NIST 800-88 Purge`, `DoD 5220.22-M (7-pass)` |
| `WipeTool` | ✅ | Software or procedure used to perform the wipe |
| `WipeResult` | ✅ | Must be exactly **`Successful`** |
| `WipeDate` | ✅ | `yyyy-MM-dd` — e.g. `2026-05-27` |
| `WipedBy` | ✅ | Person who performed the wipe |
| `VerificationDate` | ✅ | `yyyy-MM-dd` — must be ≥ `WipeDate` |
| `VerifiedBy` | ✅ | Person who independently verified the wipe |
| `VerificationStatus` | ✅ | Must be exactly **`Verified`** |
| `DisposalPath` | ✅ | e.g. `E-waste recycling`, `Certified hardware destruction` |
| `DisposalDate` | ✅ | `yyyy-MM-dd` — must be ≥ `VerificationDate` |
| `DisposalLocation` | ✅ | Specific vendor or site name |
| `ApprovedBy` | ✅ | Authorising officer |
| `BatchId` | ➖ optional | Blank records use the export batch ID |
| `Notes` | ➖ optional | Free-text audit notes |

### JSON format

Provide a JSON array of objects using the same field names in **camelCase**:

```json
[
  {
    "assetId": "M005370",
    "serialNumber": "PF1YFKPN",
    "deviceType": "Laptop",
    "makeModel": "Lenovo ThinkPad P53s",
    "storageType": "SSD",
    "wipeMethod": "NIST 800-88 Purge",
    "wipeTool": "Lenovo BIOS/UEFI Secure Erase + BitLocker key destruction",
    "wipeResult": "Successful",
    "wipeDate": "2026-05-27",
    "wipedBy": "Simon Fahim",
    "verificationDate": "2026-05-27",
    "verifiedBy": "Irwin Torres",
    "verificationStatus": "Verified",
    "disposalPath": "E-waste recycling",
    "disposalDate": "2026-05-28",
    "disposalLocation": "Local Asset Disposal Company",
    "batchId": "",
    "approvedBy": "Danijel Wynyard",
    "notes": "No recoverable organisational data identified after verification."
  }
]
```

---

## Validation Rules

### Errors — block ZIP generation

| # | Rule |
|---|------|
| E1 | All required fields must be non-blank |
| E2 | `AssetId` must be unique across all records |
| E3 | `AssetId` must contain at least one valid filename character |
| E4 | Date fields (`WipeDate`, `VerificationDate`, `DisposalDate`) must be valid `yyyy-MM-dd` |
| E5 | `WipeDate` must not be after `VerificationDate` |
| E6 | `VerificationDate` must not be after `DisposalDate` |
| E7 | `WipeResult` must be exactly `Successful` |
| E8 | `VerificationStatus` must be exactly `Verified` |

### Warnings — informational only

| # | Rule |
|---|------|
| W1 | `BatchId` is blank — export batch ID will be substituted |
| W2 | `Notes` field is blank |
| W3 | `DisposalLocation` appears generic (e.g. `unknown`, `n/a`, `tbd`) |
| W4 | `WipeTool` value is very short (< 6 characters) |
| W5 | `ApprovedBy` and `WipedBy` are the same person |
| W6 | `VerifiedBy` and `WipedBy` are the same person (independent verification recommended) |
| W7 | `DisposalDate` is more than 30 days after `VerificationDate` |
| W8 | Multiple distinct `BatchId` values detected across records |

---

## Evidence Hashing

Each certificate embeds a SHA-256 hash computed from the record's source evidence fields using the browser's [SubtleCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto). The hash is derived from a canonical JSON serialisation of the following fields:

```
assetId, serialNumber, deviceType, makeModel, storageType,
wipeMethod, wipeTool, wipeResult, wipeDate, wipedBy,
verificationDate, verifiedBy, verificationStatus,
disposalPath, disposalDate, disposalLocation,
batchId, approvedBy, notes
```

Generated fields (`certificateId`, `certificateFileName`, `evidenceHash`) are **excluded** from the input to ensure the hash is reproducible from source data alone. The `manifest.json` also records a SHA-256 hash of the entire original input file for chain-of-custody purposes.

---

## Deploy to GitHub Pages

### Automatic (GitHub Actions)

1. Push the repository to GitHub.
2. In **Settings → Pages**, set **Source** to `GitHub Actions`.
3. Any push to `main` triggers the workflow at `.github/workflows/deploy-pages.yml`, which:
   - Type-checks with `tsc --noEmit`
   - Builds with `VITE_BASE=/<repo-name>/` for correct sub-path asset resolution
   - Deploys `dist/` to GitHub Pages via OIDC

To override the base path (e.g. for a user/org root site at `/`), set the `PAGES_BASE_PATH` repository variable.

### Manual

```bash
npm run build
# Copy dist/ to your Pages branch or static host
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| CSV parsing | [PapaParse](https://www.papaparse.com/) |
| PDF generation | [pdf-lib](https://pdf-lib.js.org/) |
| ZIP assembly | [JSZip](https://stuk.github.io/jszip/) |
| Hashing | Browser Web Crypto API (`SubtleCrypto.digest`) |
| PWA | Service Worker + Web App Manifest |
| CI/CD | GitHub Actions → GitHub Pages |

No React. No CSS framework. No server. No analytics. No CDN runtime dependencies.

---

## Project Structure

```
├── src/
│   ├── main.ts                        # App entry point & all UI logic
│   ├── styles.css                     # Application styles
│   ├── models/
│   │   ├── AssetDisposalRecord.ts     # Core data model & field constants
│   │   ├── ExportManifest.ts          # Manifest schema
│   │   └── ValidationResult.ts        # Validation result types
│   ├── parsers/
│   │   ├── parseCsv.ts                # CSV → AssetDisposalRecord[]
│   │   ├── parseJson.ts               # JSON → AssetDisposalRecord[]
│   │   └── normaliseRecord.ts         # Field normalisation
│   ├── validation/
│   │   └── validateAssets.ts          # All validation rules
│   ├── certificates/
│   │   ├── generateCertificateSvg.ts  # SVG certificate template
│   │   ├── svgToPng.ts                # SVG → PNG via Canvas API
│   │   ├── generateCertificatePdf.ts  # PNG → A4 landscape PDF (pdf-lib)
│   │   └── escapeXml.ts               # XML/SVG escaping helper
│   ├── reports/
│   │   └── generatePdfReport.ts       # Consolidated batch PDF report
│   ├── export/
│   │   ├── buildZip.ts                # ZIP assembly orchestrator
│   │   └── buildManifest.ts           # manifest.json & validation-results.json
│   ├── crypto/
│   │   └── sha256.ts                  # SubtleCrypto SHA-256 helpers
│   └── utils/
│       ├── dates.ts                   # ISO date validation & formatting
│       ├── downloadBlob.ts            # Trigger browser file download
│       └── sanitiseFileName.ts        # Safe certificate filename generation
├── public/
│   ├── manifest.webmanifest           # PWA manifest
│   ├── sw.js                          # Service worker (offline support)
│   └── icons/                         # PWA icons (192×192, 512×512 PNG)
├── samples/
│   ├── sample-assets.csv              # Example CSV input
│   └── sample-assets.json             # Example JSON input
├── test/
│   └── smoke-test.mjs                 # Basic smoke test
├── index.html
├── vite.config.ts
└── tsconfig.json
```

---

## Privacy

This app:

- ❌ Does **not** send data to any server
- ❌ Does **not** use `localStorage`, `sessionStorage`, or IndexedDB for asset data
- ❌ Does **not** include analytics or telemetry
- ❌ Does **not** load runtime scripts from external CDNs
- ✅ Processes everything **locally in the browser**
- ✅ Clears all in-memory state on page refresh or tab close
- ✅ Provides a **Clear Data** button to reset state manually

---

## Licence

Internal tooling — all rights reserved.
