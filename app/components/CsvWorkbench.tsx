"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  cleanCsv,
  parseCsv,
  serializeCsv,
  type CleanResult,
} from "../lib/csv";

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
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("untitled.csv");
  const [result, setResult] = useState<CleanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const controller = new AbortController();
    void trackEvent("page_view", controller.signal);
    return () => controller.abort();
  }, []);

  const processText = useCallback((text: string, nextFileName: string) => {
    startTransition(() => {
      try {
        const parsed = parseCsv(text);
        const cleaned = cleanCsv(parsed);
        setSource(text);
        setFileName(nextFileName);
        setResult(cleaned);
        setError(null);
        void trackEvent("analyze");
      } catch (reason) {
        setResult(null);
        setError(reason instanceof Error ? reason.message : "Unable to parse this CSV.");
      }
    });
  }, []);

  const readFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError("This file is larger than the 10 MB browser limit.");
      setResult(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Choose a .csv file or paste CSV text below.");
      setResult(null);
      return;
    }

    try {
      processText(await file.text(), file.name);
    } catch {
      setError("The browser could not read this file.");
      setResult(null);
    }
  }, [processText]);

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
    setSource(event.target.value);
    setResult(null);
    setError(null);
  }, []);

  const handleAnalyze = useCallback(() => {
    processText(source, fileName);
  }, [fileName, processText, source]);

  const handleLoadSample = useCallback(() => {
    setSource(SAMPLE_CSV);
    setFileName("sample-customers.csv");
    setResult(null);
    setError(null);
    void trackEvent("sample_loaded");
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([serializeCsv(result.table)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = fileName.replace(/\.csv$/i, "") || "cleaned";
    anchor.href = url;
    anchor.download = `${baseName}.guarded.csv`;
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
  const rowCells = previewRows.map((row) => {
    const stableKey = row.join("\u001f");
    const cells = row.map((cell, columnIndex) => (
      <td key={`${previewHeaders[columnIndex] ?? "column"}-${columnIndex}`}>{cell || "—"}</td>
    ));
    return <tr key={stableKey}>{cells}</tr>;
  });

  return (
    <section className="workbench" id="cleaner" aria-labelledby="cleaner-title">
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
        <span>or choose a file · max 10 MB</span>
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

      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          onClick={handleAnalyze}
          disabled={!source.trim() || isPending}
        >
          {isPending ? "Inspecting…" : "Inspect CSV"}
        </button>
        <span>No signup. No upload.</span>
      </div>

      {error ? <p className="error-message" role="alert">{error}</p> : null}

      {result ? (
        <div className="results" aria-live="polite">
          <div className="result-summary">
            <div>
              <p className="panel-kicker">Cleanup ready</p>
              <h3>{result.stats.outputRows.toLocaleString()} safe rows</h3>
            </div>
            <button type="button" className="download-button" onClick={handleDownload}>
              Download cleaned CSV
            </button>
          </div>
          <dl className="stats-grid">
            <div><dt>Formulas protected</dt><dd>{result.stats.formulasProtected}</dd></div>
            <div><dt>Duplicates removed</dt><dd>{result.stats.duplicatesRemoved}</dd></div>
            <div><dt>Empty rows removed</dt><dd>{result.stats.emptyRowsRemoved}</dd></div>
            <div><dt>Cells trimmed</dt><dd>{result.stats.cellsTrimmed}</dd></div>
          </dl>
          <div className="table-frame" tabIndex={0} aria-label="Cleaned CSV preview">
            <table>
              <thead><tr>{headerCells}</tr></thead>
              <tbody>{rowCells}</tbody>
            </table>
          </div>
          <p className="preview-note">
            Previewing {Math.min(result.table.rows.length, 5)} of {result.table.rows.length} rows.
            Detected {result.inputDelimiterLabel} input.
          </p>
        </div>
      ) : null}
    </section>
  );
}
