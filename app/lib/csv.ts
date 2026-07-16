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

export const CSV_LIMITS = {
  dataRows: 100_000,
  columns: 5_000,
  cells: 500_000,
  fieldCharacters: 2_000_000,
} as const;

function delimiterLabel(delimiter: string) {
  if (!delimiter) return "single-column data";
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
  return bestScore > 0 ? bestDelimiter : "";
}

export function parseCsv(input: string): CsvTable {
  const normalizedInput = input.replace(/^\uFEFF/, "");
  if (!normalizedInput.trim()) throw new Error("Paste CSV text or choose a non-empty file.");

  const delimiter = detectDelimiter(normalizedInput);
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let parsedCells = 0;

  const appendToField = (value: string) => {
    if (field.length + value.length > CSV_LIMITS.fieldCharacters) {
      throw new Error(
        `A CSV field exceeds the ${CSV_LIMITS.fieldCharacters.toLocaleString("en-US")} character browser limit.`,
      );
    }
    field += value;
  };

  const pushField = () => {
    row.push(field);
    field = "";
    parsedCells += 1;
    if (row.length > CSV_LIMITS.columns) {
      throw new Error(
        `This CSV exceeds the ${CSV_LIMITS.columns.toLocaleString("en-US")} column browser limit.`,
      );
    }
    if (parsedCells > CSV_LIMITS.cells) {
      throw new Error(
        `This CSV exceeds the ${CSV_LIMITS.cells.toLocaleString("en-US")} cell browser limit.`,
      );
    }
  };

  const pushRecord = () => {
    pushField();
    records.push(row);
    row = [];
    if (records.length > CSV_LIMITS.dataRows + 1) {
      throw new Error(
        `This CSV exceeds the ${CSV_LIMITS.dataRows.toLocaleString("en-US")} data row browser limit.`,
      );
    }
  };

  for (let index = 0; index < normalizedInput.length; index += 1) {
    const character = normalizedInput[index];
    if (character === '"') {
      if (inQuotes && normalizedInput[index + 1] === '"') {
        appendToField('"');
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      pushField();
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && normalizedInput[index + 1] === "\n") index += 1;
      pushRecord();
      continue;
    }

    appendToField(character);
  }

  if (inQuotes) throw new Error("A quoted field is not closed. Check the final row and try again.");
  if (field.length > 0 || row.length > 0) {
    pushRecord();
  }

  const logicalRecordCount = records.length;
  const headers = records.shift() ?? [];
  if (headers.length === 0 || headers.every((header) => !header.trim())) {
    throw new Error("The first CSV row needs at least one column header.");
  }
  let width = headers.length;
  for (const record of records) width = Math.max(width, record.length);
  if (logicalRecordCount * width > CSV_LIMITS.cells) {
    throw new Error(
      `This CSV exceeds the ${CSV_LIMITS.cells.toLocaleString("en-US")} normalized cell browser limit.`,
    );
  }
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
  const used = new Set<string>();
  return headers.map((header) => {
    let candidate = header;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${header}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

function looksExecutable(value: string) {
  const probe = value
    .normalize("NFKC")
    .replace(/^["\p{White_Space}\p{Cc}\p{Cf}]+/u, "");
  return /^[=+\-@]/u.test(probe);
}

const EXECUTABLE_SEGMENT_BOUNDARIES = new Set<string>([
  ...DELIMITERS,
  "\r",
  "\n",
]);

function protectExecutableSegments(value: string) {
  let output = "";
  let segmentStart = 0;
  let protectedSegments = 0;

  for (let index = 0; index <= value.length; index += 1) {
    const atEnd = index === value.length;
    if (!atEnd && !EXECUTABLE_SEGMENT_BOUNDARIES.has(value[index])) continue;

    const segment = value.slice(segmentStart, index);
    if (looksExecutable(segment)) {
      output += `'${segment}`;
      protectedSegments += 1;
    } else {
      output += segment;
    }

    if (!atEnd) output += value[index];
    segmentStart = index + 1;
  }

  return { value: output, protectedSegments };
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
    const trimmedRow = sourceRow.map((cell) => {
      const trimmed = cell.trim();
      if (trimmed !== cell) cellsTrimmed += 1;
      return trimmed;
    });

    if (trimmedRow.every((cell) => cell === "")) {
      emptyRowsRemoved += 1;
      continue;
    }

    const fingerprint = JSON.stringify(trimmedRow);
    if (seenRows.has(fingerprint)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenRows.add(fingerprint);

    const cleanedRow = trimmedRow.map((cell) => {
      const protectedCell = protectExecutableSegments(cell);
      formulasProtected += protectedCell.protectedSegments;
      return protectedCell.value;
    });
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

function escapeCsvCell(cell: string) {
  return `"${cell.replaceAll('"', '""')}"`;
}

export function serializeCsv(table: CsvTable) {
  const delimiter = table.delimiter || ",";
  const lines = [table.headers, ...table.rows].map((row) =>
    row
      .map((cell) => escapeCsvCell(protectExecutableSegments(cell).value))
      .join(delimiter),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
