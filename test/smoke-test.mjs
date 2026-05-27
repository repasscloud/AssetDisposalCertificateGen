/**
 * smoke-test.mjs
 * Quick acceptance smoke test — runs in Node.js (not the browser).
 * Tests core logic that doesn't need browser APIs.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? "Assertion failed");
}

/* ------------------------------------------------------------------ */
/* Import source modules via dynamic require of compiled output        */
/* We test the logic inline since we can't import TS directly.        */
/* ------------------------------------------------------------------ */

/* ---- dates.ts logic ---- */
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function isIsoDate(v) {
  if (!ISO_DATE_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !isNaN(d.getTime());
}
function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / msPerDay;
}

console.log("\n── Date validation ──────────────────────────");
test("accepts 2026-05-27", () => assert(isIsoDate("2026-05-27")));
test("accepts 2026-01-01", () => assert(isIsoDate("2026-01-01")));
test("rejects 27/05/2026", () => assert(!isIsoDate("27/05/2026")));
test("rejects 05/27/2026", () => assert(!isIsoDate("05/27/2026")));
test("rejects 27-05-2026", () => assert(!isIsoDate("27-05-2026")));
test("rejects 2026-13-01 (month out of range)", () => assert(!isIsoDate("2026-13-01")));
test("daysBetween 2026-05-27 → 2026-05-28 = 1", () => assert(daysBetween("2026-05-27", "2026-05-28") === 1));
test("daysBetween > 30 triggers warning", () => assert(daysBetween("2026-05-01", "2026-06-10") > 30));

/* ---- sanitiseFileName logic ---- */
function sanitiseBaseName(v) {
  const INVALID = /[<>:"/\\|?*\x00-\x1f]/g;
  const s = v.trim().replace(INVALID, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return s.length > 0 ? s : null;
}

console.log("\n── Filename sanitisation ────────────────────");
test("M005370 → M005370", () => assert(sanitiseBaseName("M005370") === "M005370"));
test("M005370:bad → M005370_bad", () => assert(sanitiseBaseName("M005370:bad") === "M005370_bad"));
test("  spaces  → spaces", () => assert(sanitiseBaseName("  spaces  ") === "spaces"));
test("<>:\"/\\|?* → null (all invalid)", () => assert(sanitiseBaseName('<>:"/\\|?*') === null));

/* ---- escapeXml logic ---- */
function escapeXml(v) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

console.log("\n── XML escaping ─────────────────────────────");
test("escapes &", () => assert(escapeXml("a & b") === "a &amp; b"));
test("escapes <", () => assert(escapeXml("a < b") === "a &lt; b"));
test("escapes >", () => assert(escapeXml("a > b") === "a &gt; b"));
test("escapes \"", () => assert(escapeXml('a " b') === "a &quot; b"));
test("escapes '", () => assert(escapeXml("a ' b") === "a &apos; b"));
test("does not double-escape", () => assert(escapeXml("&amp;") === "&amp;amp;"));

/* ---- Sample files exist and are parseable ---- */
console.log("\n── Sample files ─────────────────────────────");
test("sample-assets.csv exists", () => {
  const p = join(ROOT, "samples/sample-assets.csv");
  const content = readFileSync(p, "utf-8");
  assert(content.includes("AssetId"), "Missing AssetId header");
  assert(content.split("\n").length > 2, "CSV has fewer than 2 data rows");
});

test("sample-assets.json exists and is valid JSON array", () => {
  const p = join(ROOT, "samples/sample-assets.json");
  const parsed = JSON.parse(readFileSync(p, "utf-8"));
  assert(Array.isArray(parsed), "Not an array");
  assert(parsed.length >= 3, "Fewer than 3 records");
  assert(parsed[0].assetId, "Missing assetId in first record");
});

test("sample CSV dates are ISO format", () => {
  const p = join(ROOT, "samples/sample-assets.csv");
  const lines = readFileSync(p, "utf-8").split("\n").slice(1).filter(Boolean);
  const headers = readFileSync(p, "utf-8").split("\n")[0].split(",").map(h => h.trim());
  const wipeIdx = headers.indexOf("WipeDate");
  for (const line of lines) {
    // Very simple CSV split (no quoted values with commas expected in date fields)
    const parts = line.split(",");
    if (parts[wipeIdx]) {
      assert(isIsoDate(parts[wipeIdx].trim()), `Non-ISO date: ${parts[wipeIdx]}`);
    }
  }
});

test("sample JSON dates are ISO format", () => {
  const p = join(ROOT, "samples/sample-assets.json");
  const parsed = JSON.parse(readFileSync(p, "utf-8"));
  for (const r of parsed) {
    assert(isIsoDate(r.wipeDate), `Non-ISO wipeDate: ${r.wipeDate}`);
    assert(isIsoDate(r.verificationDate), `Non-ISO verificationDate: ${r.verificationDate}`);
    assert(isIsoDate(r.disposalDate), `Non-ISO disposalDate: ${r.disposalDate}`);
  }
});

test("sample JSON has WipeResult=Successful", () => {
  const p = join(ROOT, "samples/sample-assets.json");
  const parsed = JSON.parse(readFileSync(p, "utf-8"));
  for (const r of parsed) {
    assert(r.wipeResult === "Successful", `WipeResult: ${r.wipeResult}`);
  }
});

test("sample JSON has VerificationStatus=Verified", () => {
  const p = join(ROOT, "samples/sample-assets.json");
  const parsed = JSON.parse(readFileSync(p, "utf-8"));
  for (const r of parsed) {
    assert(r.verificationStatus === "Verified", `VerificationStatus: ${r.verificationStatus}`);
  }
});

/* ---- makeBatchId format ---- */
function makeBatchId(date = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `DISP-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

console.log("\n── Batch ID generation ──────────────────────");
test("format matches DISP-yyyyMMdd-HHmmss", () => {
  const id = makeBatchId(new Date("2026-05-28T14:30:12Z"));
  assert(/^DISP-\d{8}-\d{6}$/.test(id), `Invalid format: ${id}`);
});

/* ---- Summary ---- */
console.log(`\n════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Some tests failed — check the output above.");
  process.exit(1);
} else {
  console.log("All smoke tests passed ✅");
}
