export type CsvTable = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

export type CleanStats = {
  inputRows: number;
  outputRows: number;
  formulasProtected: number;
  duplicatesRemoved: number;
  emptyRowsRemoved: number;
  cellsTrimmed: number;
  headersNormalized: number;
};

export type CleanResult = {
  table: CsvTable;
  stats: CleanStats;
  inputDelimiterLabel: string;
};

const DELIMITERS = [",", ";", "\t", "|"] as const;

function delimiterLabel(delimiter: string) {
  if (delimiter === "\t") return "tab-separated data";
  if (delimiter === ";") return "semicolon-separated data";
  if (delimiter === "|") return "pipe-separated data";
  return "comma-separated data";
}

export function detectDelimiter(input: string) {
  const counts = new Map<string, number[]>(DELIMITERS.map((delimiter) => [delimiter, []]));
  const current = new Map<string, number>(DELIMITERS.map((delimiter) => [delimiter, 0]));
  let inQuotes = false;
  let logicalRows = 0;

  for (let index = 0; index < input.length && logicalRows < 8; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && DELIMITERS.includes(character as (typeof DELIMITERS)[number])) {
      current.set(character, (current.get(character) ?? 0) + 1);
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      for (const delimiter of DELIMITERS) {
        counts.get(delimiter)?.push(current.get(delimiter) ?? 0);
        current.set(delimiter, 0);
      }
      logicalRows += 1;
    }
  }

  if (logicalRows === 0 || [...current.values()].some((count) => count > 0)) {
    for (const delimiter of DELIMITERS) counts.get(delimiter)?.push(current.get(delimiter) ?? 0);
  }

  let bestDelimiter = ",";
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const rowCounts = counts.get(delimiter) ?? [];
    const positive = rowCounts.filter((count) => count > 0);
    if (positive.length === 0) continue;
    const average = positive.reduce((sum, count) => sum + count, 0) / positive.length;
    const variance = positive.reduce((sum, count) => sum + Math.abs(count - average), 0);
    const score = positive.length * 10 + average - variance;
    if (score > bestScore) {
      bestDelimiter = delimiter;
      bestScore = score;
    }
  }
  return bestDelimiter;
}

export function parseCsv(input: string): CsvTable {
  const normalizedInput = input.replace(/^\uFEFF/, "");
  if (!normalizedInput.trim()) throw new Error("Paste CSV text or choose a non-empty file.");

  const delimiter = detectDelimiter(normalizedInput);
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < normalizedInput.length; index += 1) {
    const character = normalizedInput[index];
    if (character === '"') {
      if (inQuotes && normalizedInput[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && normalizedInput[index + 1] === "\n") index += 1;
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (inQuotes) throw new Error("A quoted field is not closed. Check the final row and try again.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const headers = records.shift() ?? [];
  if (headers.length === 0 || headers.every((header) => !header.trim())) {
    throw new Error("The first CSV row needs at least one column header.");
  }
  const width = Math.max(headers.length, ...records.map((record) => record.length));
  const paddedHeaders = [...headers, ...Array(Math.max(0, width - headers.length)).fill("")];
  const rows = records.map((record) => [
    ...record,
    ...Array(Math.max(0, width - record.length)).fill(""),
  ].slice(0, width));

  return { headers: paddedHeaders, rows, delimiter };
}

function normalizeHeader(header: string, index: number) {
  const normalized = header
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\p{L}\p{N}_]+/gu, "")
    .replace(/^_+|_+$/g, "");
  return normalized || `column_${index + 1}`;
}

function makeHeadersUnique(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const count = (seen.get(header) ?? 0) + 1;
    seen.set(header, count);
    return count === 1 ? header : `${header}_${count}`;
  });
}

function looksExecutable(value: string) {
  if (/^[=+@]/.test(value)) return true;
  return /^-\s*(?:[A-Za-z_(]|\d+\s*[+*/^])/.test(value);
}

export function cleanCsv(table: CsvTable): CleanResult {
  const normalizedHeaders = makeHeadersUnique(
    table.headers.map((header, index) => normalizeHeader(header, index)),
  );
  let headersNormalized = 0;
  normalizedHeaders.forEach((header, index) => {
    if (header !== table.headers[index]) headersNormalized += 1;
  });

  let cellsTrimmed = 0;
  let formulasProtected = 0;
  let emptyRowsRemoved = 0;
  let duplicatesRemoved = 0;
  const seenRows = new Set<string>();
  const rows: string[][] = [];

  for (const sourceRow of table.rows) {
    const cleanedRow = sourceRow.map((cell) => {
      const trimmed = cell.trim();
      if (trimmed !== cell) cellsTrimmed += 1;
      if (looksExecutable(trimmed)) {
        formulasProtected += 1;
        return `'${trimmed}`;
      }
      return trimmed;
    });

    if (cleanedRow.every((cell) => cell === "")) {
      emptyRowsRemoved += 1;
      continue;
    }

    const fingerprint = JSON.stringify(cleanedRow);
    if (seenRows.has(fingerprint)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenRows.add(fingerprint);
    rows.push(cleanedRow);
  }

  return {
    table: { headers: normalizedHeaders, rows, delimiter: "," },
    stats: {
      inputRows: table.rows.length,
      outputRows: rows.length,
      formulasProtected,
      duplicatesRemoved,
      emptyRowsRemoved,
      cellsTrimmed,
      headersNormalized,
    },
    inputDelimiterLabel: delimiterLabel(table.delimiter),
  };
}

function escapeCsvCell(cell: string, delimiter: string) {
  if (cell.includes(delimiter) || cell.includes('"') || cell.includes("\n") || cell.includes("\r")) {
    return `"${cell.replaceAll('"', '""')}"`;
  }
  return cell;
}

export function serializeCsv(table: CsvTable) {
  const delimiter = table.delimiter || ",";
  const lines = [table.headers, ...table.rows].map((row) =>
    row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
