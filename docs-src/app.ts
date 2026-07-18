import {
  cleanCsv,
  parseCsv,
  serializeCleanCsv,
  type CleanResult,
  type FormulaProtectionMode,
} from "../app/lib/csv.ts";
import { CsvFileDecodingError, decodeUtf8Csv } from "../app/lib/file-text.ts";
import { createLatestOperation } from "../app/lib/latest-operation.ts";
import { createSecurityReviewReport } from "../app/lib/review-report.ts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PREVIEW_ROWS = 5;
const PREVIEW_COLUMNS = 6;
const SAMPLE_CSV = [
  " Customer Name ,Email,Invoice note",
  'Ada Lovelace,ada@example.com,"=HYPERLINK(""https://example.test"",""Open invoice"")"',
  "Grace Hopper,grace@example.com, Paid ",
  "Grace Hopper,grace@example.com, Paid ",
  ",,",
].join("\n");

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`CSV Guard could not find ${selector}.`);
  return element;
}

const fileInput = requireElement<HTMLInputElement>("#csv-file");
const dropZone = requireElement<HTMLLabelElement>("#drop-zone");
const sourceInput = requireElement<HTMLTextAreaElement>("#csv-source");
const sampleButton = requireElement<HTMLButtonElement>("#load-sample");
const formulaModeSelect = requireElement<HTMLSelectElement>("#formula-mode");
const formulaModeNote = requireElement<HTMLParagraphElement>("#formula-mode-note");
const analyzeButton = requireElement<HTMLButtonElement>("#analyze-csv");
const downloadButton = requireElement<HTMLButtonElement>("#download-csv");
const reviewReportButton = requireElement<HTMLButtonElement>("#download-review-report");
const resultsPanel = requireElement<HTMLElement>("#results");
const errorMessage = requireElement<HTMLParagraphElement>("#error-message");
const workbenchStatus = requireElement<HTMLParagraphElement>("#workbench-status");
const outputHeading = requireElement<HTMLElement>("#output-heading");
const resultMode = requireElement<HTMLElement>("#result-mode");
const previewTable = requireElement<HTMLTableElement>("#preview-table");
const previewNote = requireElement<HTMLParagraphElement>("#preview-note");

let currentResult: CleanResult | null = null;
let currentFileName = "untitled.csv";
let isProcessing = false;
const operations = createLatestOperation();

function formatted(value: number) {
  return value.toLocaleString("en-US");
}

function setStatus(message: string) {
  workbenchStatus.textContent = message;
}

function selectedFormulaProtectionMode(): FormulaProtectionMode {
  return formulaModeSelect.value === "excel-tab" ? "excel-tab" : "portable-apostrophe";
}

function updateFormulaModeNote() {
  formulaModeNote.textContent = selectedFormulaProtectionMode() === "excel-tab"
    ? "Adds a real tab and an apostrophe before risky markers. Both stay in exported data and can disrupt downstream imports. The tab may better survive Excel save/reopen; test the exact lifecycle. Negative numbers are also prefixed."
    : "Adds an apostrophe before risky markers. The apostrophe stays in exported data, so downstream tools must accept or strip it. Excel may remove its escape behavior after save/reopen. Negative numbers are also prefixed.";
}

function setBusy(busy: boolean) {
  isProcessing = busy;
  analyzeButton.disabled = busy || !sourceInput.value.trim();
  fileInput.disabled = busy;
  sourceInput.disabled = busy;
  sampleButton.disabled = busy;
  formulaModeSelect.disabled = busy;
  downloadButton.disabled = busy || !currentResult;
  reviewReportButton.disabled = busy || !currentResult;
  dropZone.setAttribute("aria-busy", String(busy));
  dropZone.setAttribute("aria-disabled", String(busy));
  analyzeButton.textContent = busy ? "Inspecting…" : "Inspect CSV";
}

function clearResult() {
  currentResult = null;
  resultsPanel.hidden = true;
  previewTable.replaceChildren();
  downloadButton.disabled = true;
  reviewReportButton.disabled = true;
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
}

function showError(message: string) {
  clearResult();
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  setStatus("No file content was uploaded.");
}

function setStat(name: string, value: number) {
  requireElement<HTMLElement>(`[data-stat="${name}"]`).textContent = formatted(value);
}

function renderPreview(result: CleanResult) {
  const headers = result.table.headers.slice(0, PREVIEW_COLUMNS);
  const rows = result.table.rows.slice(0, PREVIEW_ROWS);
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");

  for (const header of headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headerRow.append(cell);
  }

  head.append(headerRow);
  const body = document.createElement("tbody");

  for (const row of rows) {
    const tableRow = document.createElement("tr");
    for (let column = 0; column < headers.length; column += 1) {
      const cell = document.createElement("td");
      const value = row[column] ?? "";
      cell.textContent = (
        result.formulaProtectionMode === "excel-tab"
          ? value.replaceAll("\t", "⇥")
          : value
      ) || "—";
      if (!value) cell.className = "empty-cell";
      tableRow.append(cell);
    }
    body.append(tableRow);
  }

  previewTable.replaceChildren(head, body);
  previewNote.textContent =
    `Previewing ${formatted(rows.length)}/${formatted(result.table.rows.length)} rows and ` +
    `${formatted(headers.length)}/${formatted(result.table.headers.length)} columns. ` +
    `Detected ${result.inputDelimiterLabel} input. ` +
    (result.formulaProtectionMode === "excel-tab"
      ? "Tab + apostrophe mode; tabs display as ⇥ in this preview."
      : "Apostrophe-prefix mode.");
}

function renderResult(result: CleanResult) {
  currentResult = result;
  outputHeading.textContent = `${formatted(result.stats.outputRows)} cleaned rows`;
  resultMode.textContent = result.formulaProtectionMode === "excel-tab"
    ? "Tab + apostrophe-prefixed export"
    : "Apostrophe-prefixed export";
  setStat("formulas", result.stats.riskyPrefixesPrefixed);
  setStat("duplicates", result.stats.duplicatesRemoved);
  setStat("empty", result.stats.emptyRowsRemoved);
  setStat("trimmed", result.stats.cellsTrimmed);
  setStat("headers", result.stats.headersNormalized);
  renderPreview(result);
  clearError();
  resultsPanel.hidden = false;
  downloadButton.disabled = false;
  reviewReportButton.disabled = false;
  setStatus("Cleanup finished locally. Review the counts, then download when ready.");
}

async function processText(
  text: string,
  fileName: string,
  operation = operations.begin(),
) {
  if (!operations.isCurrent(operation)) return;
  if (new Blob([text]).size > MAX_FILE_BYTES) {
    showError("This CSV is larger than the 10 MB browser limit.");
    setBusy(false);
    return;
  }

  currentFileName = fileName;
  const formulaProtectionMode = selectedFormulaProtectionMode();
  setBusy(true);
  clearError();
  setStatus("Inspecting locally—no file content is being sent anywhere.");

  // Let the busy state paint before the synchronous parser starts.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (!operations.isCurrent(operation)) return;

  try {
    const result = cleanCsv(parseCsv(text), formulaProtectionMode);
    if (operations.isCurrent(operation)) renderResult(result);
  } catch (reason) {
    if (operations.isCurrent(operation)) {
      showError(reason instanceof Error ? reason.message : "Unable to parse this CSV.");
    }
  } finally {
    if (operations.isCurrent(operation)) setBusy(false);
  }
}

async function readFile(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    operations.invalidate();
    showError("This file is larger than the 10 MB browser limit.");
    setBusy(false);
    return;
  }
  if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
    operations.invalidate();
    showError("Choose a .csv file or paste CSV text below.");
    setBusy(false);
    return;
  }

  const operation = operations.begin();
  setBusy(true);
  clearError();
  setStatus("Reading the file locally—no file content is being sent anywhere.");
  try {
    const text = decodeUtf8Csv(await file.arrayBuffer());
    if (!operations.isCurrent(operation)) return;
    sourceInput.value = text;
    await processText(text, file.name, operation);
  } catch (reason) {
    if (operations.isCurrent(operation)) {
      showError(reason instanceof CsvFileDecodingError
        ? reason.message
        : "The browser could not read this file.");
      setBusy(false);
    }
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void readFile(file);
  fileInput.value = "";
});

for (const eventName of ["dragenter", "dragover"] as const) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!isProcessing) dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "dragend"] as const) {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove("is-dragging"));
}

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  const file = event.dataTransfer?.files[0];
  if (file && !isProcessing) void readFile(file);
});

sourceInput.addEventListener("input", () => {
  operations.invalidate();
  if (isProcessing) setBusy(false);
  clearResult();
  clearError();
  analyzeButton.disabled = isProcessing || !sourceInput.value.trim();
  currentFileName = "pasted.csv";
  setStatus(sourceInput.value.trim() ? "CSV text is ready for local inspection." : "Waiting for a CSV.");
});

sampleButton.addEventListener("click", () => {
  operations.invalidate();
  sourceInput.value = SAMPLE_CSV;
  currentFileName = "risky-sample.csv";
  clearResult();
  clearError();
  analyzeButton.disabled = false;
  setStatus("Risky sample loaded. Select Inspect CSV to see each fix.");
  sourceInput.focus();
});

formulaModeSelect.addEventListener("change", () => {
  operations.invalidate();
  clearResult();
  clearError();
  updateFormulaModeNote();
  setStatus(sourceInput.value.trim()
    ? "Formula handling changed. Inspect the CSV again before downloading."
    : "Waiting for a CSV.");
});

analyzeButton.addEventListener("click", () => {
  void processText(sourceInput.value, currentFileName);
});

downloadButton.addEventListener("click", () => {
  if (!currentResult) return;
  const blob = new Blob([serializeCleanCsv(currentResult)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const baseName = currentFileName.replace(/\.csv$/i, "").replace(/[\\/:*?"<>|]+/g, "-") || "cleaned";
  anchor.href = url;
  const suffix = currentResult.formulaProtectionMode === "excel-tab"
    ? "tab-apostrophe-prefixed"
    : "apostrophe-prefixed";
  anchor.download = `${baseName}.${suffix}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus("Download requested. Confirm the file in your browser. No file content was uploaded.");
});

reviewReportButton.addEventListener("click", () => {
  if (!currentResult) return;
  const blob = new Blob([createSecurityReviewReport(currentResult)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "csv-guard.security-review.md";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus("Review report requested. It contains aggregate counts only; review it before sharing.");
});

updateFormulaModeNote();
setBusy(false);
