import type { CleanResult } from "./csv";

const REPORT_URL = "https://zac343.github.io/csv-guard/?ref=security-review-report-v1";

export function createSecurityReviewReport(result: CleanResult) {
  const mode = result.formulaProtectionMode === "excel-tab"
    ? "Excel review prefix (tab + apostrophe)"
    : "Apostrophe prefix";
  const modeBoundary = result.formulaProtectionMode === "excel-tab"
    ? "Both prefixes remain in exported data and may disrupt downstream imports."
    : "The apostrophe remains in exported data and may be stripped or reinterpreted downstream.";
  const { stats } = result;

  return [
    "<!-- csv-guard-review-report:v1 -->",
    "# CSV export security review",
    "",
    "> Generated locally by CSV Guard. This handoff contains aggregate counts only; it does not include file names, paths, headers, cell values, or CSV content.",
    "",
    "## Inspection summary",
    "",
    `- Input rows: ${stats.inputRows}`,
    `- Output rows: ${stats.outputRows}`,
    `- Formula-like segments changed: ${stats.riskyPrefixesPrefixed}`,
    `- Duplicates removed: ${stats.duplicatesRemoved}`,
    `- Empty rows removed: ${stats.emptyRowsRemoved}`,
    `- Cells trimmed: ${stats.cellsTrimmed}`,
    `- Headers normalized: ${stats.headersNormalized}`,
    `- Formula handling: ${mode}`,
    "",
    "## Safety boundary",
    "",
    `- ${modeBoundary}`,
    "- This report does not prove that the CSV is safe for every spreadsheet, locale, import path, or downstream consumer.",
    "- Validate the exact spreadsheet and downstream lifecycle before release.",
    "",
    "## Required lifecycle retest",
    "",
    "1. Open the cleaned CSV through the same import path customers use.",
    "2. Inspect the displayed value and formula bar for each synthetic formula-prefix case.",
    "3. Save, close, and reopen the file through that same path, then repeat the inspection.",
    "4. Run a raw-file diff against the downloaded artifact and retest every downstream consumer.",
    "",
    `CSV Guard: ${REPORT_URL}`,
    "",
  ].join("\n");
}
