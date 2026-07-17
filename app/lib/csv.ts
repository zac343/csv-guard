export type CsvTable = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

export type FormulaProtectionMode = "portable-apostrophe" | "excel-tab";

export type CleanStats = {
  inputRows: number;
  outputRows: number;
  riskyPrefixesPrefixed: number;
  duplicatesRemoved: number;
  emptyRowsRemoved: number;
  cellsTrimmed: number;
  headersNormalized: number;
};

export type CleanResult = {
  table: CsvTable;
  stats: CleanStats;
  inputDelimiterLabel: string;
  formulaProtectionMode: FormulaProtectionMode;
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
  const counts = new Map<string, number[]>();
  for (const delimiter of DELIMITERS) {
    const rowCounts: number[] = [];
    let current = 0;
    let inQuotes = false;
    let fieldStarted = false;
    let logicalRows = 0;
    let hasCurrentRow = false;

    for (let index = 0; index < input.length && logicalRows < 8; index += 1) {
      const character = input[index];
      if (character === '"') {
        hasCurrentRow = true;
        if (inQuotes && input[index + 1] === '"') {
          index += 1;
        } else if (inQuotes) {
          inQuotes = false;
        } else if (!fieldStarted) {
          inQuotes = true;
          fieldStarted = true;
        }
        continue;
      }

      if (
        !inQuotes &&
        DELIMITERS.includes(character as (typeof DELIMITERS)[number])
      ) {
        if (character === delimiter) current += 1;
        fieldStarted = false;
        hasCurrentRow = true;
        continue;
      }

      if (!inQuotes && (character === "\n" || character === "\r")) {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        rowCounts.push(current);
        current = 0;
        fieldStarted = false;
        hasCurrentRow = false;
        logicalRows += 1;
        continue;
      }

      fieldStarted = true;
      hasCurrentRow = true;
    }

    if (logicalRows === 0 || (logicalRows < 8 && hasCurrentRow)) {
      rowCounts.push(current);
    }
    counts.set(delimiter, rowCounts);
  }

  let bestDelimiter = ",";
  let bestFound = false;
  let bestHeaderPresent = false;
  let bestSupportRatio = 0;
  let bestCoverageRatio = 0;
  let bestModeCount = 0;
  for (const delimiter of DELIMITERS) {
    const rowCounts = counts.get(delimiter) ?? [];
    const positive = rowCounts.filter((count) => count > 0);
    if (positive.length === 0) continue;

    const frequencies = new Map<number, number>();
    for (const count of positive) {
      frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
    }
    let modeCount = 0;
    let modeSupport = 0;
    for (const [count, support] of frequencies) {
      if (support > modeSupport || (support === modeSupport && count > modeCount)) {
        modeCount = count;
        modeSupport = support;
      }
    }

    const supportRatio = modeSupport / rowCounts.length;
    const coverageRatio = positive.length / rowCounts.length;
    const headerPresent = (rowCounts[0] ?? 0) > 0;
    const equallySupportedByHeader = headerPresent === bestHeaderPresent;
    const equallyConsistent = supportRatio === bestSupportRatio;
    const equallyCovered = coverageRatio === bestCoverageRatio;
    const perfectTie =
      equallySupportedByHeader &&
      equallyConsistent &&
      equallyCovered &&
      supportRatio === 1 &&
      coverageRatio === 1;
    if (
      !bestFound ||
      (headerPresent && !bestHeaderPresent) ||
      (equallySupportedByHeader && coverageRatio > bestCoverageRatio) ||
      (equallySupportedByHeader && equallyCovered && supportRatio > bestSupportRatio) ||
      (perfectTie && modeCount > bestModeCount)
    ) {
      bestDelimiter = delimiter;
      bestFound = true;
      bestHeaderPresent = headerPresent;
      bestSupportRatio = supportRatio;
      bestCoverageRatio = coverageRatio;
      bestModeCount = modeCount;
    }
  }
  return bestFound ? bestDelimiter : "";
}

export function parseCsv(input: string): CsvTable {
  const normalizedInput = input.replace(/^\uFEFF/, "");
  if (!normalizedInput.trim()) throw new Error("Paste CSV text or choose a non-empty file.");

  const delimiter = detectDelimiter(normalizedInput);
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;
  let parsedCells = 0;

  const appendToField = (value: string) => {
    if (field.length + value.length > CSV_LIMITS.fieldCharacters) {
      throw new Error(
        `A CSV field exceeds the ${CSV_LIMITS.fieldCharacters.toLocaleString("en-US")} character browser limit.`,
      );
    }
    field += value;
    fieldStarted = true;
  };

  const pushField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
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
      } else if (inQuotes) {
        inQuotes = false;
      } else if (!fieldStarted) {
        inQuotes = true;
        fieldStarted = true;
      } else {
        appendToField('"');
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

function looksExecutable(value: string, formulaProtectionMode: FormulaProtectionMode) {
  const leadingNoise = formulaProtectionMode === "excel-tab"
    ? /^['"\p{White_Space}\p{Cc}\p{Cf}]+/u
    : /^["\p{White_Space}\p{Cc}\p{Cf}]+/u;
  const probe = value.normalize("NFKC").replace(leadingNoise, "");
  return /^[=+\-@]/u.test(probe);
}

const EXECUTABLE_SEGMENT_BOUNDARIES = new Set<string>([
  ...DELIMITERS,
  "\r",
  "\n",
]);

function isExecutableSegmentBoundary(character: string) {
  if (EXECUTABLE_SEGMENT_BOUNDARIES.has(character)) return true;
  return [...character.normalize("NFKC")].some((normalizedCharacter) =>
    EXECUTABLE_SEGMENT_BOUNDARIES.has(normalizedCharacter)
  );
}

function alreadyHasApostrophePrefix(value: string) {
  const probe = value
    .normalize("NFKC")
    .replace(/^["\p{White_Space}\p{Cc}\p{Cf}]+/u, "");
  return probe.startsWith("'");
}

function alreadyHasLayeredExcelPrefix(
  value: string,
  segmentStart: number,
  segment: string,
) {
  return (
    segmentStart > 0 &&
    value[segmentStart - 1] === "\t" &&
    alreadyHasApostrophePrefix(segment)
  );
}

function protectExecutableSegments(
  value: string,
  formulaProtectionMode: FormulaProtectionMode,
) {
  let output = "";
  let segmentStart = 0;
  let protectedSegments = 0;

  for (let index = 0; index <= value.length;) {
    const atEnd = index === value.length;
    const boundary = atEnd
      ? ""
      : String.fromCodePoint(value.codePointAt(index)!);
    if (!atEnd && !isExecutableSegmentBoundary(boundary)) {
      index += boundary.length;
      continue;
    }

    const segment = value.slice(segmentStart, index);
    if (looksExecutable(segment, formulaProtectionMode)) {
      if (
        formulaProtectionMode === "excel-tab" &&
        alreadyHasLayeredExcelPrefix(value, segmentStart, segment)
      ) {
        output += segment;
      } else {
        const prefix = formulaProtectionMode === "excel-tab"
          ? (alreadyHasApostrophePrefix(segment) ? "\t" : "\t'")
          : "'";
        output += `${prefix}${segment}`;
        protectedSegments += 1;
      }
    } else {
      output += segment;
    }

    if (atEnd) break;
    output += boundary;
    index += boundary.length;
    segmentStart = index;
  }

  return { value: output, protectedSegments };
}

export function cleanCsv(
  table: CsvTable,
  formulaProtectionMode: FormulaProtectionMode = "portable-apostrophe",
): CleanResult {
  const normalizedHeaders = makeHeadersUnique(
    table.headers.map((header, index) => normalizeHeader(header, index)),
  );
  let headersNormalized = 0;
  normalizedHeaders.forEach((header, index) => {
    if (header !== table.headers[index]) headersNormalized += 1;
  });

  let cellsTrimmed = 0;
  let riskyPrefixesPrefixed = 0;
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
      const protectedCell = protectExecutableSegments(cell, formulaProtectionMode);
      riskyPrefixesPrefixed += protectedCell.protectedSegments;
      return protectedCell.value;
    });
    rows.push(cleanedRow);
  }

  return {
    table: { headers: normalizedHeaders, rows, delimiter: "," },
    stats: {
      inputRows: table.rows.length,
      outputRows: rows.length,
      riskyPrefixesPrefixed,
      duplicatesRemoved,
      emptyRowsRemoved,
      cellsTrimmed,
      headersNormalized,
    },
    inputDelimiterLabel: delimiterLabel(table.delimiter),
    formulaProtectionMode,
  };
}

function escapeCsvCell(cell: string) {
  return `"${cell.replaceAll('"', '""')}"`;
}

function serializeTable(table: CsvTable, formulaProtectionMode?: FormulaProtectionMode) {
  const delimiter = table.delimiter || ",";
  const lines = [table.headers, ...table.rows].map((row) =>
    row
      .map((cell) => escapeCsvCell(
        formulaProtectionMode
          ? protectExecutableSegments(cell, formulaProtectionMode).value
          : cell,
      ))
      .join(delimiter),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function serializeCsv(
  table: CsvTable,
  formulaProtectionMode: FormulaProtectionMode = "portable-apostrophe",
) {
  return serializeTable(table, formulaProtectionMode);
}

export function serializeCleanCsv(result: CleanResult) {
  return serializeTable(result.table);
}
