"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import {
  CSV_LIMITS,
  cleanCsv,
  parseCsv,
  serializeCleanCsv,
  type CleanResult,
  type FormulaProtectionMode,
} from "../lib/csv";
import { CsvFileDecodingError, decodeUtf8Csv } from "../lib/file-text";
import { createLatestOperation } from "../lib/latest-operation";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SAMPLE_CSV = ` Customer Name ,Email,Invoice note
Ada Lovelace,ada@example.com,"=HYPERLINK(""https://example.test"")"
Grace Hopper,grace@example.com, Paid 
Grace Hopper,grace@example.com, Paid 
,,`;

type EventName = "page_view" | "sample_loaded" | "analyze" | "download";

async function trackEvent(event: EventName, signal?: AbortSignal) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
      signal,
    });
  } catch {
    // Product telemetry must never interrupt local file processing.
  }
}

export function CsvWorkbench() {
  const fileInputId = useId();
  const formulaModeNoteId = `${fileInputId}-formula-mode-note`;
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("untitled.csv");
  const [result, setResult] = useState<CleanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formulaProtectionMode, setFormulaProtectionMode] =
    useState<FormulaProtectionMode>("portable-apostrophe");
  const [operations] = useState(createLatestOperation);

  useEffect(() => {
    const controller = new AbortController();
    void trackEvent("page_view", controller.signal);
    return () => controller.abort();
  }, []);

  const processText = useCallback(async (
    text: string,
    nextFileName: string,
    operation = operations.begin(),
  ) => {
    if (!operations.isCurrent(operation)) return;
    if (new Blob([text]).size > MAX_FILE_BYTES) {
      setError("This CSV is larger than the 10 MB browser limit.");
      setResult(null);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (!operations.isCurrent(operation)) return;
    try {
      const parsed = parseCsv(text);
      const cleaned = cleanCsv(parsed, formulaProtectionMode);
      if (operations.isCurrent(operation)) {
        setSource(text);
        setFileName(nextFileName);
        setResult(cleaned);
        setError(null);
        void trackEvent("analyze");
      }
    } catch (reason) {
      if (operations.isCurrent(operation)) {
        setResult(null);
        setError(reason instanceof Error ? reason.message : "Unable to parse this CSV.");
      }
    } finally {
      if (operations.isCurrent(operation)) setIsProcessing(false);
    }
  }, [formulaProtectionMode, operations]);

  const readFile = useCallback(async (file: File) => {
    const operation = operations.begin();
    setIsProcessing(true);
    setError(null);
    setResult(null);

    if (file.size > MAX_FILE_BYTES) {
      setError("This file is larger than the 10 MB browser limit.");
      setIsProcessing(false);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Choose a .csv file or paste CSV text below.");
      setIsProcessing(false);
      return;
    }

    try {
      const text = decodeUtf8Csv(await file.arrayBuffer());
      if (!operations.isCurrent(operation)) return;
      await processText(text, file.name, operation);
    } catch (reason) {
      if (operations.isCurrent(operation)) {
        setError(reason instanceof CsvFileDecodingError
          ? reason.message
          : "The browser could not read this file.");
        setResult(null);
        setIsProcessing(false);
      }
    }
  }, [operations, processText]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = "";
  }, [readFile]);

  const handleDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }, [readFile]);

  const handleSourceChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    operations.invalidate();
    setIsProcessing(false);
    setSource(event.target.value);
    setResult(null);
    setError(null);
  }, [operations]);

  const handleAnalyze = useCallback(() => {
    void processText(source, fileName);
  }, [fileName, processText, source]);

  const handleLoadSample = useCallback(() => {
    operations.invalidate();
    setIsProcessing(false);
    setSource(SAMPLE_CSV);
    setFileName("sample-customers.csv");
    setResult(null);
    setError(null);
    void trackEvent("sample_loaded");
  }, [operations]);

  const handleFormulaModeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    operations.invalidate();
    setIsProcessing(false);
    setFormulaProtectionMode(event.target.value as FormulaProtectionMode);
    setResult(null);
    setError(null);
  }, [operations]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([serializeCleanCsv(result)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = fileName.replace(/\.csv$/i, "") || "cleaned";
    anchor.href = url;
    const suffix = result.formulaProtectionMode === "excel-tab"
      ? "tab-apostrophe-prefixed"
      : "apostrophe-prefixed";
    anchor.download = `${baseName}.${suffix}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    void trackEvent("download");
  }, [fileName, result]);

  const previewHeaders = useMemo(
    () => result?.table.headers.slice(0, 6) ?? [],
    [result],
  );
  const previewRows = useMemo(
    () => result?.table.rows.slice(0, 5).map((row) => row.slice(0, 6)) ?? [],
    [result],
  );
  const headerCells = previewHeaders.map((header) => <th key={header}>{header}</th>);
  const rowCells = previewRows.map((row, rowIndex) => {
    const stableKey = row.join("\u001f");
    const cells = row.map((cell, columnIndex) => {
      const visibleCell = result?.formulaProtectionMode === "excel-tab"
        ? cell.replaceAll("\t", "⇥")
        : cell;
      return (
        <td key={`${previewHeaders[columnIndex] ?? "column"}-${columnIndex}`}>
          {visibleCell || "—"}
        </td>
      );
    });
    return <tr key={`${rowIndex}-${stableKey}`}>{cells}</tr>;
  });

  return (
    <section
      className="workbench"
      id="cleaner"
      aria-labelledby="cleaner-title"
      aria-busy={isProcessing}
    >
      <div className="workbench-topline">
        <div>
          <p className="panel-kicker">Local workbench</p>
          <h2 id="cleaner-title">Inspect a CSV</h2>
        </div>
        <span className="privacy-dot"><i aria-hidden="true" /> File stays here</span>
      </div>

      <label
        className={`drop-zone${isDragging ? " is-dragging" : ""}`}
        htmlFor={fileInputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id={fileInputId}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
        />
        <span className="drop-icon" aria-hidden="true">CSV</span>
        <strong>Drop a CSV here</strong>
        <span>
          or choose a file · max 10 MB · {CSV_LIMITS.dataRows.toLocaleString()} data rows
        </span>
      </label>

      <div className="paste-row">
        <label htmlFor={`${fileInputId}-paste`}>Or paste CSV text</label>
        <button type="button" className="text-button" onClick={handleLoadSample}>
          Load a risky sample
        </button>
      </div>
      <textarea
        id={`${fileInputId}-paste`}
        value={source}
        onChange={handleSourceChange}
        placeholder="name,email,company&#10;Ada,ada@example.com,Analytical Engines"
        rows={5}
        spellCheck={false}
      />

      <div className="formula-mode-control">
        <label htmlFor={`${fileInputId}-formula-mode`}>Formula handling</label>
        <select
          id={`${fileInputId}-formula-mode`}
          value={formulaProtectionMode}
          onChange={handleFormulaModeChange}
          disabled={isProcessing}
          aria-describedby={formulaModeNoteId}
        >
          <option value="portable-apostrophe">Apostrophe prefix (default)</option>
          <option value="excel-tab">Excel review prefix (tab + apostrophe)</option>
        </select>
        <p id={formulaModeNoteId}>
          {formulaProtectionMode === "excel-tab"
            ? "Adds a real tab and an apostrophe before risky markers. Both stay in exported data and can disrupt downstream imports. The tab may better survive Excel save/reopen; test the exact lifecycle. Negative numbers are also prefixed."
            : "Adds an apostrophe before risky markers. The apostrophe stays in exported data, so downstream tools must accept or strip it. Excel may remove its escape behavior after save/reopen. Negative numbers are also prefixed."}
        </p>
      </div>

      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          onClick={handleAnalyze}
          disabled={!source.trim() || isProcessing}
        >
          {isProcessing ? "Inspecting…" : "Inspect CSV"}
        </button>
        <span>No signup. No file upload.</span>
      </div>

      {error ? <p className="error-message" role="alert">{error}</p> : null}

      {result ? (
        <div className="results" aria-live="polite">
          <div className="result-summary">
            <div>
              <p className="panel-kicker">Cleanup ready</p>
              <h3>{result.stats.outputRows.toLocaleString()} cleaned rows</h3>
              <p className="result-mode">
                {result.formulaProtectionMode === "excel-tab"
                  ? "Tab + apostrophe-prefixed export"
                  : "Apostrophe-prefixed export"}
              </p>
            </div>
            <button type="button" className="download-button" onClick={handleDownload}>
              Download cleaned CSV
            </button>
          </div>
          <dl className="stats-grid">
            <div><dt>Formula-like segments changed</dt><dd>{result.stats.riskyPrefixesPrefixed}</dd></div>
            <div><dt>Duplicates removed</dt><dd>{result.stats.duplicatesRemoved}</dd></div>
            <div><dt>Empty rows removed</dt><dd>{result.stats.emptyRowsRemoved}</dd></div>
            <div><dt>Cells trimmed</dt><dd>{result.stats.cellsTrimmed}</dd></div>
            <div><dt>Headers normalized</dt><dd>{result.stats.headersNormalized}</dd></div>
          </dl>
          <div className="table-frame" tabIndex={0} aria-label="Cleaned CSV preview">
            <table>
              <thead><tr>{headerCells}</tr></thead>
              <tbody>{rowCells}</tbody>
            </table>
          </div>
          <p className="preview-note">
            Previewing {Math.min(result.table.rows.length, 5)}/{result.table.rows.length} rows and{" "}
            {Math.min(result.table.headers.length, 6)}/{result.table.headers.length} columns. Detected{" "}
            {result.inputDelimiterLabel} input.{" "}
            {result.formulaProtectionMode === "excel-tab"
              ? "Tab + apostrophe mode; tabs display as ⇥ in this preview."
              : "Apostrophe-prefix mode."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
